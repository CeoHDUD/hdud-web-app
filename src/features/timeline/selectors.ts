// C:\HDUD_DATA\hdud-web-app\src\features\timeline\selectors.ts

import type {
  ChapterSuggestionItem,
  FilterKey,
  IntelligencePanel,
  ThreadEventSummary,
  TimelineEvent,
  TimelineKind,
  TimelineThread,
} from "./types";
import {
  extractNav,
  extractRelatedTitlesFromThread,
  extractTypeRaw,
  fallbackTitleByType,
  firstString,
  getEditorialScore,
  getResolvedChapterTitle,
  humanizeEditorialReason,
  normalizeSuggestionId,
  parseNavTarget,
  safeDateMs,
  toNum,
  uniqueNonEmpty,
  labelForKind,
} from "./utils";

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

export function extractTarget(
  ev: TimelineEvent
): { kind: "memory" | "chapter" | "unknown"; id: number | null } {
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

export function detectEventKind(ev: TimelineEvent): TimelineKind {
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

export function normalizeApiTimelineItemToEvent(item: any): TimelineEvent | null {
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

export function getThreadKey(ev: TimelineEvent): string {
  const entityKey = firstString(ev?.raw?.meta?.entity_key);
  if (entityKey) return entityKey;

  const target = extractTarget(ev);
  if (target.kind !== "unknown" && target.id) return `${target.kind}:${target.id}`;

  return ev.id;
}

export function sortEventsDesc(a: TimelineEvent, b: TimelineEvent) {
  const sa = getEditorialScore(a?.raw);
  const sb = getEditorialScore(b?.raw);
  if (sa !== sb) return sb - sa;

  const da = safeDateMs(a.at);
  const db = safeDateMs(b.at);
  return db - da;
}

export function buildNarrativeThreads(events: TimelineEvent[]): TimelineThread[] {
  const map = new Map<string, TimelineEvent[]>();

  for (const ev of events || []) {
    const key = getThreadKey(ev);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(ev);
  }

  const threads: TimelineThread[] = [];

  for (const [key, list] of map.entries()) {
    const ordered = [...list].sort(sortEventsDesc);

    const latestEvent =
      [...list].sort((a, b) => safeDateMs(b.at) - safeDateMs(a.at))[0] || ordered[0];

    const lead = ordered[0];
    const latestAt = latestEvent?.at || lead?.at || new Date().toISOString();
    const latestMs = safeDateMs(latestAt);
    const kind = detectEventKind(lead);
    const score = getEditorialScore(lead.raw);

    threads.push({
      id: key,
      lead,
      events: ordered,
      count: ordered.length,
      latestAt,
      latestMs,
      score,
      kind,
    });
  }

  threads.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    return b.latestMs - a.latestMs;
  });

  return threads;
}

export function humanizeRawEventType(raw: any): string | null {
  const explicit = firstString(raw?.meta?.narrative_line_label);
  if (explicit) return explicit;

  const token = firstString(raw?.meta?.raw_event_type, raw?.raw_event_type, raw?.event_type)
    .toLowerCase()
    .trim();

  if (!token) return null;
  if (token === "memory_created") return "Criação da memória";
  if (token === "memory_updated") return "Atualização da memória";
  if (token === "memory_version") return "Nova versão publicada";
  if (token === "memory_linked_to_chapter") return "Vinculação ao capítulo";
  if (token === "memory_reordered") return "Reordenação narrativa";
  if (token === "chapter_created") return "Criação do capítulo";
  if (token === "chapter_updated") return "Atualização do capítulo";
  if (token === "chapter_published") return "Publicação do capítulo";
  if (token === "rollback") return "Restauração narrativa";

  return token.replace(/_/g, " ");
}

export function getThreadSummaryLabel(ev: TimelineEvent): string {
  return humanizeRawEventType(ev.raw) || labelForKind(detectEventKind(ev));
}

export function summarizeThreadEvents(events: TimelineEvent[]): ThreadEventSummary[] {
  const buckets = new Map<string, TimelineEvent[]>();

  for (const ev of events || []) {
    const key = getThreadSummaryLabel(ev);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(ev);
  }

  const summaries: ThreadEventSummary[] = [];

  for (const [label, bucketEvents] of buckets.entries()) {
    const ordered = [...bucketEvents].sort((a, b) => safeDateMs(b.at) - safeDateMs(a.at));
    const leadEvent = ordered[0];
    const latestAt = leadEvent?.at || new Date().toISOString();

    summaries.push({
      key: `${label}:${leadEvent?.id || Math.random().toString(36).slice(2)}`,
      label,
      count: ordered.length,
      latestAt,
      latestMs: safeDateMs(latestAt),
      events: ordered,
      leadEvent,
    });
  }

  summaries.sort((a, b) => b.latestMs - a.latestMs);
  return summaries;
}

export function buildIntelligencePanel(
  displayThreads: TimelineThread[],
  activeFilter: FilterKey
): IntelligencePanel | null {
  if (!displayThreads.length) return null;

  const chapterThreads = displayThreads.filter((t) => detectEventKind(t.lead) === "Capítulo");
  const memoryThreads = displayThreads.filter((t) => detectEventKind(t.lead) === "Memória");

  const dominantChapterThread =
    [...chapterThreads].sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      return b.latestMs - a.latestMs;
    })[0] || null;

  const pivotMemoryThread =
    [...memoryThreads].sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      return b.latestMs - a.latestMs;
    })[0] || null;

  const topThread =
    [...displayThreads].sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      return b.latestMs - a.latestMs;
    })[0] || null;

  const dominantChapter = dominantChapterThread?.lead?.title || null;
  const pivotMemory = pivotMemoryThread?.lead?.title || null;
  const topEvent = topThread?.lead || null;
  const topEventScore = topThread?.score || 0;

  const periodLabel =
    activeFilter === "Memórias"
      ? "recorte de memórias"
      : activeFilter === "Capítulos"
      ? "recorte de capítulos"
      : "recorte completo da Timeline";

  const executiveReading = topEvent
    ? `No ${periodLabel}, a narrativa é liderada por ${
        dominantChapter ? `“${dominantChapter}”` : "um capítulo emergente"
      }, impulsionada por ${
        pivotMemory ? `“${pivotMemory}”` : "uma memória pivô ainda em consolidação"
      }, com pico editorial em “${topEvent.title}” (score ${topEventScore}).`
    : "Ainda não há massa narrativa suficiente para leitura executiva.";

  const investorSummary = topEvent
    ? `Para investidor: o sistema já consegue identificar protagonismo narrativo, entidade catalisadora e evento de maior relevância editorial, transformando histórico bruto em leitura executiva acionável.`
    : "Para investidor: a Timeline ainda aguarda densidade narrativa para formar uma leitura executiva robusta.";

  const dominantRefs = extractRelatedTitlesFromThread(dominantChapterThread, dominantChapter);
  const pivotRefs = extractRelatedTitlesFromThread(pivotMemoryThread, pivotMemory);
  const topEventRefs = extractRelatedTitlesFromThread(topThread, topEvent?.title || null);

  const suggestionsBase: ChapterSuggestionItem[] = [
    {
      id: normalizeSuggestionId(`Consolidação de ${dominantChapter || "capítulo dominante"}`, 0),
      title: dominantChapter
        ? `Consolidação editorial de ${dominantChapter}`
        : "Consolidação editorial do capítulo dominante",
      rationale:
        "Sugestão orientada pelo capítulo com maior score editorial e maior capacidade de organizar a narrativa recente.",
      basedOn: uniqueNonEmpty([dominantChapter || "", pivotMemory || "", topEvent?.title || ""], 3),
    },
    {
      id: normalizeSuggestionId(`Expansão de ${pivotMemory || "memória pivô"}`, 1),
      title: pivotMemory
        ? `Expansão narrativa a partir de ${pivotMemory}`
        : "Expansão narrativa a partir da memória pivô",
      rationale:
        "Sugestão centrada na memória que melhor explica a tração do período e pode originar um capítulo mais profundo.",
      basedOn: uniqueNonEmpty([pivotMemory || "", ...pivotRefs, dominantChapter || ""], 3),
    },
    {
      id: normalizeSuggestionId(`Movimento em ${topEvent?.title || "evento principal"}`, 2),
      title: topEvent
        ? `Movimento editorial recente em ${topEvent.title}`
        : "Movimento editorial recente do evento principal",
      rationale:
        "Sugestão pensada para capturar o evento de maior score e transformá-lo em uma unidade narrativa apresentável para investidor.",
      basedOn: uniqueNonEmpty([topEvent?.title || "", ...topEventRefs, pivotMemory || ""], 3),
    },
  ];

  void dominantRefs;

  return {
    dominantChapter,
    dominantChapterScore: dominantChapterThread?.score || 0,
    dominantChapterThread,
    pivotMemory,
    pivotMemoryScore: pivotMemoryThread?.score || 0,
    pivotMemoryThread,
    topEvent,
    topEventScore,
    executiveReading,
    investorSummary,
    chapterSuggestions: suggestionsBase,
  };
}

export function getEventEditorialReasons(raw: any): string[] {
  return (raw?.meta?.editorial_reason || [])
    .filter((x: any) => typeof x === "string" && x.trim())
    .map(humanizeEditorialReason);
}