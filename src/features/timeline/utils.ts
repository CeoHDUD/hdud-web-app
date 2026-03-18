// C:\HDUD_DATA\hdud-web-app\src\features\timeline\utils.ts

import type {
  EditorialCardLevel,
  InventoryEntity,
  InventoryScopeKind,
  TimelineEvent,
  TimelineKind,
  TimelineThread,
} from "./types";

export function safeDateParse(value: string): Date | null {
  if (!value) return null;

  const d1 = new Date(value);
  if (!isNaN(d1.getTime())) return d1;

  const d2 = new Date(String(value).replace(" ", "T"));
  if (!isNaN(d2.getTime())) return d2;

  return null;
}

export function safeDateMs(value: string): number {
  return safeDateParse(value)?.getTime() ?? -Infinity;
}

export function formatDayLabel(d: Date): string {
  return d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function formatTimeLabel(d: Date): string {
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function formatRelative(d: Date): string {
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

export function clampText(s: string, max = 160) {
  const t = (s || "").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

export function kindIcon(kind: TimelineKind): string {
  if (kind === "Memória") return "🧠";
  if (kind === "Capítulo") return "📚";
  if (kind === "Versão") return "🧾";
  if (kind === "Rollback") return "⏪";
  return "•";
}

export function fallbackTitleByType(typeRaw: string): string {
  if (typeRaw === "memory") return "(Memória sem título)";
  if (typeRaw === "chapter") return "(Capítulo sem título)";
  if (typeRaw === "version") return "(Versão sem título)";
  if (typeRaw === "rollback") return "(Rollback)";
  return "(Evento)";
}

export function toNum(v: any): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}

export function firstString(...values: any[]): string {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

export function normalizeTypeToken(input: any): string {
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

export function extractTypeRaw(item: any): string {
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

export function extractIdFromTimelineKey(
  id: string
): { kind: "memory" | "chapter" | "unknown"; id: number | null } {
  const s = String(id || "").trim();

  const m1 = s.match(/^memory:(\d+)$/i);
  if (m1) return { kind: "memory", id: Number(m1[1]) };

  const c1 = s.match(/^chapter:(\d+)$/i);
  if (c1) return { kind: "chapter", id: Number(c1[1]) };

  return { kind: "unknown", id: null };
}

export function extractNav(item: any): string | null {
  const nav = firstString(item?.nav, item?.meta?.nav);
  return nav || null;
}

export function parseNavTarget(
  nav: string | null
): { kind: "memory" | "chapter" | "unknown"; id: number | null } {
  const s = String(nav || "").trim();
  if (!s) return { kind: "unknown", id: null };

  const m = s.match(/\/memories\/(\d+)/i);
  if (m) return { kind: "memory", id: Number(m[1]) };

  const c = s.match(/\/chapters\/(\d+)/i);
  if (c) return { kind: "chapter", id: Number(c[1]) };

  return { kind: "unknown", id: null };
}

export function labelForKind(kind: TimelineKind): string {
  if (kind === "Memória") return "Memória";
  if (kind === "Capítulo") return "Capítulo";
  if (kind === "Versão") return "Versão";
  if (kind === "Rollback") return "Rollback";
  return "Evento";
}

export function getSummaryCounts(meta: any) {
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

export function getMatchReasonLabel(raw: any): string | null {
  const reason = firstString(raw?.match_reason, raw?.meta?.match_reason).toLowerCase();

  if (reason === "chapter_context") return "Contexto do capítulo";
  if (reason === "direct") return "Match direto";
  return null;
}

export function getEditorialScore(raw: any): number {
  return Number(raw?.meta?.editorial_score || 0);
}

export function getEditorialReasons(raw: any): string[] {
  const arr = raw?.meta?.editorial_reason;
  return Array.isArray(arr) ? arr.filter((x: any) => typeof x === "string" && x.trim()) : [];
}

export function humanizeEditorialReason(reason: string): string {
  const key = String(reason || "").toLowerCase();

  if (key.startsWith("chapter_primary:")) return "Capítulo principal";
  if (key.startsWith("recency:")) return "Recente";
  if (key.startsWith("version_activity:")) return "Atividade de versão";
  if (key.startsWith("narrative_event:")) return "Movimento narrativo";
  return reason;
}

export function getEditorialBand(score: number): "alto" | "medio" | "baixo" {
  if (score >= 12) return "alto";
  if (score >= 7) return "medio";
  return "baixo";
}

export function getEditorialBandLabel(score: number): string {
  const band = getEditorialBand(score);
  if (band === "alto") return "Alta relevância";
  if (band === "medio") return "Boa relevância";
  return "Base narrativa";
}

export function getEditorialCardLevel(raw: any): EditorialCardLevel {
  const explicit = firstString(raw?.meta?.card_level).toLowerCase();
  if (explicit === "hero") return "hero";
  if (explicit === "standard") return "standard";
  if (explicit === "base") return "base";

  const score = getEditorialScore(raw);
  if (score >= 12) return "hero";
  if (score >= 7) return "standard";
  return "base";
}

export function getResolvedChapterTitle(raw: any): string | null {
  return firstString(raw?.meta?.resolved_chapter_title, raw?.chapter_title, raw?.meta?.chapter_title) || null;
}

export function getChapterPrimary(raw: any): boolean {
  return Boolean(raw?.meta?.chapter_is_primary);
}

export function getPreviewValue(raw: any, fallbackNote?: string): string | null {
  const txt =
    firstString(
      raw?.meta?.preview,
      raw?.meta?.description,
      raw?.meta?.resolved_chapter_description,
      raw?.memory_content,
      raw?.chapter_description,
      fallbackNote
    ) || "";
  return txt ? clampText(txt, 220) : null;
}

export function getEditorialSummary(meta: any): {
  scoreMax: number | null;
  scoreAvg: number | null;
  high: number | null;
  medium: number | null;
  low: number | null;
} {
  const editorial = meta?.summary?.editorial;
  return {
    scoreMax: toNum(editorial?.score_max),
    scoreAvg: toNum(editorial?.score_avg),
    high: toNum(editorial?.buckets?.high),
    medium: toNum(editorial?.buckets?.medium),
    low: toNum(editorial?.buckets?.low),
  };
}

export function getNarrativeThreadSummary(meta: any): {
  totalThreads: number | null;
  multiEventThreads: number | null;
  visibleThreads: number | null;
  visibleMultiEventThreads: number | null;
} {
  const t = meta?.summary?.narrative_threads;
  return {
    totalThreads: toNum(t?.total_threads),
    multiEventThreads: toNum(t?.multi_event_threads),
    visibleThreads: toNum(t?.visible_threads),
    visibleMultiEventThreads: toNum(t?.visible_multi_event_threads),
  };
}

export function daysAgoFromIso(iso: string): number | null {
  const ms = safeDateMs(iso);
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.floor((Date.now() - ms) / 86400000));
}

export function averageScore(threads: TimelineThread[]): number {
  if (!threads.length) return 0;
  const sum = threads.reduce((acc, t) => acc + Number(t.score || 0), 0);
  return Number((sum / threads.length).toFixed(1));
}

export function getNarrativeMomentumLabel(
  avgScore: number,
  recentThreads: number,
  totalThreads: number
): string {
  if (avgScore >= 10 || recentThreads >= Math.max(6, Math.ceil(totalThreads * 0.18))) {
    return "Alta";
  }
  if (avgScore >= 6 || recentThreads >= Math.max(3, Math.ceil(totalThreads * 0.1))) {
    return "Boa";
  }
  return "Base";
}

export function getNarrativeMomentumTone(label: string): "high" | "medium" | "low" {
  if (label === "Alta") return "high";
  if (label === "Boa") return "medium";
  return "low";
}

export function normalizeCollection(data: any, entity: InventoryEntity): any[] {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== "object") return [];

  const entityList =
    entity === "memories"
      ? [data?.items, data?.memories, data?.rows, data?.data?.items, data?.data?.memories]
      : [data?.items, data?.chapters, data?.rows, data?.data?.items, data?.data?.chapters];

  for (const list of entityList) {
    if (Array.isArray(list)) return list;
  }

  return [];
}

export function extractTotalFromPayload(data: any): number | null {
  const total =
    toNum(data?.total) ??
    toNum(data?.count) ??
    toNum(data?.meta?.total) ??
    toNum(data?.meta?.count) ??
    toNum(data?.pagination?.total) ??
    toNum(data?.data?.total) ??
    null;

  return total != null && total >= 0 ? total : null;
}

export function dedupeEntityCount(list: any[], entity: InventoryEntity): number | null {
  if (!Array.isArray(list) || !list.length) return 0;

  const ids = new Set<number>();

  for (const x of list) {
    const id =
      entity === "memories"
        ? toNum((x as any)?.memory_id ?? (x as any)?.id ?? (x as any)?.memoryId ?? (x as any)?.id_memory)
        : toNum((x as any)?.chapter_id ?? (x as any)?.id ?? (x as any)?.chapterId);

    if (id && id > 0) ids.add(id);
  }

  return ids.size || list.length || 0;
}

export function extractAuthorIdFromEntity(item: any): number | null {
  return (
    toNum(item?.author_id) ??
    toNum(item?.authorId) ??
    toNum(item?.meta?.author_id) ??
    toNum(item?.meta?.authorId) ??
    null
  );
}

export function analyzeInventoryScope(
  list: any[],
  expectedAuthorId: number | null
): { scope: InventoryScopeKind; warnings: string[] } {
  if (!Array.isArray(list) || list.length === 0) {
    return { scope: "unknown", warnings: [] };
  }

  const authorIds = new Set<number>();
  let missingAuthorField = 0;

  for (const item of list) {
    const id = extractAuthorIdFromEntity(item);
    if (id && id > 0) authorIds.add(id);
    else missingAuthorField += 1;
  }

  if (authorIds.size === 0) {
    return {
      scope: "unknown",
      warnings:
        missingAuthorField > 0
          ? ["Não foi possível validar escopo por autor: payload sem author_id visível."]
          : [],
    };
  }

  if (!expectedAuthorId) {
    return {
      scope: authorIds.size === 1 ? "unknown" : "mixed",
      warnings:
        authorIds.size > 1
          ? ["Inventário retornou múltiplos author_id e o token não expôs author_id para validação."]
          : [],
    };
  }

  if (authorIds.size === 1 && authorIds.has(expectedAuthorId)) {
    return { scope: "author", warnings: [] };
  }

  if (authorIds.size === 1 && !authorIds.has(expectedAuthorId)) {
    return {
      scope: "global",
      warnings: [
        `Payload retornou author_id ${Array.from(authorIds)[0]} diferente do autor autenticado ${expectedAuthorId}.`,
      ],
    };
  }

  if (authorIds.has(expectedAuthorId)) {
    return {
      scope: "mixed",
      warnings: [
        `Payload contém registros do autor ${expectedAuthorId} misturados com outros autores (${Array.from(authorIds)
          .sort((a, b) => a - b)
          .join(", ")}).`,
      ],
    };
  }

  return {
    scope: "global",
    warnings: [
      `Payload contém apenas autores diferentes do autenticado (${Array.from(authorIds)
        .sort((a, b) => a - b)
        .join(", ")}).`,
    ],
  };
}

export function scopeLabel(scope: InventoryScopeKind): string {
  if (scope === "author") return "Escopo do autor";
  if (scope === "global") return "Escopo global";
  if (scope === "mixed") return "Escopo misto";
  return "Escopo não validado";
}

export function normalizeSuggestionId(text: string, index: number): string {
  return `sug-${index + 1}-${String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42)}`;
}

export function uniqueNonEmpty(values: string[], max = 3): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const raw of values || []) {
    const v = String(raw || "").trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
    if (out.length >= max) break;
  }

  return out;
}

export function extractRelatedTitlesFromThread(
  thread: TimelineThread | null,
  fallback?: string | null
): string[] {
  if (!thread) return fallback ? [fallback] : [];

  const candidates: string[] = [];

  for (const ev of thread.events || []) {
    const raw = ev.raw || {};
    const resolvedChapterTitle = getResolvedChapterTitle(raw);
    const title = firstString(
      ev.title,
      resolvedChapterTitle,
      raw?.chapter_title,
      raw?.memory_title,
      raw?.meta?.title,
      raw?.meta?.name
    );

    if (title) candidates.push(title);
    if (resolvedChapterTitle) candidates.push(resolvedChapterTitle);
  }

  if (fallback) candidates.unshift(fallback);

  return uniqueNonEmpty(candidates, 4);
}

export function countDistinctByKind(
  events: TimelineEvent[],
  kind: TimelineKind,
  detectEventKindFn: (ev: TimelineEvent) => TimelineKind,
  extractTargetFn: (ev: TimelineEvent) => { kind: "memory" | "chapter" | "unknown"; id: number | null }
): number {
  const ids = new Set<string>();

  for (const ev of events) {
    if (detectEventKindFn(ev) !== kind) continue;

    const navTarget = parseNavTarget(extractNav(ev.raw));
    if (navTarget.kind !== "unknown" && navTarget.id) {
      ids.add(`${navTarget.kind}:${navTarget.id}`);
      continue;
    }

    const t = extractTargetFn(ev);
    if (t.kind !== "unknown" && t.id) {
      ids.add(`${t.kind}:${t.id}`);
      continue;
    }

    ids.add(ev.id);
  }

  return ids.size;
}