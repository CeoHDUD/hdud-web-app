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

const TIMELINE_LIMIT = 500;

function tryExtractTokenFromValue(v: string): string | null {
  const s = (v || "").trim();
  if (!s) return null;

  if (s.split(".").length === 3) return s;

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
  } catch {}

  return null;
}

function getAuthToken(): string | null {
  const candidates = ["hdud_access_token", "HDUD_TOKEN", "access_token", "token"];

  for (const k of candidates) {
    const v = window.localStorage.getItem(k);
    if (!v) continue;

    const token = tryExtractTokenFromValue(v);
    if (token) return token;
  }

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
  const base =
    env.VITE_API_BASE || env.VITE_API_URL || env.VITE_BACKEND_URL || env.VITE_API || "";
  return String(base || "")
    .trim()
    .replace(/\/+$/, "");
}

function normalizeUrl(path: string): string {
  const base = getApiBase();
  if (!path.startsWith("/")) path = `/${path}`;
  return base ? `${base}${path}` : path;
}

function buildTimelineUrl(filter: FilterKey, query: string): string {
  const params = new URLSearchParams();
  params.set("limit", String(TIMELINE_LIMIT));

  const q = String(query || "").trim();
  if (q) params.set("q", q);

  if (filter === "Memórias") params.set("type", "memory");
  else if (filter === "Capítulos") params.set("type", "chapter");

  return `/api/timeline?${params.toString()}`;
}

function looksLikeHtml(value: any): boolean {
  if (typeof value !== "string") return false;
  const s = value.trim().toLowerCase();
  return (
    s.startsWith("<!doctype html") ||
    s.startsWith("<html") ||
    s.includes("<head") ||
    s.includes("<body")
  );
}

async function fetchJsonAny(
  path: string,
  token: string | null
): Promise<{ ok: boolean; status: number; data: any; usedUrl: string }> {
  const usedUrl = normalizeUrl(path);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const r = await fetch(usedUrl, { headers, cache: "no-store" });
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
  token: string | null,
  filter: FilterKey,
  query: string
): Promise<{ ok: boolean; status: number; data: any; usedUrl: string; authSent: boolean }> {
  const authSent = Boolean(token);
  const primaryPath = buildTimelineUrl(filter, query);
  const fallbackPath = primaryPath.replace(/^\/api/, "") || "/timeline";
  const tries = [primaryPath, fallbackPath];

  let last: { ok: boolean; status: number; data: any; usedUrl: string; authSent: boolean } = {
    ok: false,
    status: 0,
    data: null,
    usedUrl: normalizeUrl(primaryPath),
    authSent,
  };

  for (const p of tries) {
    const usedUrl = normalizeUrl(p);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    const r = await fetch(usedUrl, { headers, cache: "no-store" });
    const text = await r.text();

    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    const candidate = { ok: r.ok, status: r.status, data, usedUrl, authSent };
    last = candidate;

    if (looksLikeHtml(data)) continue;
    if (r.ok && data && typeof data === "object" && Array.isArray(data.items)) return candidate;
    if (r.ok && data && typeof data === "object") return candidate;
    if (r.status === 401) return candidate;
  }

  return last;
}

async function fetchJsonDirect(
  path: string,
  token: string | null
): Promise<{ ok: boolean; status: number; data: any; usedUrl: string }> {
  const usedUrl = normalizeUrl(path);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const r = await fetch(usedUrl, { headers, cache: "no-store" });
  const text = await r.text();

  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  return { ok: r.ok, status: r.status, data, usedUrl };
}

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

function fallbackTitleByType(typeRaw: string): string {
  if (typeRaw === "memory") return "(Memória sem título)";
  if (typeRaw === "chapter") return "(Capítulo sem título)";
  if (typeRaw === "version") return "(Versão sem título)";
  if (typeRaw === "rollback") return "(Rollback)";
  return "(Evento)";
}

