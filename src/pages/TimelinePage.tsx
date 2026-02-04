import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

type TimelineKind = "Memória" | "Capítulo" | "Versão" | "Rollback" | "Evento";

type TimelineEvent = {
  id: string;
  at: string;
  title: string;
  kind: TimelineKind;
  note?: string;
  source?: "memories" | "chapters" | "versions" | "ledger" | "unknown";
  raw?: any;
};

type TimelineResponse = {
  ok: boolean;
  items?: TimelineEvent[];
  warnings?: string[];
  meta?: any;
};

type FilterKey = "Tudo" | "Memórias" | "Capítulos" | "Versões" | "Rollbacks";

// =====================
// Auth / API helpers
// =====================
function tryExtractTokenFromValue(v: string): string | null {
  const s = (v || "").trim();
  if (!s) return null;

  // JWT típico
  if (s.split(".").length === 3) return s;

  // Às vezes salvam JSON no localStorage
  try {
    const obj = JSON.parse(s);
    const candidates = [
      obj?.access_token,
      obj?.token,
      obj?.jwt,
      obj?.data?.access_token,
      obj?.data?.token,
    ];
    for (const t of candidates) {
      if (typeof t === "string" && t.trim().split(".").length === 3) return t.trim();
    }
  } catch {
    // ignore
  }

  return null;
}

function getAuthToken(): string | null {
  // chaves conhecidas + comuns em apps
  const candidates = [
    "hdud_access_token",
    "HDUD_TOKEN",
    "access_token",
    "token",
    "hdud_token",
    "auth_token",
    "jwt",
    "id_token",
    "session_token",
    "hdud.access_token",
    "hdud.token",
    "hdud.auth",
    "auth",
  ];

  for (const k of candidates) {
    const v = window.localStorage.getItem(k);
    if (!v) continue;

    const token = tryExtractTokenFromValue(v);
    if (token) return token;
  }

  // fallback: varrer localStorage por algo que pareça JWT
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      const v = window.localStorage.getItem(key) || "";
      const token = tryExtractTokenFromValue(v);
      if (token) return token;
    }
  } catch {
    // ignore
  }

  return null;
}

function getApiBase(): string {
  const env = (import.meta as any).env || {};
  const base =
    env.VITE_API_BASE ||
    env.VITE_API_URL ||
    env.VITE_BACKEND_URL ||
    env.VITE_API ||
    "";
  return String(base || "").trim().replace(/\/+$/, "");
}

function normalizeUrl(path: string): string {
  const base = getApiBase();
  if (!path.startsWith("/")) path = `/${path}`;
  return base ? `${base}${path}` : path;
}

async function fetchTimeline(
  token: string | null
): Promise<{
  ok: boolean;
  status: number;
  data: any;
  usedUrl: string;
  authSent: boolean;
}> {
  const usedUrl = normalizeUrl("/timeline");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const authSent = Boolean(token);

  if (token) headers.Authorization = `Bearer ${token}`;

  const r = await fetch(usedUrl, { headers });
  const text = await r.text();

  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  return { ok: r.ok, status: r.status, data, usedUrl, authSent };
}

// =====================
// Date / formatting
// =====================
function safeDateParse(value: string): Date | null {
  if (!value) return null;
  const d1 = new Date(value);
  if (!isNaN(d1.getTime())) return d1;

  const d2 = new Date(String(value).replace(" ", "T"));
  if (!isNaN(d2.getTime())) return d2;

  return null;
}

