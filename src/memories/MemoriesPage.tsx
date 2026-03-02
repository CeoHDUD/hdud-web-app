// C:\HDUD_DATA\hdud-web-app\src\memories\MemoriesPage.tsx

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

type MemoryListItem = {
  memory_id: number;
  author_id?: number;
  title: string | null;
  content: string;
  created_at: string;
  meta?: {
    can_edit?: boolean;
    current_version?: number;
    life_phase?: string | null;
    phase_name?: string | null;
    chapter_id?: number | null;
  };
};

type MemoriesResponse = {
  author_id: number;
  memories: any[];
};

type TimelineResponse = {
  ok?: boolean;
  items?: any[];
};

const API_BASE = "/api";

// Catálogo fixo (pra nunca ficar sem opções)
const LIFE_PHASES = [
  { value: "__ALL__", label: "Fase: Todas" },
  { value: "", label: "— (sem fase)" },
  { value: "CHILDHOOD", label: "Infância" },
  { value: "STUDIES", label: "Estudos" },
  { value: "CAREER", label: "Carreira" },
  { value: "RELATIONSHIPS", label: "Relacionamentos" },
  { value: "FAMILY", label: "Família" },
  { value: "CRISIS", label: "Crises" },
  { value: "ACHIEVEMENTS", label: "Conquistas" },
  { value: "OTHER", label: "Outros" },
] as const;

function getTokenFromStorage(): string | null {
  return (
    localStorage.getItem("HDUD_TOKEN") ||
    localStorage.getItem("hdud_access_token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("token")
  );
}

function getAuthorIdFromStorage(): number | null {
  const raw =
    localStorage.getItem("HDUD_AUTHOR_ID") ||
    localStorage.getItem("author_id") ||
    localStorage.getItem("AUTHOR_ID");
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

async function api<T>(
  method: "GET" | "POST",
  path: string,
  token: string,
  body?: any
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const json = text
    ? (() => {
        try {
          return JSON.parse(text);
        } catch {
          return { raw: text };
        }
      })()
    : null;

  if (!res.ok) {
    const detail =
      json && (json.detail || json.error)
        ? json.detail || json.error
        : `HTTP ${res.status}`;
    const err: any = new Error(detail);
    err.status = res.status;
    err.payload = json;
    throw err;
  }

  return json as T;
}

function formatDateBR(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return iso;
  }
}

function formatDateBRShort(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(d);
  } catch {
    return iso;
  }
}

