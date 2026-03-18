// C:\HDUD_DATA\hdud-web-app\src\pages\NetworkPage.tsx

import React, { useEffect, useMemo, useState } from "react";

// ============================
// Helpers API
// ============================

function getToken(): string | null {
  return (
    localStorage.getItem("HDUD_TOKEN") ||
    localStorage.getItem("hdud_access_token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    null
  );
}

function apiBase(): string {
  return (import.meta as any).env?.VITE_API_BASE_URL || "http://127.0.0.1:4000";
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken();

  const res = await fetch(`${apiBase()}/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const contentType = res.headers.get("content-type") || "";
  const rawText = await res.text();

  if (!res.ok) {
    throw new Error(rawText || `Erro HTTP ${res.status}`);
  }

  if (!rawText) return null;

  if (contentType.includes("application/json")) {
    return JSON.parse(rawText);
  }

  try {
    return JSON.parse(rawText);
  } catch {
    return rawText;
  }
}

function toAbsUrl(input?: string | null): string | null {
  const s = String(input || "").trim();
  if (!s) return null;

  if (/^https?:\/\//i.test(s)) {
    return s
      .replace("http://localhost", "http://127.0.0.1")
      .replace("https://localhost", "https://127.0.0.1");
  }

  const base = apiBase().replace("localhost", "127.0.0.1");
  if (s.startsWith("/")) return `${base}${s}`;
  return `${base}/${s}`;
}

function getInitials(name: string) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();

  return (parts[0].slice(0, 1) + parts[1].slice(0, 1)).toUpperCase();
}

// ============================
// Tipos
// ============================

type PresenceStatus = "Alta" | "Moderada" | "Inicial";

type NetworkSummary = {
  followers: number;
  following: number;
  newFollowers: number;
  profileViews7d: number;
  growth7d: string;
  presenceStatus: PresenceStatus;
};

type Person = {
  id: number;
  name: string;
  headline: string;
  avatar?: string | null;
  location?: string;
  signals: string[];
  reason: string;
  preview: string;
  isFollowing: boolean;
};

type VanityItem = {
  id: number;
  title: string;
  subtitle: string;
  createdAt: string;
};

type OrbitItem = {
  id: number;
  name: string;
  initials: string;
  note: string;
  createdAt: string;
};

type ApiSummary = Partial<{
  followers: number;
  following: number;
  newFollowers: number;
  profileViews7d: number;
  growth7d: string;
  presenceStatus: PresenceStatus;
}>;

type ApiSuggestion = Partial<{
  id: number;
  author_id: number;
  name: string;
  display_name: string;
  name_public: string;
  headline: string;
  bio_short: string;
  location: string;
  avatar: string | null;
  avatar_url: string | null;
  isFollowing: boolean;
  is_following: boolean | number;
  signals: string[];
  reason: string;
  preview: string;
}>;

// ============================
// Normalizers
// ============================

function normalizeSummary(input: ApiSummary | null | undefined): NetworkSummary {
  return {
    followers: Number(input?.followers || 0),
    following: Number(input?.following || 0),
    newFollowers: Number(input?.newFollowers || 0),
    profileViews7d: Number(input?.profileViews7d || 0),
    growth7d: String(input?.growth7d || "+0%"),
    presenceStatus:
      input?.presenceStatus === "Alta" ||
      input?.presenceStatus === "Moderada" ||
      input?.presenceStatus === "Inicial"
        ? input.presenceStatus
        : "Inicial",
  };
}

function normalizeSuggestion(item: ApiSuggestion, index: number): Person {
  const id = Number(item?.id ?? item?.author_id ?? 0);
  const name =
    String(
      item?.name ||
        item?.display_name ||
        item?.name_public ||
        `Pessoa ${index + 1}`
    ).trim() || `Pessoa ${index + 1}`;

  const headline = String(item?.headline || item?.bio_short || "História em construção na HDUD.")
    .trim();

  const location = String(item?.location || "").trim();
  const avatar = toAbsUrl(item?.avatar_url ?? item?.avatar ?? null);

  const isFollowing =
    typeof item?.isFollowing === "boolean"
      ? item.isFollowing
      : Boolean(Number(item?.is_following || 0));

  const signals =
    Array.isArray(item?.signals) && item.signals.length > 0
      ? item.signals.map((x) => String(x))
      : ["Narrativa ativa"];

  const reason =
    String(item?.reason || "Sugestão baseada em afinidade narrativa.").trim() ||
    "Sugestão baseada em afinidade narrativa.";

  const preview =
    String(item?.preview || "História em construção dentro da HDUD.").trim() ||
    "História em construção dentro da HDUD.";

  return {
    id,
    name,
    headline,
    location: location || undefined,
    avatar,
    signals,
    reason,
    preview,
    isFollowing,
  };
}

function buildVanity(summary: NetworkSummary): VanityItem[] {
  return [
    {
      id: 1,
      title: `${summary.newFollowers} novas pessoas começaram a seguir sua história`,
      subtitle: "Sua presença ganhou força recentemente dentro da rede.",
      createdAt: "agora",
    },
    {
      id: 2,
      title: `${summary.profileViews7d} pessoas descobriram seu perfil nos últimos 7 dias`,
      subtitle: "Sua narrativa está circulando mais na plataforma.",
      createdAt: "7 dias",
    },
    {
      id: 3,
      title: `Sua rede mostra crescimento de ${summary.growth7d}`,
      subtitle: "Seu alcance social está evoluindo dentro da HDUD.",
      createdAt: "esta semana",
    },
  ];
}

function buildOrbit(people: Person[]): OrbitItem[] {
  return people.slice(0, 3).map((person, idx) => ({
    id: person.id || idx + 1,
    name: person.name,
    initials: getInitials(person.name),
    note: person.isFollowing
      ? "já faz parte da sua órbita narrativa"
      : "está próximo da sua órbita narrativa",
    createdAt: idx === 0 ? "agora" : idx === 1 ? "hoje" : "esta semana",
  }));
}

// ============================
// Componentes
// ============================

function PresenceCard({ summary }: { summary: NetworkSummary }) {
  return (
    <div style={{ ...styles.card, ...styles.presenceCard }}>
      <div style={styles.cardEyebrow}>Presença social</div>
      <div style={styles.presenceTitle}>Minha Rede</div>

      <div style={styles.presenceStats}>
        <div style={styles.presenceStatBox}>
          <div style={styles.presenceNumber}>{summary.followers}</div>
          <div style={styles.presenceLabel}>seguidores</div>
        </div>

        <div style={styles.presenceStatBox}>
          <div style={styles.presenceNumber}>{summary.following}</div>
          <div style={styles.presenceLabel}>seguindo</div>
        </div>
      </div>

      <div style={styles.presenceHighlight}>+{summary.newFollowers} esta semana</div>

      <div style={styles.presenceDivider} />

      <div style={styles.presenceLine}>
        <span style={styles.presenceLineLabel}>Pessoas que descobriram sua narrativa</span>
        <strong>{summary.profileViews7d}</strong>
      </div>

      <div style={styles.presenceLine}>
        <span style={styles.presenceLineLabel}>Crescimento da rede nos últimos 7 dias</span>
        <strong>{summary.growth7d}</strong>
      </div>

      <div style={styles.presenceBadgeRow}>
        <span style={styles.presenceBadge}>Presença recente: {summary.presenceStatus}</span>
      </div>
    </div>
  );
}

function QuickActionsCard() {
  return (
    <div style={styles.card}>
      <div style={styles.cardTitle}>Atalhos</div>

      <div style={styles.quickAction}>Ver seguidores</div>
      <div style={styles.quickAction}>Ver seguindo</div>
      <div style={styles.quickAction}>Descobrir pessoas</div>
      <div style={styles.quickAction}>Gerenciar rede</div>
    </div>
  );
}

function SuggestionCard({
  person,
  busy,
  onToggleFollow,
}: {
  person: Person;
  busy: boolean;
  onToggleFollow: () => void;
}) {
  const initials = getInitials(person.name);

  return (
    <div style={{ ...styles.card, ...styles.suggestionCard }}>
      <div style={styles.suggestionTop}>
        <div style={styles.avatarLarge}>
          {person.avatar ? (
            <img
              src={person.avatar}
              alt={person.name}
              style={styles.avatarImage}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            initials
          )}
        </div>

        <div style={styles.suggestionMain}>
          <div style={styles.name}>{person.name}</div>
          <div style={styles.headline}>{person.headline}</div>
          {person.location ? <div style={styles.metaText}>{person.location}</div> : null}
        </div>

        <button
          type="button"
          disabled={busy}
          style={person.isFollowing ? styles.followingBtn : styles.followBtn}
          onClick={onToggleFollow}
        >
          {busy ? "Atualizando..." : person.isFollowing ? "Seguindo ✓" : "Seguir narrativa"}
        </button>
      </div>

      <div style={styles.reasonBox}>
        <span style={styles.reasonLabel}>Por que esta sugestão</span>
        <div style={styles.reasonText}>{person.reason}</div>
      </div>

      <div style={styles.signals}>
        {person.signals.map((s, i) => (
          <span key={`${person.id}-${i}-${s}`} style={styles.signal}>
            {s}
          </span>
        ))}
      </div>

      <div style={styles.previewBox}>
        <div style={styles.previewLabel}>Sinal narrativo</div>
        <div style={styles.previewText}>{person.preview}</div>
      </div>
    </div>
  );
}

function VanityCard({ item }: { item: VanityItem }) {
  return (
    <div style={{ ...styles.card, ...styles.vanityCard }}>
      <div style={styles.vanityTitle}>{item.title}</div>
      <div style={styles.vanitySubtitle}>{item.subtitle}</div>
      <div style={styles.time}>{item.createdAt}</div>
    </div>
  );
}

function OrbitCard({ item }: { item: OrbitItem }) {
  return (
    <div style={{ ...styles.card, ...styles.orbitCard }}>
      <div style={styles.orbitTop}>
        <div style={styles.avatarMedium}>{item.initials}</div>

        <div style={styles.orbitMain}>
          <div style={styles.orbitTitle}>
            <strong>{item.name}</strong> {item.note}
          </div>
          <div style={styles.time}>{item.createdAt}</div>
        </div>
      </div>
    </div>
  );
}

function CTAExpandCard() {
  return (
    <div style={{ ...styles.card, ...styles.ctaCard }}>
      <div style={styles.cardEyebrow}>Expansão narrativa</div>
      <div style={styles.cardTitleLarge}>Descubra histórias que conversam com a sua jornada</div>
      <p style={styles.ctaText}>
        Amplie sua rede narrativa e encontre pessoas com afinidade humana real para aproximar sua
        história de novas órbitas.
      </p>
      <button style={styles.ctaBtn}>Explorar conexões</button>
    </div>
  );
}

// ============================
// Página principal
// ============================

export default function NetworkPage() {
  const [summary, setSummary] = useState<NetworkSummary | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      setError(null);

      const [summaryRes, suggestionsRes] = await Promise.all([
        apiFetch("/network/summary"),
        apiFetch("/network/suggestions"),
      ]);

      setSummary(normalizeSummary(summaryRes as ApiSummary));
      setPeople(
        Array.isArray((suggestionsRes as any)?.items)
          ? (suggestionsRes as any).items.map((item: ApiSuggestion, idx: number) =>
              normalizeSuggestion(item, idx)
            )
          : []
      );
    } catch (err: any) {
      console.error("Network load error:", err);
      setError(err?.message || "Falha ao carregar a rede.");
      setSummary(
        normalizeSummary({
          followers: 0,
          following: 0,
          newFollowers: 0,
          profileViews7d: 0,
          growth7d: "+0%",
          presenceStatus: "Inicial",
        })
      );
      setPeople([]);
    } finally {
      setLoading(false);
    }
  }

  async function refreshSummaryOnly() {
    try {
      const newSummary = await apiFetch("/network/summary");
      setSummary(normalizeSummary(newSummary as ApiSummary));
    } catch (err) {
      console.error("Summary refresh error:", err);
    }
  }

  async function toggleFollow(person: Person) {
    if (!person?.id || busyId != null) return;

    const previous = [...people];
    const nextIsFollowing = !person.isFollowing;

    try {
      setBusyId(person.id);
      setError(null);

      setPeople((prev) =>
        prev.map((p) => (p.id === person.id ? { ...p, isFollowing: nextIsFollowing } : p))
      );

      if (person.isFollowing) {
        await apiFetch(`/network/follow/${person.id}`, {
          method: "DELETE",
        });
      } else {
        await apiFetch("/network/follow", {
          method: "POST",
          body: JSON.stringify({ author_id: person.id }),
        });
      }

      await refreshSummaryOnly();
    } catch (err: any) {
      console.error("Follow error:", err);
      setPeople(previous);
      setError(err?.message || "Falha ao atualizar a conexão.");
    } finally {
      setBusyId(null);
    }
  }

  const safeSummary = useMemo(
    () =>
      summary ||
      normalizeSummary({
        followers: 0,
        following: 0,
        newFollowers: 0,
        profileViews7d: 0,
        growth7d: "+0%",
        presenceStatus: "Inicial",
      }),
    [summary]
  );

  const vanityFeed = useMemo(() => buildVanity(safeSummary), [safeSummary]);
  const orbitFeed = useMemo(() => buildOrbit(people), [people]);

  if (loading) {
    return <div style={{ padding: 40 }}>Carregando rede...</div>;
  }

  return (
    <div style={styles.page}>
      {/* LEFT */}
      <aside style={styles.left}>
        <PresenceCard summary={safeSummary} />
        <QuickActionsCard />
      </aside>

      {/* CENTER */}
      <main style={styles.center}>
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <div style={styles.sectionEyebrow}>Descoberta</div>
              <h2 style={styles.sectionTitle}>Pessoas para descobrir</h2>
            </div>
            <div style={styles.sectionMeta}>{people.length} sugestões ativas</div>
          </div>

          {error ? <div style={styles.errorBox}>{error}</div> : null}

          {people.length === 0 ? (
            <div style={styles.card}>
              <div style={styles.cardTitle}>Nenhuma sugestão disponível</div>
              <div style={styles.vanitySubtitle}>
                Assim que a rota de sugestões estiver ativa no backend, a rede aparecerá aqui.
              </div>
            </div>
          ) : (
            people.map((p) => (
              <SuggestionCard
                key={p.id}
                person={p}
                busy={busyId === p.id}
                onToggleFollow={() => void toggleFollow(p)}
              />
            ))
          )}
        </section>
      </main>

      {/* RIGHT */}
      <aside style={styles.right}>
        <div style={styles.stickyRail}>
          <section style={styles.sectionCompact}>
            <div style={styles.sectionEyebrow}>Vaidade social</div>
            <h3 style={styles.railTitle}>Sua rede em movimento</h3>

            {vanityFeed.map((item) => (
              <VanityCard key={item.id} item={item} />
            ))}
          </section>

          <section style={styles.sectionCompact}>
            <div style={styles.sectionEyebrow}>Sua órbita</div>
            <h3 style={styles.railTitle}>Sinais sociais próximos</h3>

            {orbitFeed.length === 0 ? (
              <div style={styles.card}>
                <div style={styles.vanitySubtitle}>
                  Suas próximas conexões aparecerão aqui conforme a rede começar a ganhar vida.
                </div>
              </div>
            ) : (
              orbitFeed.map((item) => <OrbitCard key={item.id} item={item} />)
            )}
          </section>

          <CTAExpandCard />
        </div>
      </aside>
    </div>
  );
}

// ============================
// Styles
// ============================

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: "grid",
    gridTemplateColumns: "280px minmax(0, 1fr) 320px",
    gap: "24px",
    padding: "24px",
    background: "var(--hdud-page-bg, #f5f1e8)",
    minHeight: "100%",
    alignItems: "start",
  },

  left: {
    minWidth: 0,
  },

  center: {
    minWidth: 0,
  },

  right: {
    minWidth: 0,
  },

  stickyRail: {
    position: "sticky",
    top: "24px",
  },

  section: {
    marginBottom: "24px",
  },

  sectionCompact: {
    marginBottom: "20px",
  },

  sectionHeader: {
    display: "flex",
    alignItems: "end",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "14px",
  },

  sectionEyebrow: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#8a7f73",
    marginBottom: 4,
  },

  sectionTitle: {
    margin: 0,
    fontSize: 28,
    lineHeight: 1.1,
    color: "#0f172a",
  },

  sectionMeta: {
    fontSize: 12,
    color: "#7c7c7c",
    whiteSpace: "nowrap",
    paddingBottom: 4,
  },

  railTitle: {
    margin: "0 0 12px 0",
    fontSize: 20,
    lineHeight: 1.2,
    color: "#0f172a",
  },

  card: {
    background: "rgba(255,255,255,0.92)",
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    boxShadow: "0 10px 28px rgba(15, 23, 42, 0.06)",
    border: "1px solid rgba(15, 23, 42, 0.06)",
    transition: "all 0.2s ease",
    backdropFilter: "blur(8px)",
  },

  presenceCard: {
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(251,248,242,0.96) 100%)",
  },

  suggestionCard: {
    padding: 20,
  },

  vanityCard: {
    padding: 16,
    marginBottom: 12,
  },

  orbitCard: {
    padding: 16,
    marginBottom: 12,
  },

  ctaCard: {
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(247,242,234,0.96) 100%)",
  },

  cardEyebrow: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#8a7f73",
    marginBottom: 8,
  },

  cardTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "#0f172a",
    marginBottom: 12,
  },

  cardTitleLarge: {
    fontSize: 24,
    lineHeight: 1.15,
    fontWeight: 800,
    color: "#0f172a",
    marginBottom: 10,
  },

  presenceTitle: {
    fontSize: 28,
    lineHeight: 1.05,
    fontWeight: 800,
    color: "#0f172a",
    marginBottom: 18,
  },

  presenceStats: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    marginBottom: 14,
  },

  presenceStatBox: {
    background: "rgba(15, 23, 42, 0.03)",
    borderRadius: 14,
    padding: "14px 12px",
  },

  presenceNumber: {
    fontSize: 28,
    fontWeight: 800,
    lineHeight: 1,
    color: "#111827",
    marginBottom: 6,
  },

  presenceLabel: {
    fontSize: 12,
    color: "#6b7280",
  },

  presenceHighlight: {
    marginTop: 2,
    color: "#159947",
    fontWeight: 800,
    fontSize: 15,
  },

  presenceDivider: {
    height: 1,
    background: "rgba(15, 23, 42, 0.08)",
    margin: "16px 0",
  },

  presenceLine: {
    display: "flex",
    alignItems: "start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 10,
    fontSize: 14,
    color: "#111827",
  },

  presenceLineLabel: {
    color: "#5f6368",
    lineHeight: 1.35,
  },

  presenceBadgeRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },

  presenceBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    background: "rgba(21, 153, 71, 0.1)",
    color: "#0d7a38",
  },

  quickAction: {
    padding: "10px 0",
    borderBottom: "1px solid rgba(15, 23, 42, 0.06)",
    fontSize: 14,
    fontWeight: 600,
    color: "#1f2937",
  },

  suggestionTop: {
    display: "grid",
    gridTemplateColumns: "64px minmax(0, 1fr) auto",
    gap: 14,
    alignItems: "start",
    marginBottom: 14,
  },

  suggestionMain: {
    minWidth: 0,
  },

  avatarLarge: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #d8d1c5 0%, #beb5a7 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#243041",
    fontWeight: 800,
    fontSize: 18,
    flexShrink: 0,
    overflow: "hidden",
  },

  avatarMedium: {
    width: 46,
    height: 46,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #d8d1c5 0%, #beb5a7 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#243041",
    fontWeight: 800,
    fontSize: 14,
    flexShrink: 0,
  },

  avatarImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },

  name: {
    fontWeight: 800,
    fontSize: 20,
    color: "#0f172a",
    lineHeight: 1.1,
    marginBottom: 4,
  },

  headline: {
    fontSize: 14,
    lineHeight: 1.35,
    color: "#5f6368",
    marginBottom: 4,
  },

  metaText: {
    fontSize: 12,
    color: "#8a8f98",
  },

  reasonBox: {
    background: "rgba(15, 23, 42, 0.03)",
    borderRadius: 14,
    padding: "12px 14px",
    marginBottom: 12,
  },

  reasonLabel: {
    display: "block",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "#8a7f73",
    marginBottom: 6,
  },

  reasonText: {
    fontSize: 13,
    lineHeight: 1.45,
    color: "#374151",
  },

  signals: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 12,
  },

  signal: {
    fontSize: 12,
    background: "rgba(15, 23, 42, 0.05)",
    color: "#334155",
    padding: "6px 10px",
    borderRadius: 999,
    fontWeight: 600,
  },

  previewBox: {
    borderLeft: "3px solid rgba(15, 23, 42, 0.12)",
    paddingLeft: 12,
  },

  previewLabel: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "#8a7f73",
    marginBottom: 6,
  },

  previewText: {
    fontSize: 14,
    lineHeight: 1.5,
    color: "#111827",
    fontStyle: "italic",
  },

  followBtn: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "none",
    background: "#0f172a",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 13,
    whiteSpace: "nowrap",
  },

  followingBtn: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(15, 23, 42, 0.12)",
    background: "rgba(21, 153, 71, 0.08)",
    color: "#0d7a38",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 13,
    whiteSpace: "nowrap",
  },

  orbitTop: {
    display: "grid",
    gridTemplateColumns: "46px minmax(0, 1fr)",
    gap: 12,
    alignItems: "start",
  },

  orbitMain: {
    minWidth: 0,
  },

  orbitTitle: {
    fontSize: 15,
    lineHeight: 1.4,
    color: "#111827",
    marginBottom: 6,
  },

  vanityTitle: {
    fontSize: 15,
    lineHeight: 1.35,
    fontWeight: 800,
    color: "#111827",
    marginBottom: 6,
  },

  vanitySubtitle: {
    fontSize: 13,
    lineHeight: 1.45,
    color: "#5f6368",
    marginBottom: 8,
  },

  time: {
    fontSize: 12,
    color: "#8a8f98",
    marginTop: 2,
  },

  ctaText: {
    fontSize: 14,
    lineHeight: 1.55,
    marginBottom: 14,
    color: "#4b5563",
  },

  ctaBtn: {
    width: "100%",
    padding: 12,
    borderRadius: 12,
    border: "none",
    background: "#0f172a",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 14,
  },

  errorBox: {
    marginBottom: 16,
    padding: 14,
    borderRadius: 14,
    background: "rgba(185, 28, 28, 0.08)",
    color: "#991b1b",
    border: "1px solid rgba(185, 28, 28, 0.18)",
    whiteSpace: "pre-wrap",
  },
};