function formatDayLabel(d: Date): string {
  return d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatTimeLabel(d: Date): string {
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatRelative(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const s = Math.max(0, Math.floor(diffMs / 1000));
  if (s < 60) return `há ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `há ${h}h`;
  const days = Math.floor(h / 24);
  return `há ${days}d`;
}

function sortEventsDesc(a: TimelineEvent, b: TimelineEvent) {
  const da = safeDateParse(a.at)?.getTime() ?? -Infinity;
  const db = safeDateParse(b.at)?.getTime() ?? -Infinity;
  return db - da;
}

function clampText(s: string, max = 160) {
  const t = (s || "").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

function kindIcon(kind: TimelineKind): string {
  if (kind === "Memória") return "🧠";
  if (kind === "Capítulo") return "📚";
  if (kind === "Versão") return "🧾";
  if (kind === "Rollback") return "⏪";
  return "•";
}

// =====================
// Routing helpers (click to open)
// =====================
function extractIdFromTimelineKey(id: string): { kind: "memory" | "chapter" | "unknown"; id: number | null } {
  const s = String(id || "").trim();

  const m1 = s.match(/^memory:(\d+)$/i);
  if (m1) return { kind: "memory", id: Number(m1[1]) };

  const c1 = s.match(/^chapter:(\d+)$/i);
  if (c1) return { kind: "chapter", id: Number(c1[1]) };

  return { kind: "unknown", id: null };
}

function extractTarget(ev: TimelineEvent): { kind: "memory" | "chapter" | "unknown"; id: number | null } {
  const byKey = extractIdFromTimelineKey(ev.id);
  if (byKey.id) return byKey;

  const raw = ev.raw || {};
  const mid = raw?.memory_id ?? raw?.memoryId ?? raw?.id_memory ?? null;
  if (typeof mid === "number" && Number.isFinite(mid)) return { kind: "memory", id: mid };

  const cid = raw?.chapter_id ?? raw?.chapterId ?? raw?.id_chapter ?? null;
  if (typeof cid === "number" && Number.isFinite(cid)) return { kind: "chapter", id: cid };

  return { kind: "unknown", id: null };
}

// =====================
// Page
// =====================
export default function TimelinePage() {
  const navigate = useNavigate();

  const filters: FilterKey[] = ["Tudo", "Memórias", "Capítulos", "Versões", "Rollbacks"];

  const [activeFilter, setActiveFilter] = useState<FilterKey>("Tudo");
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [query, setQuery] = useState("");

  // debug/telemetria leve
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugInfo, setDebugInfo] = useState<{
    usedUrl: string;
    authSent: boolean;
    httpStatus: number | null;
    tokenPresent: boolean;
  }>({
    usedUrl: normalizeUrl("/timeline"),
    authSent: false,
    httpStatus: null,
    tokenPresent: Boolean(getAuthToken()),
  });

  // open/collapse details por id
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});

  // evita double-click spam
  const clickLockRef = useRef(false);

  function toggleOpen(id: string) {
    setOpenMap((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function openEvent(ev: TimelineEvent) {
    const t = extractTarget(ev);

    // trava rápida pra evitar navegação duplicada
    if (clickLockRef.current) return;
    clickLockRef.current = true;
    setTimeout(() => (clickLockRef.current = false), 350);

    if (t.kind === "memory" && t.id) {
      navigate(`/memories/${t.id}`);
      return;
    }

    if (t.kind === "chapter" && t.id) {
      try {
        sessionStorage.setItem("hdud_open_chapter_id", String(t.id));
      } catch {
        // ignore
      }
      navigate(`/chapters`);
      return;
    }

    // fallback: abre detalhes
    toggleOpen(ev.id);
  }

  async function load() {
    setLoading(true);
    setErrorMsg(null);

    const token = getAuthToken();

    try {
      const { ok, status, data, usedUrl, authSent } = await fetchTimeline(token);

      setDebugInfo({
        usedUrl,
        authSent,
        httpStatus: status,
        tokenPresent: Boolean(token),
      });

      if (!ok) {
        const detail =
          typeof data === "object" && data
            ? data?.detail || data?.error || JSON.stringify(data)
            : String(data);

        setErrorMsg(`Falha ao carregar timeline (HTTP ${status}). ${detail || ""}`.trim());
        setEvents([]);
        setWarnings([]);
        setLoading(false);
        return;
      }

      const payload = data as TimelineResponse;
      const items = Array.isArray(payload?.items) ? payload.items : [];
      const warns = Array.isArray(payload?.warnings) ? payload.warnings : [];

      setEvents(items.sort(sortEventsDesc));
      setWarnings(warns);
      setLastUpdated(new Date());
    } catch (e: any) {
      setErrorMsg("Falha de rede ao carregar timeline. Verifique API e token.");
      setEvents([]);
      setWarnings([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!mounted) return;
      await load();
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = useMemo(() => {
    return {
      Tudo: events.length,
      Memórias: events.filter((e) => e.kind === "Memória").length,
      Capítulos: events.filter((e) => e.kind === "Capítulo").length,
      Versões: events.filter((e) => e.kind === "Versão").length,
      Rollbacks: events.filter((e) => e.kind === "Rollback").length,
    };
  }, [events]);

  const filteredEvents = useMemo(() => {
    let list = events;

    if (activeFilter === "Memórias") list = list.filter((e) => e.kind === "Memória");
    if (activeFilter === "Capítulos") list = list.filter((e) => e.kind === "Capítulo");
    if (activeFilter === "Versões") list = list.filter((e) => e.kind === "Versão");
    if (activeFilter === "Rollbacks") list = list.filter((e) => e.kind === "Rollback");

    const q = query.trim().toLowerCase();
    if (!q) return list;

    return list.filter((e) => {
      const hay = [
        e.title,
        e.note,
        e.id,
        e.kind,
        e.source,
        JSON.stringify(e.raw || {}),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [events, activeFilter, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();

    for (const ev of filteredEvents) {
      const d = safeDateParse(ev.at);
      const key = d ? formatDayLabel(d) : "Sem data";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }

    const entries = Array.from(map.entries()).map(([day, list]) => ({
      day,
      list: list.sort(sortEventsDesc),
      sortKey:
        day === "Sem data"
          ? -Infinity
          : safeDateParse(list[0]?.at)?.getTime() ?? -Infinity,
    }));

    entries.sort((a, b) => b.sortKey - a.sortKey);
    return entries;
  }, [filteredEvents]);

  const statusLine = useMemo(() => {
    if (loading) return "Carregando…";
    if (errorMsg) return "Erro";
    return "Ativo";
  }, [loading, errorMsg]);

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.card}>
        <div style={styles.headerRow}>
          <div style={{ minWidth: 0 }}>
            <div style={styles.h1}>Timeline</div>
            <div style={styles.sub}>
              Uma linha do tempo única do que aconteceu na sua história — memórias, capítulos e (em breve) versões/diffs/rollbacks —
              consumindo apenas o core (<code>/timeline</code>).
            </div>

            <div style={styles.badgeRow}>
              <span style={styles.badgeSoft}>
                Status: <b style={{ opacity: 1 }}>{statusLine}</b>
                {lastUpdated && !loading && !errorMsg ? (
                  <span style={{ opacity: 0.75 }}>
                    {" "}
                    • Atualizado:{" "}
                    <b>
                      {lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </b>
                  </span>
                ) : null}
              </span>

              <span style={styles.badgeSoft}>
                Token: <b>{debugInfo.tokenPresent ? "detectado" : "ausente"}</b>
              </span>

              <button
                type="button"
                style={styles.btnGhost}
                onClick={() => setDebugOpen((v) => !v)}
              >
                {debugOpen ? "Ocultar diagnóstico" : "Diagnóstico"}
              </button>
            </div>

            {debugOpen && (
              <div style={styles.diagBox}>
                <div style={styles.diagLine}>
                  <b>Endpoint</b>: {debugInfo.usedUrl}
                </div>
                <div style={styles.diagLine}>
                  <b>Authorization enviado</b>: {debugInfo.authSent ? "sim" : "não"}
                </div>
                <div style={styles.diagLine}>
                  <b>HTTP</b>: {debugInfo.httpStatus == null ? "—" : debugInfo.httpStatus}
                </div>
                <div style={styles.diagHint}>
                  Se o token estiver ausente, a Timeline pode voltar vazia ou sem acesso dependendo do core.
                </div>
              </div>
            )}
          </div>

          <div style={styles.headerActions}>
            <button
              type="button"
              style={{ ...styles.btn, ...(loading ? styles.btnDisabled : {}) }}
              onClick={load}
              disabled={loading}
            >
              {loading ? "Atualizando…" : "Atualizar"}
            </button>
          </div>
        </div>
      </div>

      {/* Filters + Search */}
      <div style={styles.card}>
        <div style={styles.rowBetween}>
          <div>
            <div style={styles.cardTitle}>Filtros</div>
            <div style={styles.cardMeta}>
              Visualize por tipo mantendo a timeline <b>unificada</b> e <b>clicável</b>.
            </div>
          </div>

          <div style={styles.smallMuted}>
            Itens: <b>{filteredEvents.length}</b> / {events.length}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          {(["Tudo", "Memórias", "Capítulos", "Versões", "Rollbacks"] as FilterKey[]).map((f) => {
            const isActive = f === activeFilter;
            const count =
              f === "Tudo"
                ? counts.Tudo
                : f === "Memórias"
                  ? counts.Memórias
                  : f === "Capítulos"
                    ? counts.Capítulos
                    : f === "Versões"
                      ? counts.Versões
                      : counts.Rollbacks;

            return (
              <button
                key={f}
                type="button"
                style={{
                  ...styles.chip,
                  ...(isActive ? styles.chipActive : {}),
                }}
                onClick={() => setActiveFilter(f)}
              >
                {f}
                <span style={styles.chipCount}>{count}</span>
              </button>
            );
          })}
        </div>

        <div style={styles.searchRow}>
          <div style={{ flex: 1 }}>
            <div style={styles.labelTop}>Buscar</div>
            <input
              style={styles.input}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Título, nota, id, fonte…"
            />
          </div>
          <div style={styles.smallMuted}>
            Dica: clique no card para abrir.
          </div>
        </div>

        {warnings.length > 0 && (
          <div style={styles.warnBox}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Avisos do agregador</div>
            {warnings.slice(0, 8).map((w, i) => (
              <div key={`warn-${i}`}>• {w}</div>
            ))}
          </div>
        )}
      </div>

      {/* Events */}
      <div style={styles.card}>
        <div style={styles.rowBetween}>
          <div>
            <div style={styles.cardTitle}>Eventos</div>
            <div style={styles.cardMeta}>Do mais recente para o mais antigo, agrupados por dia.</div>
          </div>
          <div style={styles.smallMuted}>{loading ? "Carregando…" : "Ativo"}</div>
        </div>

        {errorMsg ? (
          <div style={styles.errorBox}>
            <div style={{ fontWeight: 900 }}>Não foi possível carregar a Timeline</div>
            <div style={{ marginTop: 6, opacity: 0.85 }}>{errorMsg}</div>
            <button type="button" style={{ ...styles.btn, marginTop: 12 }} onClick={load}>
              Tentar novamente
            </button>
          </div>
        ) : loading ? (
          <div style={styles.infoBox}>Carregando eventos…</div>
        ) : filteredEvents.length === 0 ? (
          <div style={styles.infoBox}>
            <div style={{ fontWeight: 900 }}>Nada para mostrar</div>
            <div style={{ marginTop: 6, opacity: 0.85 }}>
              Ajuste filtro/busca, ou crie uma memória/capítulo para a timeline ganhar vida.
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 12 }}>
            {grouped.map((g) => (
              <section key={g.day} style={{ marginTop: 16 }}>
                <div style={styles.dayHeader}>
                  <span style={styles.dayPill}>{g.day}</span>
                  <span style={styles.smallMuted}>{g.list.length} item(ns)</span>
                </div>

                <div style={styles.dayList}>
                  {g.list.map((it) => {
                    const dt = safeDateParse(it.at);
                    const time = dt ? formatTimeLabel(dt) : it.at;
                    const rel = dt ? formatRelative(dt) : "";
                    const note = it.note ? clampText(it.note, 220) : "";
                    const isOpen = Boolean(openMap[it.id]);

                    const target = extractTarget(it);
                    const canOpen =
                      Boolean(target.id) && (target.kind === "memory" || target.kind === "chapter");

                    const openLabel =
                      target.kind === "memory"
                        ? "Abrir memória"
                        : target.kind === "chapter"
                          ? "Abrir capítulo"
                          : "Detalhes";

                    return (
                      <div
                        key={it.id}
                        style={styles.eventCard}
                        onClick={() => openEvent(it)}
                        title={canOpen ? "Clique para abrir" : "Clique para ver detalhes"}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") openEvent(it);
                        }}
                      >
                        <div style={styles.eventTop}>
                          <div style={styles.eventLeft}>
                            <div style={styles.eventMetaRow}>
                              <span style={styles.eventMeta}>
                                {kindIcon(it.kind)} <b>{time}</b>{" "}
                                {rel ? <span style={{ opacity: 0.7 }}>({rel})</span> : null}
                              </span>
                              <span style={styles.badgeSoftSmall}>
                                Fonte: <b>{it.source || "unknown"}</b>
                              </span>
                              <span style={styles.badgeSoftSmall}>
                                ID: <b>{it.id}</b>
                              </span>
                            </div>

                            <div style={styles.eventTitle}>{it.title || "(sem título)"}</div>

                            {note ? <div style={styles.eventNote}>{note}</div> : null}

                            <div style={styles.eventActions}>
                              <button
                                type="button"
                                style={styles.btnMiniPrimary}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEvent(it);
                                }}
                              >
                                {openLabel}
                              </button>

                              <button
                                type="button"
                                style={styles.btnMini}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleOpen(it.id);
                                }}
                              >
                                {isOpen ? "Ocultar" : "Ver"} detalhes
                              </button>
                            </div>
                          </div>

                          <div style={styles.kindPill}>{it.kind}</div>
                        </div>

                        {isOpen && (
                          <div style={styles.detailsBox} onClick={(e) => e.stopPropagation()}>
                            <div style={{ fontWeight: 900, marginBottom: 6 }}>Detalhes do evento</div>
                            <div style={styles.smallMuted}>
                              target: <b>{target.kind}:{target.id ?? "—"}</b>
                            </div>
                            <div style={{ marginTop: 8, opacity: 0.85 }}>
                              <pre style={styles.pre}>{JSON.stringify(it.raw ?? null, null, 2)}</pre>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        <div style={styles.footerNote}>
          Observação: esta tela <b>apenas consome</b> o endpoint unificado <code>/timeline</code>.
          Versões/diff/rollback entram quando o core expuser esses eventos.
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: 18, color: "var(--hdud-text)" },

  card: {
    background: "var(--hdud-card)",
    borderRadius: 14,
    padding: 16,
    boxShadow: "var(--hdud-shadow)",
    border: "1px solid var(--hdud-border)",
    marginBottom: 14,
  },

  headerRow: { display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start" },
  headerActions: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },

  h1: { fontSize: 28, fontWeight: 900, letterSpacing: -0.4, marginBottom: 6 },
  sub: { opacity: 0.78, fontSize: 13, lineHeight: 1.35 },

  badgeRow: { marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" },
  badgeSoft: {
    fontSize: 12,
    fontWeight: 800,
    padding: "6px 10px",
    borderRadius: 999,
    background: "var(--hdud-surface-2)",
    border: "1px solid var(--hdud-border)",
    color: "var(--hdud-text)",
    opacity: 0.92,
  },
  badgeSoftSmall: {
    fontSize: 11,
    fontWeight: 800,
    padding: "4px 8px",
    borderRadius: 999,
    background: "var(--hdud-surface-2)",
    border: "1px solid var(--hdud-border)",
    color: "var(--hdud-text)",
    opacity: 0.92,
    whiteSpace: "nowrap",
  },

  btn: {
    border: "1px solid var(--hdud-border)",
    background: "var(--hdud-surface-2)",
    color: "var(--hdud-text)",
    padding: "8px 12px",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 800,
  },
  btnDisabled: { opacity: 0.55, cursor: "not-allowed" },

  btnGhost: {
    border: "1px solid var(--hdud-border)",
    background: "transparent",
    color: "var(--hdud-text)",
    padding: "6px 10px",
    borderRadius: 999,
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 12,
    opacity: 0.78,
  },

  diagBox: {
    marginTop: 10,
    border: "1px dashed var(--hdud-border)",
    background: "var(--hdud-surface-2)",
    borderRadius: 12,
    padding: 10,
  },
  diagLine: { fontSize: 12, opacity: 0.85, marginTop: 2 },
  diagHint: { marginTop: 6, fontSize: 11, opacity: 0.62 },

  rowBetween: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" },
  cardTitle: { fontWeight: 900, fontSize: 14 },
  cardMeta: { fontSize: 12, opacity: 0.72, marginTop: 4 },
  smallMuted: { fontSize: 12, opacity: 0.7 },

  chip: {
    border: "1px solid var(--hdud-border)",
    background: "var(--hdud-surface-2)",
    color: "var(--hdud-text)",
    padding: "7px 10px",
    borderRadius: 999,
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 12,
    display: "inline-flex",
    gap: 8,
    alignItems: "center",
    opacity: 0.82,
  },
  chipActive: { opacity: 1, outline: "2px solid var(--hdud-accent-border)" },
  chipCount: {
    fontSize: 11,
    fontWeight: 900,
    padding: "2px 8px",
    borderRadius: 999,
    border: "1px solid var(--hdud-border)",
    background: "transparent",
    opacity: 0.85,
    minWidth: 28,
    textAlign: "center",
  },

  searchRow: { display: "flex", gap: 12, marginTop: 12, alignItems: "flex-end", flexWrap: "wrap" },
  labelTop: { fontSize: 12, fontWeight: 900, opacity: 0.85, marginBottom: 6 },
  input: {
    width: "100%",
    border: "1px solid var(--hdud-border)",
    background: "var(--hdud-surface-2)",
    color: "var(--hdud-text)",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 13,
    outline: "none",
  },

  warnBox: {
    marginTop: 12,
    border: "1px dashed var(--hdud-border)",
    background: "var(--hdud-surface-2)",
    borderRadius: 12,
    padding: 10,
    fontSize: 12,
    opacity: 0.9,
  },

  errorBox: {
    marginTop: 12,
    border: "1px solid rgba(255,0,80,0.22)",
    background: "rgba(255,0,80,0.10)",
    borderRadius: 12,
    padding: 14,
  },
  infoBox: {
    marginTop: 12,
    border: "1px dashed var(--hdud-border)",
    background: "var(--hdud-surface-2)",
    borderRadius: 12,
    padding: 14,
    fontSize: 12,
    opacity: 0.92,
  },

  dayHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 8 },
  dayPill: {
    fontSize: 11,
    fontWeight: 900,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid var(--hdud-border)",
    background: "transparent",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    opacity: 0.85,
  },

  dayList: { display: "flex", flexDirection: "column", gap: 10 },

  eventCard: {
    border: "1px solid var(--hdud-border)",
    background: "var(--hdud-surface-2)",
    borderRadius: 14,
    padding: 12,
    cursor: "pointer",
    boxShadow: "var(--hdud-shadow-soft)",
  },
  eventTop: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" },
  eventLeft: { minWidth: 0, flex: 1 },

  eventMetaRow: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" },
  eventMeta: { fontSize: 12, opacity: 0.8 },

  eventTitle: { marginTop: 6, fontSize: 14, fontWeight: 900, lineHeight: 1.25 },
  eventNote: { marginTop: 6, fontSize: 12, opacity: 0.82, lineHeight: 1.35 },

  kindPill: {
    fontSize: 11,
    fontWeight: 900,
    padding: "5px 10px",
    borderRadius: 999,
    border: "1px solid var(--hdud-border)",
    background: "var(--hdud-card)",
    whiteSpace: "nowrap",
    opacity: 0.9,
  },

  eventActions: { marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" },
  btnMiniPrimary: {
    border: "1px solid var(--hdud-border)",
    background: "var(--hdud-primary-bg)",
    color: "var(--hdud-primary-text)",
    padding: "7px 10px",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 12,
  },
  btnMini: {
    border: "1px solid var(--hdud-border)",
    background: "transparent",
    color: "var(--hdud-text)",
    padding: "7px 10px",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 12,
    opacity: 0.85,
  },

  detailsBox: {
    marginTop: 12,
    border: "1px dashed var(--hdud-border)",
    background: "var(--hdud-card)",
    borderRadius: 12,
    padding: 12,
  },
  pre: {
    margin: 0,
    border: "1px solid var(--hdud-border)",
    borderRadius: 10,
    padding: 10,
    maxHeight: 240,
    overflow: "auto",
    fontSize: 11,
    opacity: 0.92,
    background: "var(--hdud-surface-2)",
  },

  footerNote: {
    marginTop: 14,
    border: "1px dashed var(--hdud-border)",
    background: "var(--hdud-surface-2)",
    borderRadius: 12,
    padding: 10,
    fontSize: 12,
    opacity: 0.75,
  },
};