function coerceNumber(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function safeTrim(v: any): string {
  return String(v ?? "").trim();
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function daysAgoLabel(fromIso: string): string {
  try {
    const d = new Date(fromIso);
    const now = new Date();
    if (Number.isNaN(d.getTime())) return "há algum tempo";
    if (isSameDay(d, now)) return "hoje";
    const diffMs = now.getTime() - d.getTime();
    const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    if (days <= 0) return "hoje";
    if (days === 1) return "há 1 dia";
    return `há ${days} dias`;
  } catch {
    return "há algum tempo";
  }
}

function greetingPTBR(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Bom dia";
  if (h >= 12 && h < 18) return "Boa tarde";
  return "Boa noite";
}

// Normaliza meta de fase vindo tanto em raw.meta quanto “solto”
function extractPhaseMeta(raw: any): { life_phase?: string | null; phase_name?: string | null } {
  const meta = raw?.meta ?? null;

  const life_phase =
    (meta?.life_phase ?? meta?.lifePhase ?? raw?.life_phase ?? raw?.lifePhase ?? null) as
      | string
      | null;

  const phase_name =
    (meta?.phase_name ?? meta?.phaseName ?? raw?.phase_name ?? raw?.phaseName ?? null) as
      | string
      | null;

  return {
    life_phase: life_phase === undefined ? null : life_phase,
    phase_name: phase_name === undefined ? null : phase_name,
  };
}

function normalizeFromLegacy(raw: any): MemoryListItem | null {
  const id = coerceNumber(raw?.memory_id) ?? coerceNumber(raw?.id);
  if (!id) return null;

  const created =
    raw?.created_at ||
    raw?.createdAt ||
    raw?.created ||
    new Date().toISOString();

  const phaseMeta = extractPhaseMeta(raw);

  return {
    memory_id: id,
    author_id: coerceNumber(raw?.author_id) ?? undefined,
    title: raw?.title === null || raw?.title === undefined ? null : String(raw?.title),
    content: String(raw?.content ?? ""),
    created_at: String(created),
    meta: {
      can_edit: typeof raw?.meta?.can_edit === "boolean" ? raw.meta.can_edit : undefined,
      current_version: coerceNumber(raw?.meta?.current_version) ?? undefined,
      life_phase: phaseMeta.life_phase ?? null,
      phase_name: phaseMeta.phase_name ?? null,
      chapter_id: coerceNumber(raw?.meta?.chapter_id) ?? undefined,
    },
  };
}

/**
 * Timeline item:
 * item.raw.memory_id, item.raw.content, item.raw.created_at, item.raw.meta...
 * item.source === "memories" quando for memória.
 */
function normalizeFromTimelineItem(item: any): MemoryListItem | null {
  const raw = item?.raw ?? null;
  if (!raw) return null;

  const id = coerceNumber(raw?.memory_id) ?? null;
  if (!id) return null;

  const created =
    raw?.created_at || item?.at || item?.timestamp || new Date().toISOString();

  const metaRaw = raw?.meta ?? null;
  const phaseMeta = extractPhaseMeta(raw);

  return {
    memory_id: id,
    author_id: coerceNumber(raw?.author_id) ?? undefined,
    title: raw?.title === null || raw?.title === undefined ? null : String(raw?.title),
    content: String(raw?.content ?? ""),
    created_at: String(created),
    meta: {
      can_edit: typeof metaRaw?.can_edit === "boolean" ? metaRaw.can_edit : undefined,
      current_version: coerceNumber(metaRaw?.current_version) ?? undefined,
      life_phase: phaseMeta.life_phase ?? null,
      phase_name: phaseMeta.phase_name ?? null,
      chapter_id: coerceNumber(metaRaw?.chapter_id) ?? undefined,
    },
  };
}

type ConfettiParticle = {
  id: string;
  left: number; // vw
  top: number; // px
  size: number; // px
  delay: number; // ms
  drift: number; // px
  rot: number; // deg
  opacity: number;
};

function uid(): string {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function buildConfetti(count: number): ConfettiParticle[] {
  const safeCount = Math.max(3, Math.min(6, count));
  const arr: ConfettiParticle[] = [];
  for (let i = 0; i < safeCount; i++) {
    arr.push({
      id: uid(),
      left: 45 + Math.random() * 20, // “no centro” do header
      top: 72 + Math.random() * 30,
      size: 6 + Math.random() * 6,
      delay: Math.floor(Math.random() * 90),
      drift: 24 + Math.random() * 40,
      rot: -25 + Math.random() * 50,
      opacity: 0.35 + Math.random() * 0.35,
    });
  }
  return arr;
}

export default function MemoriesPage(props: {
  token?: string | null;
  onLogout?: () => void;
}) {
  const navigate = useNavigate();
  const token = useMemo(() => props.token || getTokenFromStorage(), [props.token]);

  const [authorId, setAuthorId] = useState<number | null>(() => getAuthorIdFromStorage());
  const [items, setItems] = useState<MemoryListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Layout: list | create
  const [mode, setMode] = useState<"list" | "create">("list");

  // Create form
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [creating, setCreating] = useState(false);

  // Filtros/ordenação
  const [q, setQ] = useState("");
  const [phase, setPhase] = useState<string>("__ALL__");
  const [onlyEditable, setOnlyEditable] = useState(false);
  const [orderBy, setOrderBy] = useState<"newest" | "oldest" | "title">("newest");

  // Jardim vivo
  const [hoverId, setHoverId] = useState<number | null>(null);
  const [confetti, setConfetti] = useState<ConfettiParticle[]>([]);
  const confettiTimerRef = useRef<number | null>(null);

  const hardLogout = useCallback(() => {
    localStorage.removeItem("HDUD_TOKEN");
    localStorage.removeItem("hdud_access_token");
    localStorage.removeItem("access_token");
    localStorage.removeItem("token");
    localStorage.removeItem("HDUD_AUTHOR_ID");
    localStorage.removeItem("author_id");
    if (props.onLogout) props.onLogout();
    navigate("/login");
  }, [navigate, props]);

  useEffect(() => {
    const aid = getAuthorIdFromStorage();
    setAuthorId(aid);
  }, []);

  const load = useCallback(async () => {
    setError(null);

    if (!token) {
      setError("Sessão expirada. Faça login novamente.");
      hardLogout();
      return;
    }

    setLoading(true);

    try {
      // 1) Preferencial: /timeline
      let list: MemoryListItem[] = [];

      try {
        const data = await api<TimelineResponse>("GET", `/timeline`, token);
        const all = Array.isArray(data?.items) ? data!.items! : [];
        const memoriesOnly = all.filter((it: any) => it?.source === "memories");

        list = memoriesOnly
          .map((it: any) => normalizeFromTimelineItem(it))
          .filter(Boolean) as MemoryListItem[];
      } catch {
        list = [];
      }

      // 2) Fallback legado
      if (list.length === 0) {
        if (!authorId || !Number.isFinite(authorId)) {
          setError("author_id ausente. Faça login novamente.");
          hardLogout();
          return;
        }

        const legacy = await api<MemoriesResponse>(
          "GET",
          `/authors/${authorId}/memories`,
          token
        );

        const rawList = Array.isArray(legacy?.memories) ? legacy.memories : [];
        list = rawList
          .map((m: any) => normalizeFromLegacy(m))
          .filter(Boolean) as MemoryListItem[];
      }

      setItems(list);
    } catch (e: any) {
      if (e?.status === 401) {
        setError("Sessão expirada. Faça login novamente.");
        hardLogout();
      } else {
        setError(e?.message || "Falha ao carregar memórias.");
      }
    } finally {
      setLoading(false);
    }
  }, [authorId, hardLogout, token]);

  useEffect(() => {
    if (token) load();
  }, [token, load]);

  // Catálogo fixo + fases encontradas (phase_name “custom” vindas dos dados)
  const phaseOptions = useMemo(() => {
    const base = LIFE_PHASES.map((x) => ({ value: x.value, label: x.label }));

    const found = new Map<string, string>();
    for (const it of items) {
      const pn = safeTrim(it.meta?.phase_name);
      if (pn) found.set(pn, pn);
    }

    const extras = Array.from(found.entries())
      .map(([value, label]) => ({ value, label: `Fase: ${label}` }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR", { sensitivity: "base" }));

    // evita duplicar caso exista "Fase: Todas" etc.
    const baseValues = new Set(base.map((b) => b.value));
    const filteredExtras = extras.filter((x) => !baseValues.has(x.value));

    return [...base, ...filteredExtras];
  }, [items]);

  const viewItems = useMemo(() => {
    let list = items.slice();

    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter((m) => {
        const t = (m.title ?? "").toLowerCase();
        const c = (m.content ?? "").toLowerCase();
        return t.includes(needle) || c.includes(needle);
      });
    }

    if (phase !== "__ALL__") {
      if (phase === "") {
        list = list.filter(
          (m) =>
            !safeTrim(m.meta?.life_phase) &&
            !safeTrim(m.meta?.phase_name)
        );
      } else {
        list = list.filter((m) => {
          const lp = safeTrim(m.meta?.life_phase);
          const pn = safeTrim(m.meta?.phase_name);
          return lp === phase || pn === phase;
        });
      }
    }

    if (onlyEditable) {
      list = list.filter((m) => m.meta?.can_edit === true);
    }

    if (orderBy === "oldest") {
      list.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    } else if (orderBy === "title") {
      list.sort((a, b) =>
        String(a.title ?? "").localeCompare(String(b.title ?? ""), "pt-BR", {
          sensitivity: "base",
        })
      );
    } else {
      list.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }

    return list;
  }, [items, q, onlyEditable, orderBy, phase]);

  const countLabel = useMemo(() => {
    const filtered =
      q.trim().length > 0 || onlyEditable || orderBy !== "newest" || phase !== "__ALL__";
    return filtered ? `${viewItems.length}/${items.length} memória(s)` : `${items.length} memória(s)`;
  }, [items.length, viewItems.length, q, onlyEditable, orderBy, phase]);

  const latestMemory = useMemo(() => {
    if (items.length === 0) return null;
    const sorted = items
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return sorted[0] ?? null;
  }, [items]);

  const pulseLabel = useMemo(() => {
    if (!latestMemory) return "Seu jardim ainda está vazio — comece com uma primeira memória.";
    return `Última memória ${daysAgoLabel(latestMemory.created_at)}.`;
  }, [latestMemory]);

  const moment = useMemo(() => {
    const sorted = viewItems
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const destaque = sorted[0] ?? null;

    // “Revisitar” = antiga aleatória (entre as mais antigas) – heurística local
    let revisitar: MemoryListItem | null = null;
    if (sorted.length >= 2) {
      const oldest = viewItems
        .slice()
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      const pool = oldest.slice(0, Math.min(6, oldest.length));
      revisitar = pool[Math.floor(Math.random() * pool.length)] ?? null;
    }

    return { destaque, revisitar };
  }, [viewItems]);

  const microcopy = useMemo(() => {
    const parts: string[] = [];
    const needle = q.trim();
    if (needle) parts.push(`busca: “${needle}”`);
    if (phase !== "__ALL__") {
      if (phase === "") parts.push("fase: sem fase");
      else parts.push(`fase: ${phase}`);
    }
    if (onlyEditable) parts.push("somente editáveis");
    if (orderBy === "oldest") parts.push("ordem: antigas primeiro");
    if (orderBy === "title") parts.push("ordem: por título");

    if (parts.length === 0) return "Um lugar vivo para registrar, revisitar e lapidar suas memórias.";
    return `Mostrando ${parts.join(" • ")}.`;
  }, [q, phase, onlyEditable, orderBy]);

  function openCreate() {
    setError(null);
    setMode("create");
    try {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {}
  }

  function cancelCreate() {
    setError(null);
    setMode("list");
    setTitle("");
    setContent("");
  }

  function triggerConfetti() {
    // confete sutil: 3–6 partículas, 800ms
    if (confettiTimerRef.current) {
      window.clearTimeout(confettiTimerRef.current);
      confettiTimerRef.current = null;
    }
    const particles = buildConfetti(4 + Math.floor(Math.random() * 3));
    setConfetti(particles);

    confettiTimerRef.current = window.setTimeout(() => {
      setConfetti([]);
      confettiTimerRef.current = null;
    }, 820);
  }

  async function create() {
    setError(null);

    if (!token) {
      setError("Sessão expirada. Faça login novamente.");
      hardLogout();
      return;
    }

    if (!authorId || !Number.isFinite(authorId)) {
      setError("author_id ausente. Faça login novamente.");
      hardLogout();
      return;
    }

    if (!content.trim()) {
      setError("Conteúdo é obrigatório.");
      return;
    }

    setCreating(true);
    try {
      await api("POST", `/memory`, token, {
        author_id: authorId,
        title: title.trim() ? title.trim() : null,
        content: content,
      });

      await load();

      setTitle("");
      setContent("");
      setMode("list");

      triggerConfetti();
    } catch (e: any) {
      if (e?.status === 401) {
        setError("Sessão expirada. Faça login novamente.");
        hardLogout();
      } else {
        setError(e?.message || "Falha ao criar memória.");
      }
    } finally {
      setCreating(false);
    }
  }

  // =========================
  // UI
  // =========================
  const ui = useMemo(() => {
    const page: React.CSSProperties = {
      padding: 0,
      color: "var(--hdud-text)",
    };

    const container: React.CSSProperties = {
      width: "100%",
      maxWidth: 1920,
      margin: "0 auto",
      padding: "18px clamp(16px, 2.2vw, 36px)",
      boxSizing: "border-box",
      position: "relative",
    };

    const headerCard: React.CSSProperties = {
      background: "var(--hdud-card)",
      borderRadius: 16,
      padding: 18,
      boxShadow: "var(--hdud-shadow)",
      marginBottom: 14,
      border: "1px solid var(--hdud-border)",
      position: "relative",
      overflow: "hidden",
    };

    const headerGlow: React.CSSProperties = {
      position: "absolute",
      inset: -60,
      background:
        "radial-gradient(closest-side, rgba(0,0,0,0.06), transparent 60%)",
      pointerEvents: "none",
      opacity: 0.55,
      filter: "blur(2px)",
      transform: "translate3d(0,0,0)",
    };

    const h1Row: React.CSSProperties = {
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: 12,
      flexWrap: "wrap",
      position: "relative",
      zIndex: 1,
    };

    const h1: React.CSSProperties = {
      fontSize: 40,
      fontWeight: 950,
      letterSpacing: -0.7,
      margin: 0,
      lineHeight: 1.0,
    };

    const subtitle: React.CSSProperties = {
      marginTop: 8,
      opacity: 0.82,
      fontWeight: 750,
      position: "relative",
      zIndex: 1,
    };

    const toolbarRow: React.CSSProperties = {
      display: "flex",
      gap: 10,
      alignItems: "center",
      flexWrap: "wrap",
      marginTop: 14,
      position: "relative",
      zIndex: 1,
    };

    const spacer: React.CSSProperties = { flex: "1 1 auto" };

    const card: React.CSSProperties = {
      background: "var(--hdud-card)",
      borderRadius: 16,
      padding: 14,
      boxShadow: "var(--hdud-shadow)",
      border: "1px solid var(--hdud-border)",
      marginBottom: 14,
    };

    const cardTitle: React.CSSProperties = {
      fontSize: 13,
      fontWeight: 950,
      marginBottom: 10,
      letterSpacing: 0.2,
      opacity: 0.9,
      textTransform: "uppercase",
    };

    const label: React.CSSProperties = {
      fontSize: 12,
      fontWeight: 900,
      opacity: 0.85,
      marginBottom: 6,
    };

    const input: React.CSSProperties = {
      width: "100%",
      padding: "10px 12px",
      borderRadius: 12,
      border: "1px solid var(--hdud-border)",
      background: "var(--hdud-surface)",
      color: "var(--hdud-text)",
      outline: "none",
    };

    const textarea: React.CSSProperties = {
      width: "100%",
      minHeight: 140,
      padding: "10px 12px",
      borderRadius: 12,
      border: "1px solid var(--hdud-border)",
      background: "var(--hdud-surface)",
      color: "var(--hdud-text)",
      outline: "none",
      resize: "vertical",
      fontFamily: "inherit",
      lineHeight: 1.35,
    };

    const select: React.CSSProperties = {
      padding: "9px 12px",
      borderRadius: 12,
      border: "1px solid var(--hdud-border)",
      background: "var(--hdud-surface)",
      color: "var(--hdud-text)",
      outline: "none",
      fontWeight: 800,
    };

    const btn: React.CSSProperties = {
      padding: "9px 14px",
      borderRadius: 12,
      border: "1px solid var(--hdud-border)",
      background: "var(--hdud-surface)",
      color: "var(--hdud-text)",
      cursor: "pointer",
      fontWeight: 900,
      whiteSpace: "nowrap",
      boxShadow: "var(--hdud-shadow-soft)",
      transition: "transform 140ms ease, box-shadow 140ms ease, opacity 140ms ease",
    };

    const btnPrimary: React.CSSProperties = {
      ...btn,
      background: "var(--hdud-primary)",
      borderColor: "var(--hdud-primary)",
      color: "var(--hdud-primary-contrast)",
    };

    const btnGhost: React.CSSProperties = {
      ...btn,
      background: "transparent",
    };

    const pill: React.CSSProperties = {
      border: "1px solid var(--hdud-border)",
      padding: "5px 10px",
      borderRadius: 999,
      fontSize: 12,
      opacity: 0.9,
      whiteSpace: "nowrap",
      background: "var(--hdud-surface-2)",
      fontWeight: 900,
    };

    const grid2: React.CSSProperties = {
      display: "grid",
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      gap: 10,
    };

    const momentCard: React.CSSProperties = {
      border: "1px solid var(--hdud-border)",
      background: "var(--hdud-surface)",
      borderRadius: 14,
      padding: 14,
      boxShadow: "var(--hdud-shadow-soft)",
      cursor: "pointer",
      transition: "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
    };

    const momentTitle: React.CSSProperties = {
      fontWeight: 950,
      margin: 0,
      fontSize: 14,
      letterSpacing: -0.2,
    };

    const momentMeta: React.CSSProperties = {
      marginTop: 6,
      opacity: 0.78,
      fontSize: 12,
      fontWeight: 800,
      lineHeight: 1.25,
      display: "-webkit-box",
      WebkitLineClamp: 2,
      WebkitBoxOrient: "vertical",
      overflow: "hidden",
    };

    const listWrap: React.CSSProperties = {
      display: "grid",
      gap: 10,
      marginTop: 10,
    };

    const row: React.CSSProperties = {
      border: "1px solid var(--hdud-border)",
      background: "var(--hdud-surface)",
      borderRadius: 14,
      padding: 12,
      cursor: "pointer",
      boxShadow: "var(--hdud-shadow-soft)",
      transition: "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
      transform: "translate3d(0,0,0)",
    };

    const rowHover: React.CSSProperties = {
      transform: "translate3d(0,-2px,0)",
      boxShadow: "var(--hdud-shadow)",
      borderColor: "rgba(0,0,0,0.12)",
    };

    const rowTop: React.CSSProperties = {
      display: "flex",
      justifyContent: "space-between",
      gap: 12,
      alignItems: "baseline",
    };

    const rowTitle: React.CSSProperties = {
      fontWeight: 950,
      fontSize: 14,
      margin: 0,
      letterSpacing: -0.2,
    };

    const rowMeta: React.CSSProperties = {
      opacity: 0.75,
      fontSize: 12,
      whiteSpace: "nowrap",
      fontWeight: 800,
    };

    const rowSub: React.CSSProperties = {
      opacity: 0.82,
      fontSize: 12,
      marginTop: 8,
      lineHeight: 1.35,
      display: "-webkit-box",
      WebkitLineClamp: 2,
      WebkitBoxOrient: "vertical",
      overflow: "hidden",
    };

    const createFooter: React.CSSProperties = {
      display: "flex",
      justifyContent: "flex-end",
      gap: 10,
      marginTop: 14,
    };

    const empty: React.CSSProperties = {
      border: "1px dashed var(--hdud-border)",
      background: "var(--hdud-surface)",
      borderRadius: 14,
      padding: 16,
      opacity: 0.9,
    };

    const emptyTitle: React.CSSProperties = {
      margin: 0,
      fontWeight: 950,
      letterSpacing: -0.2,
    };

    const emptyText: React.CSSProperties = {
      marginTop: 6,
      opacity: 0.82,
      fontWeight: 750,
      lineHeight: 1.35,
    };

    const confettiLayer: React.CSSProperties = {
      position: "fixed",
      inset: 0,
      pointerEvents: "none",
      zIndex: 999,
    };

    return {
      page,
      container,
      headerCard,
      headerGlow,
      h1Row,
      h1,
      subtitle,
      toolbarRow,
      spacer,
      card,
      cardTitle,
      label,
      input,
      textarea,
      select,
      btn,
      btnPrimary,
      btnGhost,
      pill,
      grid2,
      momentCard,
      momentTitle,
      momentMeta,
      listWrap,
      row,
      rowHover,
      rowTop,
      rowTitle,
      rowMeta,
      rowSub,
      createFooter,
      empty,
      emptyTitle,
      emptyText,
      confettiLayer,
    };
  }, []);

  const headerFilters = (
    <div style={ui.toolbarRow}>
      <button
        type="button"
        style={ui.btnPrimary}
        onClick={openCreate}
        disabled={loading}
        title="Criar uma nova memória"
      >
        Criar memória
      </button>

      <div style={ui.spacer} />

      <input
        style={{ ...ui.input, width: 280 }}
        placeholder="Buscar (título ou conteúdo)…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <select style={ui.select} value={phase} onChange={(e) => setPhase(e.target.value)}>
        {phaseOptions.map((p) => (
          <option key={p.value || "__EMPTY__"} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>

      <select
        style={ui.select}
        value={orderBy}
        onChange={(e) => setOrderBy(e.target.value as any)}
      >
        <option value="newest">Mais recentes</option>
        <option value="oldest">Mais antigas</option>
        <option value="title">Título</option>
      </select>

      <button
        type="button"
        style={onlyEditable ? ui.btnPrimary : ui.btn}
        onClick={() => setOnlyEditable((v) => !v)}
        title="Mostrar apenas memórias editáveis"
      >
        Editáveis
      </button>

      <button type="button" style={ui.btn} onClick={load} disabled={loading}>
        Atualizar
      </button>
    </div>
  );

  const openMemory = useCallback(
    (id: number) => {
      // ✅ rota real (App.tsx garante /memories/:id)
      navigate(`/memories/${id}`);
    },
    [navigate]
  );

  const momentBlock = (
    <div style={ui.card}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <div style={ui.cardTitle}>Momento</div>
        <div style={{ opacity: 0.75, fontSize: 12, fontWeight: 900 }}>
          {latestMemory ? `Pulso: ${pulseLabel}` : "Pulso: em silêncio"}
        </div>
      </div>

      <div style={ui.grid2}>
        {moment.destaque ? (
          <div
            style={ui.momentCard}
            onClick={() => openMemory(moment.destaque!.memory_id)}
            onMouseEnter={() => setHoverId(moment.destaque!.memory_id)}
            onMouseLeave={() => setHoverId((v) => (v === moment.destaque!.memory_id ? null : v))}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ opacity: 0.8, fontSize: 12, fontWeight: 900 }}>Em destaque</div>
                <p style={ui.momentTitle}>
                  {(moment.destaque.title && moment.destaque.title.trim()) || `Memória #${moment.destaque.memory_id}`}
                </p>
              </div>
              <div style={{ opacity: 0.7, fontSize: 12, fontWeight: 900, whiteSpace: "nowrap" }}>
                {formatDateBRShort(moment.destaque.created_at)}
              </div>
            </div>
            <div style={ui.momentMeta}>{moment.destaque.content}</div>
          </div>
        ) : (
          <div style={ui.empty}>
            <p style={ui.emptyTitle}>Seu jardim começa aqui.</p>
            <div style={ui.emptyText}>
              Crie a primeira memória e o HDUD passa a ter pulso.
            </div>
          </div>
        )}

        {moment.revisitar ? (
          <div
            style={ui.momentCard}
            onClick={() => openMemory(moment.revisitar!.memory_id)}
            onMouseEnter={() => setHoverId(moment.revisitar!.memory_id)}
            onMouseLeave={() => setHoverId((v) => (v === moment.revisitar!.memory_id ? null : v))}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ opacity: 0.8, fontSize: 12, fontWeight: 900 }}>Revisitar</div>
                <p style={ui.momentTitle}>
                  {(moment.revisitar.title && moment.revisitar.title.trim()) || `Memória #${moment.revisitar.memory_id}`}
                </p>
              </div>
              <div style={{ opacity: 0.7, fontSize: 12, fontWeight: 900, whiteSpace: "nowrap" }}>
                {formatDateBRShort(moment.revisitar.created_at)}
              </div>
            </div>
            <div style={ui.momentMeta}>{moment.revisitar.content}</div>
          </div>
        ) : (
          <div style={ui.empty}>
            <p style={ui.emptyTitle}>Sem revisitas ainda.</p>
            <div style={ui.emptyText}>
              Quando você tiver mais memórias, eu trago uma “de volta” de forma orgânica.
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div style={ui.page}>
      {/* confete sutil */}
      {confetti.length > 0 ? (
        <div style={ui.confettiLayer}>
          <style>{`
            @keyframes hdud_confetti_fall {
              0% { transform: translate3d(0,0,0) rotate(0deg); opacity: 0; }
              12% { opacity: 1; }
              100% { transform: translate3d(0,80px,0) rotate(18deg); opacity: 0; }
            }
          `}</style>
          {confetti.map((p) => (
            <div
              key={p.id}
              style={{
                position: "absolute",
                left: `${p.left}vw`,
                top: `${p.top}px`,
                width: p.size,
                height: p.size,
                borderRadius: 999,
                background: "rgba(0,0,0,0.22)",
                opacity: p.opacity,
                transform: `translate3d(0,0,0) rotate(${p.rot}deg)`,
                animation: `hdud_confetti_fall 800ms ease ${p.delay}ms 1 both`,
                filter: "blur(0.2px)",
              }}
            />
          ))}
        </div>
      ) : null}

      <div style={ui.container}>
        <div style={ui.headerCard}>
          <div style={ui.headerGlow} />
          <div style={ui.h1Row}>
            <div>
              <h1 style={ui.h1}>Jardim de Memórias</h1>
              <div style={ui.subtitle}>
                {greetingPTBR()}, Alexandre. <span style={{ opacity: 0.82 }}>{pulseLabel}</span>
              </div>
            </div>
            <div style={ui.pill}>{countLabel}</div>
          </div>

          <div style={{ marginTop: 10, opacity: 0.82, fontWeight: 750, position: "relative", zIndex: 1 }}>
            {microcopy}
          </div>

          {mode === "list" ? headerFilters : null}
        </div>

        {error ? (
          <div
            style={{
              background: "rgba(255,0,0,0.08)",
              border: "1px solid rgba(255,0,0,0.25)",
              borderRadius: 14,
              padding: 12,
              marginBottom: 14,
              color: "var(--hdud-text)",
              fontWeight: 900,
            }}
          >
            {error}
          </div>
        ) : null}

        {mode === "create" ? (
          <div style={ui.card}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={ui.cardTitle}>Registrar</div>
                <div style={{ opacity: 0.75, fontSize: 12, fontWeight: 800 }}>
                  Uma memória é um sinal humano — curto, honesto e versionável.
                </div>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={ui.label}>Título (opcional)</div>
              <input
                style={ui.input}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Carnaval 2026"
              />
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={ui.label}>Conteúdo</div>
              <textarea
                style={ui.textarea}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Escreva aqui…"
              />
            </div>

            <div style={ui.createFooter}>
              <button type="button" style={ui.btnGhost} onClick={cancelCreate} disabled={creating}>
                Cancelar
              </button>
              <button type="button" style={ui.btnPrimary} onClick={create} disabled={creating}>
                {creating ? "Criando…" : "Criar memória"}
              </button>
            </div>
          </div>
        ) : null}

        {mode === "list" ? momentBlock : null}

        {mode === "list" ? (
          <div style={ui.card}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
              <div style={ui.cardTitle}>Histórico</div>
              <div style={{ opacity: 0.75, fontSize: 12, fontWeight: 900 }}>
                Clique em qualquer memória para abrir o detalhe.
              </div>
            </div>

            {loading ? (
              <div style={{ opacity: 0.85, fontWeight: 900 }}>Carregando…</div>
            ) : viewItems.length === 0 ? (
              <div style={ui.empty}>
                <p style={ui.emptyTitle}>Nada por aqui — por enquanto.</p>
                <div style={ui.emptyText}>
                  Tente ajustar os filtros… ou registre uma nova memória para fazer o jardim florescer.
                </div>
              </div>
            ) : (
              <div style={ui.listWrap}>
                {viewItems.map((m) => {
                  const titleText = m.title?.trim() ? m.title!.trim() : `Memória #${m.memory_id}`;
                  const when = formatDateBR(m.created_at);
                  const canEdit = m.meta?.can_edit === true;
                  const ver = m.meta?.current_version ? `v${m.meta.current_version}` : "v?";
                  const phaseLabel =
                    safeTrim(m.meta?.phase_name) ||
                    safeTrim(m.meta?.life_phase) ||
                    "";

                  const isHover = hoverId === m.memory_id;

                  return (
                    <div
                      key={m.memory_id}
                      style={{ ...ui.row, ...(isHover ? ui.rowHover : null) }}
                      onMouseEnter={() => setHoverId(m.memory_id)}
                      onMouseLeave={() => setHoverId((v) => (v === m.memory_id ? null : v))}
                      onClick={() => openMemory(m.memory_id)}
                      title="Abrir memória"
                    >
                      <div style={ui.rowTop}>
                        <div
                          style={{
                            display: "flex",
                            gap: 10,
                            alignItems: "baseline",
                            flexWrap: "wrap",
                          }}
                        >
                          <div style={ui.rowTitle}>{titleText}</div>
                          <div style={{ opacity: 0.72, fontSize: 12, fontWeight: 900 }}>
                            #{m.memory_id} • {ver} • {canEdit ? "editável" : "somente leitura"}
                            {phaseLabel ? ` • ${phaseLabel}` : ""}
                          </div>
                        </div>
                        <div style={ui.rowMeta}>{when}</div>
                      </div>

                      <div style={ui.rowSub}>{m.content}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}