function toNum(v: any): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function firstString(...values: any[]): string {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function normalizeTypeToken(input: any): string {
  const raw = String(input || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (!raw) return "";

  if (raw === "memory" || raw === "memories" || raw === "memoria" || raw === "memorias") {
    return "memory";
  }

  if (raw === "chapter" || raw === "chapters" || raw === "capitulo" || raw === "capitulos") {
    return "chapter";
  }

  if (raw === "version" || raw === "versions" || raw === "versao" || raw === "versoes") {
    return "version";
  }

  if (raw === "rollback" || raw === "revert" || raw === "reverted") {
    return "rollback";
  }

  if (raw === "ledger") return "ledger";

  if (raw.includes("memory") || raw.includes("memoria")) return "memory";
  if (raw.includes("chapter") || raw.includes("capitulo")) return "chapter";
  if (raw.includes("version") || raw.includes("versao")) return "version";
  if (raw.includes("rollback") || raw.includes("revert")) return "rollback";
  if (raw.includes("ledger")) return "ledger";

  return raw;
}

function extractTypeRaw(item: any): string {
  if (!item || typeof item !== "object") return "";

  const explicit = firstString(
    item?.event_type,
    item?.eventType,
    item?.type,
    item?.kind,
    item?.entity_type,
    item?.entityType,
    item?.target_type,
    item?.targetType,
    item?.source_type,
    item?.sourceType,
    item?.meta?.event_type,
    item?.meta?.eventType,
    item?.meta?.type,
    item?.meta?.kind,
    item?.meta?.entity_type,
    item?.meta?.entityType,
    item?.meta?.target_type,
    item?.meta?.targetType
  );

  const normalizedExplicit = normalizeTypeToken(explicit);
  if (normalizedExplicit) return normalizedExplicit;

  const sourceId = toNum(
    item?.source_id ?? item?.sourceId ?? item?.id ?? item?.entity_id ?? item?.entityId
  );

  if (sourceId && sourceId > 0) {
    const hasMemoryId =
      toNum(item?.memory_id) ??
      toNum(item?.memoryId) ??
      toNum(item?.meta?.memory_id) ??
      toNum(item?.meta?.memoryId);

    const hasChapterId =
      toNum(item?.chapter_id) ??
      toNum(item?.chapterId) ??
      toNum(item?.meta?.chapter_id) ??
      toNum(item?.meta?.chapterId);

    if (hasMemoryId && !hasChapterId) return "memory";
    if (hasChapterId && !hasMemoryId) return "chapter";
  }

  return "";
}

function extractIdFromTimelineKey(
  id: string
): { kind: "memory" | "chapter" | "unknown"; id: number | null } {
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
  const typeRaw = extractTypeRaw(raw);

  const sourceId = toNum(raw?.source_id ?? raw?.sourceId ?? raw?.id ?? raw?.entity_id ?? raw?.entityId);

  const metaMid = toNum(raw?.meta?.memory_id) ?? toNum(raw?.meta?.memoryId);
  const metaCid = toNum(raw?.meta?.chapter_id) ?? toNum(raw?.meta?.chapterId);

  const mid =
    toNum(raw?.memory_id) ??
    toNum(raw?.memoryId) ??
    toNum(raw?.id_memory) ??
    toNum(raw?.idMemory);

  const cid =
    toNum(raw?.chapter_id) ??
    toNum(raw?.chapterId) ??
    toNum(raw?.id_chapter) ??
    toNum(raw?.idChapter);

  if (typeRaw === "memory") {
    return { kind: "memory", id: sourceId ?? metaMid ?? mid ?? null };
  }

  if (typeRaw === "chapter") {
    return { kind: "chapter", id: sourceId ?? metaCid ?? cid ?? null };
  }

  if (metaMid && !metaCid) return { kind: "memory", id: metaMid };
  if (metaCid && !metaMid) return { kind: "chapter", id: metaCid };

  if (mid && !cid) return { kind: "memory", id: mid };
  if (cid && !mid) return { kind: "chapter", id: cid };

  return { kind: "unknown", id: null };
}

function extractNav(item: any): string | null {
  const nav = firstString(item?.nav, item?.meta?.nav);
  return nav || null;
}

function parseNavTarget(nav: string | null): { kind: "memory" | "chapter" | "unknown"; id: number | null } {
  const s = String(nav || "").trim();
  if (!s) return { kind: "unknown", id: null };

  const m = s.match(/\/memories\/(\d+)/i);
  if (m) return { kind: "memory", id: Number(m[1]) };

  const c = s.match(/\/chapters\/(\d+)/i);
  if (c) return { kind: "chapter", id: Number(c[1]) };

  return { kind: "unknown", id: null };
}

function detectEventKind(ev: TimelineEvent): TimelineKind {
  const raw = ev.raw || {};
  const typeRaw = extractTypeRaw(raw);

  if (typeRaw === "memory") return "Memória";
  if (typeRaw === "chapter") return "Capítulo";
  if (typeRaw === "version") return "Versão";
  if (typeRaw === "rollback") return "Rollback";
  if (typeRaw === "ledger") return "Evento";

  const navTarget = parseNavTarget(extractNav(raw));
  if (navTarget.kind === "memory") return "Memória";
  if (navTarget.kind === "chapter") return "Capítulo";

  const source = String(ev.source || "").trim().toLowerCase();
  if (source === "memories") return "Memória";
  if (source === "chapters") return "Capítulo";
  if (source === "versions") return "Versão";
  if (source === "ledger") return "Evento";

  const idKind = extractIdFromTimelineKey(ev.id);
  if (idKind.kind === "memory") return "Memória";
  if (idKind.kind === "chapter") return "Capítulo";

  const target = extractTarget(ev);
  if (target.kind === "memory") return "Memória";
  if (target.kind === "chapter") return "Capítulo";

  return ev.kind || "Evento";
}

function normalizeApiTimelineItemToEvent(item: any): TimelineEvent | null {
  if (!item || typeof item !== "object") return null;

  const typeRaw = extractTypeRaw(item);
  const title =
    firstString(
      item?.title,
      item?.name,
      item?.headline,
      item?.label,
      item?.meta?.title,
      item?.meta?.name
    ) || fallbackTitleByType(typeRaw);

  const at = firstString(
    item?.date,
    item?.at,
    item?.activity_at,
    item?.created_at,
    item?.updated_at,
    item?.event_at,
    item?.occurred_at,
    item?.meta?.activity_at
  );

  const sourceId = firstString(
    item?.source_id,
    item?.sourceId,
    item?.id,
    item?.entity_id,
    item?.entityId
  );

  let source: TimelineEvent["source"] = "unknown";
  if (typeRaw === "memory") source = "memories";
  else if (typeRaw === "chapter") source = "chapters";
  else if (typeRaw === "version") source = "versions";
  else if (typeRaw === "ledger" || typeRaw === "rollback") source = "ledger";

  let id = "";
  if (typeRaw === "memory") id = `memory:${sourceId || item?.memory_id || item?.memoryId || ""}`;
  else if (typeRaw === "chapter") id = `chapter:${sourceId || item?.chapter_id || item?.chapterId || ""}`;
  else if (typeRaw === "version") {
    id = `version:${sourceId || `${item?.memory_id ?? ""}:${item?.version_number ?? ""}`}`;
  } else if (typeRaw === "rollback") {
    id = `rollback:${sourceId || Math.random().toString(36).slice(2)}`;
  } else {
    id = `event:${sourceId || Math.random().toString(36).slice(2)}`;
  }

  const note =
    firstString(
      item?.note,
      item?.summary,
      item?.preview,
      item?.description,
      item?.meta?.note,
      item?.meta?.preview,
      item?.meta?.description,
      item?.meta?.summary
    ) || undefined;

  const raw = item;
  const atSafe = at || new Date().toISOString();

  const draft: TimelineEvent = {
    id,
    at: atSafe,
    title,
    kind: "Evento",
    note,
    source,
    raw,
  };

  draft.kind = detectEventKind(draft);
  return draft;
}

function labelForKind(kind: TimelineKind): string {
  if (kind === "Memória") return "Memória";
  if (kind === "Capítulo") return "Capítulo";
  if (kind === "Versão") return "Versão";
  if (kind === "Rollback") return "Rollback";
  return "Evento";
}

function countDistinctByKind(events: TimelineEvent[], kind: TimelineKind): number {
  const ids = new Set<string>();

  for (const ev of events) {
    if (detectEventKind(ev) !== kind) continue;

    const navTarget = parseNavTarget(extractNav(ev.raw));
    if (navTarget.kind !== "unknown" && navTarget.id) {
      ids.add(`${navTarget.kind}:${navTarget.id}`);
      continue;
    }

    const t = extractTarget(ev);
    if (t.kind !== "unknown" && t.id) {
      ids.add(`${t.kind}:${t.id}`);
      continue;
    }

    ids.add(ev.id);
  }

  return ids.size;
}

function getSummaryCounts(meta: any) {
  const inventoryMemories = toNum(meta?.summary?.inventory?.memories ?? meta?.inventory?.memories);
  const inventoryChapters = toNum(meta?.summary?.inventory?.chapters ?? meta?.inventory?.chapters);

  const searchMemories = toNum(meta?.summary?.search?.memories ?? meta?.search_inventory?.memories);
  const searchChapters = toNum(meta?.summary?.search?.chapters ?? meta?.search_inventory?.chapters);

  const resultMemories = toNum(meta?.summary?.result?.memories);
  const resultChapters = toNum(meta?.summary?.result?.chapters);

  const visibleMemories = toNum(meta?.summary?.visible?.memories);
  const visibleChapters = toNum(meta?.summary?.visible?.chapters);

  return {
    inventoryMemories,
    inventoryChapters,
    searchMemories,
    searchChapters,
    resultMemories,
    resultChapters,
    visibleMemories,
    visibleChapters,
  };
}

function getMatchReasonLabel(raw: any): string | null {
  const reason = firstString(raw?.match_reason, raw?.meta?.match_reason).toLowerCase();

  if (reason === "chapter_context") return "Contexto do capítulo";
  if (reason === "direct") return "Match direto";
  return null;
}

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
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchTick, setSearchTick] = useState(0);

  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryMemoriesTotal, setInventoryMemoriesTotal] = useState<number | null>(null);
  const [inventoryChaptersTotal, setInventoryChaptersTotal] = useState<number | null>(null);
  const [searchMemoriesTotal, setSearchMemoriesTotal] = useState<number | null>(null);
  const [searchChaptersTotal, setSearchChaptersTotal] = useState<number | null>(null);
  const [visibleApiMemoriesTotal, setVisibleApiMemoriesTotal] = useState<number | null>(null);
  const [visibleApiChaptersTotal, setVisibleApiChaptersTotal] = useState<number | null>(null);

  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const requestSeqRef = useRef(0);
  const fetchLockRef = useRef(0);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 250);

    return () => window.clearTimeout(t);
  }, [query]);

  function toggleOpen(id: string) {
    setOpenMap((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function openEvent(ev: TimelineEvent) {
    const raw = ev.raw || {};
    const nav = extractNav(raw);
    const navTarget = parseNavTarget(nav);

    if (navTarget.kind === "memory" && navTarget.id) {
      navigate(`/memories/${navTarget.id}`);
      return;
    }

    if (navTarget.kind === "chapter" && navTarget.id) {
      try {
        sessionStorage.setItem("hdud_open_chapter_id", String(navTarget.id));
      } catch {}
      navigate("/chapters");
      return;
    }

    const memoryId =
      raw.memory_id ??
      raw.memoryId ??
      raw.meta?.memory_id ??
      raw.meta?.memoryId ??
      null;

    const chapterId =
      raw.chapter_id ??
      raw.chapterId ??
      raw.meta?.chapter_id ??
      raw.meta?.chapterId ??
      null;

    if (memoryId) {
      navigate(`/memories/${memoryId}`);
      return;
    }

    if (chapterId) {
      try {
        sessionStorage.setItem("hdud_open_chapter_id", String(chapterId));
      } catch {}
      navigate("/chapters");
      return;
    }

    toggleOpen(ev.id);
  }

  async function loadTimeline(filter: FilterKey, q: string) {
    setLoading(true);
    setErrorMsg(null);

    const token = getAuthToken();
    const seq = ++requestSeqRef.current;
    fetchLockRef.current = seq;

    try {
      const { ok, status, data } = await fetchTimeline(token, filter, q);

      if (fetchLockRef.current !== seq) return;

      if (!ok) {
        const detail =
          typeof data === "object" && data
            ? data?.detail || data?.error || JSON.stringify(data)
            : String(data);

        setErrorMsg(`Não foi possível carregar a Timeline (HTTP ${status}). ${detail || ""}`.trim());
        setEvents([]);
        setWarnings([]);
        return;
      }

      if (looksLikeHtml(data)) {
        setErrorMsg("A Timeline recebeu HTML no lugar de JSON. Use a rota /api/timeline no frontend.");
        setEvents([]);
        setWarnings([]);
        return;
      }

      const payload = data as TimelineResponse;
      const rawItems = Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray((data as any)?.items)
        ? (data as any).items
        : [];
      const warns = Array.isArray(payload?.warnings) ? payload.warnings : [];

      const normalized: TimelineEvent[] = [];
      for (const it of rawItems) {
        const ev = normalizeApiTimelineItemToEvent(it);
        if (!ev) continue;
        if (detectEventKind(ev) === "Versão") continue;
        normalized.push(ev);
      }

      const summary = getSummaryCounts((payload as any)?.meta || (data as any)?.meta || null);

      if (summary.inventoryMemories != null) setInventoryMemoriesTotal(summary.inventoryMemories);
      if (summary.inventoryChapters != null) setInventoryChaptersTotal(summary.inventoryChapters);

      setSearchMemoriesTotal(summary.searchMemories);
      setSearchChaptersTotal(summary.searchChapters);
      setVisibleApiMemoriesTotal(summary.resultMemories ?? summary.visibleMemories);
      setVisibleApiChaptersTotal(summary.resultChapters ?? summary.visibleChapters);

      setEvents(normalized.sort(sortEventsDesc));
      setWarnings(warns);
      setLastUpdated(new Date());
      setOpenMap({});
    } catch {
      if (fetchLockRef.current !== seq) return;
      setErrorMsg("Falha de rede ao carregar a Timeline. Verifique API e token.");
      setEvents([]);
      setWarnings([]);
    } finally {
      if (fetchLockRef.current === seq) {
        setLoading(false);
      }
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
      const memPath = authorOk
        ? `/api/authors/${authorId}/memories`
        : `/api/memories`;

      const chapPath = authorOk
        ? `/api/authors/${authorId}/chapters`
        : `/api/chapters`;

      const [memRes, chapRes] = await Promise.all([
        fetchJsonDirect(memPath, token),
        fetchJsonDirect(chapPath, token),
      ]);

      const memData = memRes.data;
      const chapData = chapRes.data;

      const memTotalFromMeta =
        (memData &&
          typeof memData === "object" &&
          ((memData as any)?.total ??
            (memData as any)?.meta?.total ??
            (memData as any)?.meta?.count ??
            (memData as any)?.count)) ??
        null;

      if (typeof memTotalFromMeta === "number" && Number.isFinite(memTotalFromMeta)) {
        setInventoryMemoriesTotal(memTotalFromMeta);
      } else {
        const memList = Array.isArray((memData as any)?.items)
          ? (memData as any).items
          : Array.isArray((memData as any)?.memories)
          ? (memData as any).memories
          : Array.isArray(memData)
          ? memData
          : [];

        const ids = new Set<number>();
        for (const x of memList) {
          const id = toNum(
            (x as any)?.memory_id ??
              (x as any)?.id ??
              (x as any)?.memoryId ??
              (x as any)?.id_memory
          );
          if (id && id > 0) ids.add(id);
        }
        setInventoryMemoriesTotal(ids.size || memList.length || null);
      }

      const chapList = Array.isArray((chapData as any)?.items)
        ? (chapData as any).items
        : Array.isArray((chapData as any)?.chapters)
        ? (chapData as any).chapters
        : Array.isArray(chapData)
        ? chapData
        : [];

      const chapIds = new Set<number>();
      for (const x of chapList) {
        const id = toNum((x as any)?.chapter_id ?? (x as any)?.id ?? (x as any)?.chapterId);
        if (id && id > 0) chapIds.add(id);
      }
      setInventoryChaptersTotal(chapIds.size || chapList.length || null);
    } finally {
      setInventoryLoading(false);
    }
  }

  async function loadAll() {
    await Promise.all([loadTimeline(activeFilter, debouncedQuery), loadInventory()]);
  }

  function runSearchNow() {
    const q = query.trim();
    setDebouncedQuery(q);
    setSearchTick((v) => v + 1);
  }

  useEffect(() => {
    loadInventory();
  }, []);

  useEffect(() => {
    loadTimeline(activeFilter, debouncedQuery);
  }, [activeFilter, debouncedQuery, searchTick]);

  const allDisplayableEvents = useMemo(() => {
    return events.filter((ev) => detectEventKind(ev) !== "Versão");
  }, [events]);

  const displayEvents = useMemo(() => {
    if (activeFilter === "Memórias") {
      return allDisplayableEvents.filter((ev) => detectEventKind(ev) === "Memória");
    }

    if (activeFilter === "Capítulos") {
      return allDisplayableEvents.filter((ev) => detectEventKind(ev) === "Capítulo");
    }

    return allDisplayableEvents;
  }, [allDisplayableEvents, activeFilter]);

  const chipCounts = useMemo(() => {
    const visibleMemoriesFallback = countDistinctByKind(events, "Memória");
    const visibleChaptersFallback = countDistinctByKind(events, "Capítulo");
    const searchActive = debouncedQuery.trim().length > 0;

    const memories = searchActive
      ? searchMemoriesTotal ?? visibleApiMemoriesTotal ?? visibleMemoriesFallback
      : inventoryMemoriesTotal ?? visibleApiMemoriesTotal ?? visibleMemoriesFallback;

    const chapters = searchActive
      ? searchChaptersTotal ?? visibleApiChaptersTotal ?? visibleChaptersFallback
      : inventoryChaptersTotal ?? visibleApiChaptersTotal ?? visibleChaptersFallback;

    return {
      Tudo: memories + chapters,
      Memórias: memories,
      Capítulos: chapters,
    };
  }, [
    events,
    inventoryMemoriesTotal,
    inventoryChaptersTotal,
    searchMemoriesTotal,
    searchChaptersTotal,
    visibleApiMemoriesTotal,
    visibleApiChaptersTotal,
    debouncedQuery,
  ]);

  const grouped = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();

    for (const ev of displayEvents) {
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
  }, [displayEvents]);

  const statusLine = useMemo(() => {
    if (loading) return "Carregando…";
    if (errorMsg) return "Erro";
    return "Ativa";
  }, [loading, errorMsg]);

  const inventoryLine = useMemo(() => {
    const mem = inventoryMemoriesTotal;
    const chap = inventoryChaptersTotal;
    const searchActive = debouncedQuery.trim().length > 0;

    if (!searchActive) {
      if (mem == null && chap == null) return null;

      const parts: string[] = [];
      if (mem != null) parts.push(`Memórias no acervo: ${mem}`);
      if (chap != null) parts.push(`Capítulos no acervo: ${chap}`);
      return parts.join(" • ");
    }

    const parts: string[] = [];
    if (searchMemoriesTotal != null) parts.push(`Memórias encontradas: ${searchMemoriesTotal}`);
    if (searchChaptersTotal != null) parts.push(`Capítulos encontrados: ${searchChaptersTotal}`);
    return parts.length ? parts.join(" • ") : null;
  }, [
    inventoryMemoriesTotal,
    inventoryChaptersTotal,
    searchMemoriesTotal,
    searchChaptersTotal,
    debouncedQuery,
  ]);

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.headerRow}>
          <div style={{ minWidth: 0 }}>
            <div style={styles.h1}>Timeline</div>
            <div style={styles.sub}>
              Nada se perde. Aqui está a linha do tempo do que aconteceu na sua história — agora com trilho híbrido entre eventos materializados, acervo real e contexto de capítulo.
            </div>

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
            </div>
          </div>

          <div style={styles.headerActions}>
            <button
              type="button"
              style={{ ...styles.btn, ...((loading || inventoryLoading) ? styles.btnDisabled : {}) }}
              onClick={loadAll}
              disabled={loading || inventoryLoading}
            >
              {loading || inventoryLoading ? "Atualizando…" : "Atualizar"}
            </button>
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.rowBetween}>
          <div>
            <div style={styles.cardTitle}>Em foco</div>
            <div style={styles.cardMeta}>Busca e filtro obedecem à API real da Timeline híbrida.</div>
            {inventoryLine ? <div style={{ ...styles.cardMeta, marginTop: 6 }}>{inventoryLine}</div> : null}
          </div>

          <div style={styles.smallMuted}>
            Visíveis: <b>{displayEvents.length}</b>
            {inventoryLoading ? <span style={{ marginLeft: 8, opacity: 0.75 }}>• Inventário…</span> : null}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          {filters.map((f) => {
            const isActive = f === activeFilter;
            const count =
              f === "Tudo"
                ? chipCounts.Tudo
                : f === "Memórias"
                ? chipCounts.Memórias
                : chipCounts.Capítulos;

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
          <div style={{ flex: 1 }}>
            <div style={styles.labelTop}>Buscar</div>
            <input
              style={styles.input}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  runSearchNow();
                }
              }}
              placeholder="Título, conteúdo, memória, capítulo…"
            />
          </div>

          <button type="button" style={styles.btn} onClick={runSearchNow}>
            Buscar agora
          </button>

          <button
            type="button"
            style={styles.btnGhost}
            onClick={() => {
              setQuery("");
              setDebouncedQuery("");
              setSearchTick((v) => v + 1);
            }}
          >
            Limpar
          </button>
        </div>

        <div style={{ ...styles.smallMuted, marginTop: 8 }}>
          A pesquisa consulta a API real por <code>q</code>, <code>type</code> e <code>limit</code>, com fallback de acervo real e contexto de capítulo.
        </div>

        {warnings.length > 0 && (
          <div style={styles.warnBox}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Avisos</div>
            {warnings.slice(0, 8).map((w, i) => (
              <div key={`warn-${i}`}>• {w}</div>
            ))}
          </div>
        )}
      </div>

      <div style={styles.card}>
        <div style={styles.rowBetween}>
          <div>
            <div style={styles.cardTitle}>Em ordem</div>
            <div style={styles.cardMeta}>Do mais recente para o mais antigo, agrupados por dia.</div>
          </div>
          <div style={styles.smallMuted}>{loading ? "Carregando…" : "Ativa"}</div>
        </div>

        {errorMsg ? (
          <div style={styles.errorBox}>
            <div style={{ fontWeight: 900 }}>Não foi possível carregar a Timeline</div>
            <div style={{ marginTop: 6, opacity: 0.85 }}>{errorMsg}</div>
            <button type="button" style={{ ...styles.btn, marginTop: 12 }} onClick={loadAll}>
              Tentar novamente
            </button>
          </div>
        ) : loading ? (
          <div style={styles.infoBox}>Carregando eventos…</div>
        ) : displayEvents.length === 0 ? (
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
                    const navTarget = parseNavTarget(extractNav(it.raw));
                    const effectiveTarget = navTarget.kind !== "unknown" ? navTarget : target;
                    const kind = detectEventKind(it);
                    const matchReasonLabel = getMatchReasonLabel(it.raw);

                    const canOpen =
                      (kind === "Memória" && effectiveTarget.kind === "memory" && Boolean(effectiveTarget.id)) ||
                      (kind === "Capítulo" && effectiveTarget.kind === "chapter" && Boolean(effectiveTarget.id));

                    const seal = labelForKind(kind);
                    const openLabel =
                      kind === "Memória"
                        ? "Abrir memória"
                        : kind === "Capítulo"
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
                                {kindIcon(kind)} <b>{time}</b> {rel ? <span style={{ opacity: 0.7 }}>({rel})</span> : null}
                              </span>

                              <span style={styles.badgeSoftSmall}>
                                <b>{seal}</b>
                              </span>

                              {matchReasonLabel ? (
                                <span style={styles.badgeSoftSmall}>
                                  <b>{matchReasonLabel}</b>
                                </span>
                              ) : null}
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

                          <div style={styles.kindPill}>{seal}</div>
                        </div>

                        {isOpen && (
                          <div style={styles.detailsBox} onClick={(e) => e.stopPropagation()}>
                            <div style={{ fontWeight: 900, marginBottom: 6 }}>Detalhes do evento</div>
                            <div style={styles.smallMuted}>
                              target: <b>{effectiveTarget.kind}:{effectiveTarget.id ?? "—"}</b>
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
          A tela consome <code>/api/timeline</code> com <code>q</code>, <code>type</code> e <code>limit</code>. A navegação prioriza o{" "}
          <code>meta.nav</code> vindo do backend para evitar abrir o ID errado.
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

  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "flex-start",
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },

  h1: { fontSize: 28, fontWeight: 900, letterSpacing: -0.4, marginBottom: 6 },
  sub: { opacity: 0.78, fontSize: 13, lineHeight: 1.35 },

  badgeRow: {
    marginTop: 10,
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },
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
    fontWeight: 900,
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

  rowBetween: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
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

  searchRow: {
    display: "flex",
    gap: 12,
    marginTop: 12,
    alignItems: "flex-end",
    flexWrap: "wrap",
  },
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

  dayHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
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
    fontWeight: 900,
    lineHeight: 1.25,
  },
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