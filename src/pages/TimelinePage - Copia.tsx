// C:\HDUD_DATA\hdud-web-app\src\pages\TimelinePage.tsx
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
  ok?: boolean;
  items?: any[];
  warnings?: string[];
  meta?: any;
};

type FilterKey = "Tudo" | "Memórias" | "Capítulos";

// =====================
// Auth / API helpers
// =====================
function tryExtractTokenFromValue(v: string): string | null {
  const s = (v || "").trim();
  if (!s) return null;

  if (s.split(".").length === 3) return s;

  try {
    const obj = JSON.parse(s);
    const candidates = [obj?.access_token, obj?.token, obj?.jwt, obj?.data?.access_token, obj?.data?.token];
    for (const t of candidates) {
      if (typeof t === "string" && t.trim().split(".").length === 3) return t.trim();
    }
  } catch {}

  return null;
}

function getAuthToken(): string | null {
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

  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      const v = window.localStorage.getItem(key) || "";
      const token = tryExtractTokenFromValue(v);
      if (token) return token;
    }
  } catch {}

  return null;
}

function parseJwtPayload(token: string): any | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(b64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getApiBase(): string {
  const env = (import.meta as any).env || {};
  const base = env.VITE_API_BASE || env.VITE_API_URL || env.VITE_BACKEND_URL || env.VITE_API || "";
  return String(base || "").trim().replace(/\/+$/, "");
}

function normalizeUrl(path: string): string {
  const base = getApiBase();
  if (!path.startsWith("/")) path = `/${path}`;
  return base ? `${base}${path}` : path;
}

async function fetchJsonAny(
  path: string,
  token: string | null
): Promise<{ ok: boolean; status: number; data: any; usedUrl: string }> {
  const usedUrl = normalizeUrl(path);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const r = await fetch(usedUrl, { headers });
  let data: any = null;

  const text = await r.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  return { ok: r.ok, status: r.status, data, usedUrl };
}

async function fetchTimeline(
  token: string | null
): Promise<{ ok: boolean; status: number; data: any; usedUrl: string; authSent: boolean }> {
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
// Inventory helpers (REAL numbers)
// =====================
function unwrapArrayFromManyShapes(data: any): any[] | null {
  if (!data) return null;
  if (Array.isArray(data)) return data;

  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.memories)) return data.memories;
  if (Array.isArray(data.chapters)) return data.chapters;

  if (data.data) {
    if (Array.isArray(data.data.items)) return data.data.items;
    if (Array.isArray(data.data.memories)) return data.data.memories;
    if (Array.isArray(data.data.chapters)) return data.data.chapters;
  }

  return null;
}

async function tryMany(
  token: string | null,
  paths: string[]
): Promise<{
  ok: boolean;
  status: number;
  data: any;
  usedUrl: string;
  attempts: Array<{ path: string; status: number; ok: boolean }>;
}> {
  const attempts: Array<{ path: string; status: number; ok: boolean }> = [];
  let last = { ok: false, status: 0, data: null as any, usedUrl: "" };

  for (const p of paths) {
    try {
      const r = await fetchJsonAny(p, token);
      attempts.push({ path: r.usedUrl, status: r.status, ok: r.ok });
      last = r;
      if (r.ok) return { ...r, attempts };
      if (r.status === 401) return { ...r, attempts };
    } catch {}
  }

  return { ...last, attempts };
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
  if (s < 45) return "agora";
  if (s < 60) return `há ${s}s`;

  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m} min`;

  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} h`;

  const days = Math.floor(h / 24);
  if (days === 1) return "ontem";
  return `há ${days} dias`;
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
// Normalize API -> UI model
// =====================
function normalizeApiTimelineItemToEvent(item: any): TimelineEvent | null {
  if (!item || typeof item !== "object") return null;

  const typeRaw = String(item.type ?? item.kind ?? "").trim().toLowerCase();
  const title = String(item.title ?? "").trim() || "(sem título)";
  const at = String(item.date ?? item.at ?? item.created_at ?? "").trim();

  const sourceId = String(item.source_id ?? item.id ?? "").trim();

  let kind: TimelineKind = "Evento";
  let source: TimelineEvent["source"] = "unknown";

  if (typeRaw === "memory") {
    kind = "Memória";
    source = "memories";
  } else if (typeRaw === "chapter") {
    kind = "Capítulo";
    source = "chapters";
  } else if (typeRaw === "version") {
    kind = "Versão";
    source = "versions";
  } else if (typeRaw === "ledger") {
    kind = "Evento";
    source = "ledger";
  }

  let id = "";
  if (kind === "Memória") id = `memory:${sourceId}`;
  else if (kind === "Capítulo") id = `chapter:${sourceId}`;
  else if (kind === "Versão") id = `version:${sourceId || `${item.memory_id ?? ""}:${item.version_number ?? ""}`}`;
  else id = `event:${sourceId || Math.random().toString(36).slice(2)}`;

  const note =
    (typeof item.note === "string" && item.note.trim()) ||
    (typeof item.meta?.preview === "string" && item.meta.preview.trim()) ||
    (typeof item.meta?.description === "string" && item.meta.description.trim()) ||
    undefined;

  const raw = item;
  const atSafe = at || new Date().toISOString();

  return { id, at: atSafe, title, kind, note, source, raw };
}

// =====================
// Routing helpers (click to open)
// =====================
function toNum(v: any): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}

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

  const metaMid = toNum(raw?.meta?.memory_id) ?? toNum(raw?.meta?.memoryId);
  const metaCid = toNum(raw?.meta?.chapter_id) ?? toNum(raw?.meta?.chapterId);
  if (metaMid && metaMid > 0) return { kind: "memory", id: metaMid };
  if (metaCid && metaCid > 0) return { kind: "chapter", id: metaCid };

  const mid =
    toNum(raw?.memory_id) ??
    toNum(raw?.memoryId) ??
    toNum(raw?.id_memory) ??
    toNum(raw?.idMemory) ??
    toNum(raw?.entity_id) ??
    toNum(raw?.entityId);

  const cid = toNum(raw?.chapter_id) ?? toNum(raw?.chapterId) ?? toNum(raw?.id_chapter) ?? toNum(raw?.idChapter);

  if (mid && mid > 0) return { kind: "memory", id: mid };
  if (cid && cid > 0) return { kind: "chapter", id: cid };

  return { kind: "unknown", id: null };
}

// =====================
// Kind normalization (UI-only)
// =====================
function normalizeKind(ev: TimelineEvent): TimelineKind {
  const incoming = ev.kind;

  const id = String(ev.id || "").toLowerCase();
  const src = String(ev.source || "").toLowerCase();
  const title = String(ev.title || "").toLowerCase();
  const note = String(ev.note || "").toLowerCase();

  const target = extractTarget(ev);
  if (target.kind === "memory" && target.id) return "Memória";
  if (target.kind === "chapter" && target.id) return "Capítulo";

  if (incoming && incoming !== "Evento" && incoming !== "Versão") return incoming;

  if (id.startsWith("memory:")) return "Memória";
  if (id.startsWith("chapter:")) return "Capítulo";
  if (id.startsWith("version:")) return "Versão";

  if (src === "memories") return "Memória";
  if (src === "chapters") return "Capítulo";
  if (src === "versions") return "Versão";

  const hay = `${title} ${note}`;
  if (hay.includes("rollback") || hay.includes("reverter") || hay.includes("revert")) return "Rollback";
  if (hay.includes("capítulo") || hay.includes("chapter")) return "Capítulo";
  if (hay.includes("memória") || hay.includes("memoria") || hay.includes("memory")) return "Memória";
  if (hay.includes("versão") || hay.includes("version")) return "Versão";

  return "Evento";
}

function mapKindToFilter(kind: TimelineKind): FilterKey | null {
  if (kind === "Memória") return "Memórias";
  if (kind === "Capítulo") return "Capítulos";
  return null;
}

function labelForKind(kind: TimelineKind): string {
  if (kind === "Memória") return "Memória";
  if (kind === "Capítulo") return "Capítulo";
  if (kind === "Versão") return "Versão";
  if (kind === "Rollback") return "Rollback";
  return "Evento";
}

function entityKey(ev: TimelineEvent): string | null {
  const t = extractTarget(ev);
  if (t.kind === "memory" && t.id) return `memory:${t.id}`;
  if (t.kind === "chapter" && t.id) return `chapter:${t.id}`;

  const title = String(ev.title || "").trim().toLowerCase();
  const src = String(ev.source || "unknown").trim().toLowerCase();

  if (title) return `fallback:${src}:${title}`;
  return null;
}

function collapseToLatestPerEntity(list: TimelineEvent[]): TimelineEvent[] {
  const sorted = [...list].sort(sortEventsDesc);

  const seen = new Set<string>();
  const out: TimelineEvent[] = [];

  for (const ev of sorted) {
    const k = entityKey(ev);
    if (!k) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(ev);
  }

  if (out.length === 0) return sorted.slice(0, 50);

  return out;
}

// =====================
// Page
// =====================
export default function TimelinePage() {
  const navigate = useNavigate();

  const filters: FilterKey[] = ["Tudo", "Memórias", "Capítulos"];

  const [activeFilter, setActiveFilter] = useState<FilterKey>("Tudo");
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [query, setQuery] = useState("");

  // ✅ INVENTÁRIO REAL
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryMemoriesTotal, setInventoryMemoriesTotal] = useState<number | null>(null);
  const [inventoryChaptersTotal, setInventoryChaptersTotal] = useState<number | null>(null);

  // diagnóstico
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

  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const clickLockRef = useRef(false);

  function toggleOpen(id: string) {
    setOpenMap((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function openEvent(ev: TimelineEvent) {
    const t = extractTarget(ev);

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
      } catch {}
      navigate(`/chapters`);
      return;
    }

    toggleOpen(ev.id);
  }

  async function loadTimeline() {
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
          typeof data === "object" && data ? data?.detail || data?.error || JSON.stringify(data) : String(data);

        setErrorMsg(`Não foi possível carregar a Timeline (HTTP ${status}). ${detail || ""}`.trim());
        setEvents([]);
        setWarnings([]);
        setLoading(false);
        return;
      }

      const payload = data as TimelineResponse;

      const rawItems = Array.isArray(payload?.items) ? payload.items : Array.isArray(data?.items) ? data.items : [];
      const warns = Array.isArray(payload?.warnings) ? payload.warnings : [];

      const normalized: TimelineEvent[] = [];
      for (const it of rawItems) {
        const ev = normalizeApiTimelineItemToEvent(it);
        if (ev) normalized.push(ev);
      }

      setEvents(normalized.sort(sortEventsDesc));
      setWarnings(warns);
      setLastUpdated(new Date());
    } catch {
      setErrorMsg("Falha de rede ao carregar a Timeline. Verifique API e token.");
      setEvents([]);
      setWarnings([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadInventory() {
    const token = getAuthToken();
    if (!token) {
      setInventoryMemoriesTotal(null);
      setInventoryChaptersTotal(null);
      return;
    }

    const jwt = parseJwtPayload(token);
    const authorIdRaw = jwt?.author_id ?? jwt?.authorId ?? jwt?.sub_author_id ?? null;
    const authorId = Number(authorIdRaw);
    const authorOk = Number.isFinite(authorId) && authorId > 0;

    setInventoryLoading(true);

    try {
      const memRes = await tryMany(token, [
        "/api/memories",
        ...(authorOk ? [`/api/authors/${authorId}/memories`, `/api/author/${authorId}/memories`, `/api/memories/${authorId}`] : []),
      ]);

      const memTotalFromMeta =
        (memRes?.data &&
          typeof memRes.data === "object" &&
          (memRes.data?.total ?? memRes.data?.meta?.total ?? memRes.data?.meta?.count ?? memRes.data?.count)) ??
        null;

      if (typeof memTotalFromMeta === "number" && Number.isFinite(memTotalFromMeta)) {
        setInventoryMemoriesTotal(memTotalFromMeta);
      } else {
        const memList = unwrapArrayFromManyShapes(memRes.data);
        if (Array.isArray(memList)) {
          const ids = new Set<number>();
          for (const x of memList) {
            const id = toNum(x?.memory_id ?? x?.id ?? x?.memoryId ?? x?.id_memory);
            if (id && id > 0) ids.add(id);
          }
          setInventoryMemoriesTotal(ids.size || memList.length);
        } else {
          setInventoryMemoriesTotal(null);
        }
      }

      const chapRes = await tryMany(token, [
        "/api/chapters",
        "/api/chapter",
        "/api/chapters/list",
        "/api/chapter/list",
        ...(authorOk ? [`/api/authors/${authorId}/chapters`, `/api/author/${authorId}/chapters`] : []),
      ]);

      const chapList = unwrapArrayFromManyShapes(chapRes.data);
      setInventoryChaptersTotal(Array.isArray(chapList) ? chapList.length : null);
    } finally {
      setInventoryLoading(false);
    }
  }

  async function loadAll() {
    await Promise.all([loadTimeline(), loadInventory()]);
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!mounted) return;
      await loadAll();
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const eventCounts = useMemo(() => {
    return {
      Tudo: events.length,
      Memórias: events.filter((e) => normalizeKind(e) === "Memória").length,
      Capítulos: events.filter((e) => normalizeKind(e) === "Capítulo").length,
    };
  }, [events]);

  const chipCounts = useMemo(() => {
    const mem = inventoryMemoriesTotal ?? eventCounts.Memórias;
    const chap = inventoryChaptersTotal ?? eventCounts.Capítulos;

    const hasReal = inventoryMemoriesTotal != null || inventoryChaptersTotal != null;
    const all = hasReal ? mem + chap : events.length;

    return {
      Tudo: all,
      Memórias: mem,
      Capítulos: chap,
    };
  }, [events.length, inventoryMemoriesTotal, inventoryChaptersTotal, eventCounts.Memórias, eventCounts.Capítulos]);

  const displayEvents = useMemo(() => {
    return events.filter((ev) => normalizeKind(ev) !== "Versão");
  }, [events]);

  const filteredEvents = useMemo(() => {
    const searching = Boolean(query.trim());

    const baseList = searching ? collapseToLatestPerEntity(displayEvents) : displayEvents;

    let list = baseList;

    if (activeFilter !== "Tudo") {
      const want: TimelineKind = activeFilter === "Memórias" ? "Memória" : "Capítulo";
      list = list.filter((e) => normalizeKind(e) === want);
    }

    const q = query.trim().toLowerCase();
    if (!q) return list;

    return list.filter((e) => {
      const hay = [e.title, e.note, e.id].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [displayEvents, activeFilter, query]);

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
      sortKey: day === "Sem data" ? -Infinity : safeDateParse(list[0]?.at)?.getTime() ?? -Infinity,
    }));

    entries.sort((a, b) => b.sortKey - a.sortKey);
    return entries;
  }, [filteredEvents]);

  const statusLine = useMemo(() => {
    if (loading) return "Carregando…";
    if (errorMsg) return "Erro";
    return "Ativa";
  }, [loading, errorMsg]);

  return (
    <div className="hdud-page">
      <div className="hdud-container" style={{ margin: "0 auto" }}>
        {/* Header (padrão HDUD) */}
        <div className="hdud-card">
          <div className="hdud-pagehead">
            <div style={{ minWidth: 0 }}>
              <h1 className="hdud-pagehead-title">Timeline</h1>
              <p className="hdud-pagehead-subtitle">
                Nada se perde. Aqui está a linha do tempo do que aconteceu na sua história — com eventos claros e clicáveis.
              </p>

              <div style={styles.badgeRow}>
                <span style={styles.badgeSoft}>
                  Status: <b style={{ opacity: 1 }}>{statusLine}</b>
                  {lastUpdated && !loading && !errorMsg ? (
                    <span style={{ opacity: 0.75 }}>
                      {" "}
                      • Atualizado:{" "}
                      <b>
                        {lastUpdated.toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </b>
                    </span>
                  ) : null}
                </span>

                <button type="button" className="hdud-btn" style={styles.btnGhost} onClick={() => setDebugOpen((v) => !v)}>
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
                  <div style={styles.diagLine}>
                    <b>Token</b>: {debugInfo.tokenPresent ? "detectado" : "ausente"}
                  </div>
                  <div style={styles.diagHint}>
                    Inventário (Memórias/Capítulos) é carregado via <code>/api/*</code> para bater com números reais.
                  </div>
                </div>
              )}
            </div>

            <div className="hdud-actions">
              <button className="hdud-btn" onClick={loadAll} disabled={loading || inventoryLoading}>
                {loading || inventoryLoading ? "Atualizando…" : "Atualizar"}
              </button>
            </div>
          </div>
        </div>

        {/* Filters + Search */}
        <div className="hdud-card">
          <div style={styles.rowBetween}>
            <div>
              <div style={styles.cardTitle}>Em foco</div>
              <div style={styles.cardMeta}>Filtre por tipo, se quiser — a Timeline continua sendo uma linha única.</div>
            </div>

            <div style={styles.smallMuted}>
              Eventos: <b>{filteredEvents.length}</b> / {displayEvents.length}
              {inventoryLoading ? <span style={{ marginLeft: 8, opacity: 0.75 }}>• Inventário…</span> : null}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            {filters.map((f) => {
              const isActive = f === activeFilter;
              const count = f === "Tudo" ? chipCounts.Tudo : f === "Memórias" ? chipCounts.Memórias : chipCounts.Capítulos;

              return (
                <button
                  key={f}
                  type="button"
                  style={{ ...styles.chip, ...(isActive ? styles.chipActive : {}) }}
                  onClick={() => setActiveFilter(f)}
                >
                  {f}
                  <span style={styles.chipCount}>{count}</span>
                </button>
              );
            })}
          </div>

          <div style={styles.searchRow}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={styles.labelTop}>Buscar</div>
              <input className="hdud-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Título, nota, id…" />
            </div>
            <div style={styles.smallMuted}>Dica: ao buscar, mostramos só o estado atual (1 por memória/capítulo).</div>
          </div>

          {warnings.length > 0 && (
            <div className="hdud-alert hdud-alert-warn" style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Avisos</div>
              {warnings.slice(0, 8).map((w, i) => (
                <div key={`warn-${i}`}>• {w}</div>
              ))}
            </div>
          )}
        </div>

        {/* Events */}
        <div className="hdud-card">
          <div style={styles.rowBetween}>
            <div>
              <div style={styles.cardTitle}>Em ordem</div>
              <div style={styles.cardMeta}>Do mais recente para o mais antigo, agrupados por dia.</div>
            </div>
            <div style={styles.smallMuted}>{loading ? "Carregando…" : "Ativa"}</div>
          </div>

          {errorMsg ? (
            <div className="hdud-alert hdud-alert-danger" style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 950 }}>Não foi possível carregar a Timeline</div>
              <div style={{ marginTop: 6, opacity: 0.85 }}>{errorMsg}</div>
              <button type="button" className="hdud-btn" style={{ marginTop: 12 }} onClick={loadAll}>
                Tentar novamente
              </button>
            </div>
          ) : loading ? (
            <div className="hdud-alert" style={{ marginTop: 12 }}>
              Carregando eventos…
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="hdud-alert" style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 950 }}>Nada para mostrar</div>
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

                      const k = normalizeKind(it);
                      const seal = labelForKind(k);

                      const focusLabel = mapKindToFilter(k);

                      const openLabel =
                        target.kind === "memory" ? "Abrir memória" : target.kind === "chapter" ? "Abrir capítulo" : "Detalhes";

                      return (
                        <div
                          key={it.id}
                          style={styles.eventCard}
                          onClick={() => openEvent(it)}
                          title={target.id ? "Clique para abrir" : "Clique para ver detalhes"}
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
                                  {kindIcon(k)} <b>{time}</b> {rel ? <span style={{ opacity: 0.7 }}>({rel})</span> : null}
                                </span>

                                <span style={styles.badgeSoftSmall}>
                                  <b>{seal}</b>
                                </span>

                                {focusLabel ? (
                                  <button
                                    type="button"
                                    style={styles.badgeLink}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveFilter(focusLabel);
                                    }}
                                    title="Filtrar por este tipo"
                                  >
                                    Ver só {focusLabel.toLowerCase()}
                                  </button>
                                ) : null}
                              </div>

                              <div style={styles.eventTitle}>{it.title || "(sem título)"}</div>

                              {note ? <div style={styles.eventNote}>{note}</div> : null}

                              <div style={styles.eventActions}>
                                <button
                                  type="button"
                                  className="hdud-btn hdud-btn-primary"
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
                                  className="hdud-btn"
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

                            <div style={styles.kindPill}>{seal}</div>
                          </div>

                          {isOpen && (
                            <div style={styles.detailsBox} onClick={(e) => e.stopPropagation()}>
                              <div style={{ fontWeight: 950, marginBottom: 6 }}>Detalhes do evento</div>
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
            Observação: esta tela <b>consome</b> <code>/timeline</code> para eventos, e consulta <b>inventário real</b> em{" "}
            <code>/api/*</code> para os contadores (Memórias/Capítulos). Ao buscar, mostramos apenas o estado atual. A UI não
            renderiza cards de “Versão”.
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  badgeRow: {
    marginTop: 10,
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },
  badgeSoft: {
    fontSize: 12,
    fontWeight: 900,
    padding: "6px 10px",
    borderRadius: 999,
    background: "var(--hdud-surface-2)",
    border: "1px solid var(--hdud-border)",
    color: "var(--hdud-text)",
    opacity: 0.92,
  },
  badgeSoftSmall: {
    fontSize: 11,
    fontWeight: 950,
    padding: "4px 8px",
    borderRadius: 999,
    background: "var(--hdud-surface-2)",
    border: "1px solid var(--hdud-border)",
    color: "var(--hdud-text)",
    opacity: 0.92,
    whiteSpace: "nowrap",
  },
  badgeLink: {
    fontSize: 11,
    fontWeight: 950,
    padding: "4px 8px",
    borderRadius: 999,
    background: "transparent",
    border: "1px solid var(--hdud-border)",
    color: "var(--hdud-text)",
    opacity: 0.78,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  btnGhost: {
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 900,
    opacity: 0.78,
    background: "transparent",
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

  rowBetween: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  cardTitle: { fontWeight: 950, fontSize: 14 },
  cardMeta: { fontSize: 12, opacity: 0.72, marginTop: 4 },
  smallMuted: { fontSize: 12, opacity: 0.7 },

  chip: {
    border: "1px solid var(--hdud-border)",
    background: "var(--hdud-surface-2)",
    color: "var(--hdud-text)",
    padding: "7px 10px",
    borderRadius: 999,
    cursor: "pointer",
    fontWeight: 950,
    fontSize: 12,
    display: "inline-flex",
    gap: 8,
    alignItems: "center",
    opacity: 0.82,
  },
  chipActive: { opacity: 1, outline: "2px solid var(--hdud-accent-border)" },
  chipCount: {
    fontSize: 11,
    fontWeight: 950,
    padding: "2px 8px",
    borderRadius: 999,
    border: "1px solid var(--hdud-border)",
    background: "transparent",
    opacity: 0.85,
    minWidth: 28,
    textAlign: "center",
  },

  searchRow: {
    display: "flex",
    gap: 12,
    marginTop: 12,
    alignItems: "flex-end",
    flexWrap: "wrap",
  },
  labelTop: { fontSize: 12, fontWeight: 950, opacity: 0.85, marginBottom: 6 },

  dayHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  dayPill: {
    fontSize: 11,
    fontWeight: 950,
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
    boxShadow: "var(--hdud-shadow)",
  },
  eventTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },
  eventLeft: { minWidth: 0, flex: 1 },

  eventMetaRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },
  eventMeta: { fontSize: 12, opacity: 0.8 },

  eventTitle: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: 950,
    lineHeight: 1.25,
  },
  eventNote: { marginTop: 6, fontSize: 12, opacity: 0.82, lineHeight: 1.35 },

  kindPill: {
    fontSize: 11,
    fontWeight: 950,
    padding: "5px 10px",
    borderRadius: 999,
    border: "1px solid var(--hdud-border)",
    background: "var(--hdud-card)",
    whiteSpace: "nowrap",
    opacity: 0.9,
  },

  eventActions: { marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" },
  btnMiniPrimary: { padding: "7px 10px", borderRadius: 10, fontWeight: 950, fontSize: 12 },
  btnMini: { padding: "7px 10px", borderRadius: 10, fontWeight: 950, fontSize: 12, opacity: 0.9 },

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
