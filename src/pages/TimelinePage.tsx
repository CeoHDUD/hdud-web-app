// C:\HDUD_DATA\hdud-web-app\src\pages\TimelinePage.tsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import TimelineThreadList from "../features/timeline/components/TimelineThreadList";
import TimelineIntelligencePanel from "../features/timeline/components/TimelineIntelligencePanel";
import {
  fetchInventoryWithFallback,
  fetchTimeline,
  getAuthToken,
  getAuthorIdFromToken,
  looksLikeHtml,
} from "../features/timeline/api";
import {
  buildIntelligencePanel,
  buildNarrativeThreads,
  detectEventKind,
  extractTarget,
  normalizeApiTimelineItemToEvent,
  sortEventsDesc,
} from "../features/timeline/selectors";
import type {
  FilterKey,
  IntelligencePanel,
  InventoryDiagnostics,
  InventoryScopeKind,
  NarrativeSummary,
  TimelineEvent,
  TimelineResponse,
  TimelineThread,
} from "../features/timeline/types";
import {
  analyzeInventoryScope,
  averageScore,
  countDistinctByKind,
  daysAgoFromIso,
  dedupeEntityCount,
  extractNav,
  extractTotalFromPayload,
  formatDayLabel,
  getEditorialSummary,
  getNarrativeMomentumLabel,
  getNarrativeMomentumTone,
  getNarrativeThreadSummary,
  getSummaryCounts,
  labelForKind,
  normalizeCollection,
  parseNavTarget,
  safeDateMs,
  safeDateParse,
  scopeLabel,
  toNum,
} from "../features/timeline/utils";

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
  const [timelineMeta, setTimelineMeta] = useState<any>(null);
  const [inventoryDiagnostics, setInventoryDiagnostics] = useState<InventoryDiagnostics>({
    authorId: null,
    memoriesScope: "unknown",
    chaptersScope: "unknown",
    memoriesRouteUsed: null,
    chaptersRouteUsed: null,
    warnings: [],
  });

  const [approvedSuggestionIds, setApprovedSuggestionIds] = useState<string[]>([]);
  const [submittedSuggestionIds, setSubmittedSuggestionIds] = useState<string[]>([]);
  const [suggestionNotice, setSuggestionNotice] = useState<string | null>(null);

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

  function toggleSuggestionApproval(id: string) {
    setApprovedSuggestionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    setSuggestionNotice(null);
  }

  function submitApprovedSuggestions() {
    if (!approvedSuggestionIds.length) {
      setSuggestionNotice("Selecione ao menos uma sugestão para submeter.");
      return;
    }

    setSubmittedSuggestionIds(approvedSuggestionIds);
    setSuggestionNotice(
      `${approvedSuggestionIds.length} sugestão(ões) aprovada(s) e marcada(s) como pronta(s) para submissão.`
    );
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
        setTimelineMeta(null);
        return;
      }

      if (looksLikeHtml(data)) {
        setErrorMsg("A Timeline recebeu HTML no lugar de JSON. Use a rota /api/timeline no frontend.");
        setEvents([]);
        setWarnings([]);
        setTimelineMeta(null);
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
      setTimelineMeta((payload as any)?.meta || (data as any)?.meta || null);
    } catch {
      if (fetchLockRef.current !== seq) return;
      setErrorMsg("Falha de rede ao carregar a Timeline. Verifique API e token.");
      setEvents([]);
      setWarnings([]);
      setTimelineMeta(null);
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
      setInventoryDiagnostics({
        authorId: null,
        memoriesScope: "unknown",
        chaptersScope: "unknown",
        memoriesRouteUsed: null,
        chaptersRouteUsed: null,
        warnings: [],
      });
      return;
    }

    const authorId = getAuthorIdFromToken(token);
    setInventoryLoading(true);

    try {
      const [memRes, chapRes] = await Promise.all([
        fetchInventoryWithFallback("memories", token, authorId),
        fetchInventoryWithFallback("chapters", token, authorId),
      ]);

      const nextWarnings: string[] = [];
      let nextMemoriesScope: InventoryScopeKind = "unknown";
      let nextChaptersScope: InventoryScopeKind = "unknown";

      if (memRes.ok && !looksLikeHtml(memRes.data)) {
        const memList = normalizeCollection(memRes.data, "memories");
        const memTotalFromMeta = extractTotalFromPayload(memRes.data);
        const memCount = memTotalFromMeta ?? dedupeEntityCount(memList, "memories");
        setInventoryMemoriesTotal(memCount);

        const memScope = analyzeInventoryScope(memList, authorId);
        nextMemoriesScope = memScope.scope;
        nextWarnings.push(...memScope.warnings);
      } else {
        setInventoryMemoriesTotal(null);
        if (memRes.status && memRes.status !== 404) {
          nextWarnings.push(`Inventário de memórias indisponível (HTTP ${memRes.status}).`);
        }
        if (looksLikeHtml(memRes.data)) {
          nextWarnings.push("Inventário de memórias retornou HTML em vez de JSON.");
        }
      }

      if (chapRes.ok && !looksLikeHtml(chapRes.data)) {
        const chapList = normalizeCollection(chapRes.data, "chapters");
        const chapTotalFromMeta = extractTotalFromPayload(chapRes.data);
        const chapCount = chapTotalFromMeta ?? dedupeEntityCount(chapList, "chapters");
        setInventoryChaptersTotal(chapCount);

        const chapScope = analyzeInventoryScope(chapList, authorId);
        nextChaptersScope = chapScope.scope;
        nextWarnings.push(...chapScope.warnings);
      } else {
        setInventoryChaptersTotal(null);
        if (chapRes.status && chapRes.status !== 404) {
          nextWarnings.push(`Inventário de capítulos indisponível (HTTP ${chapRes.status}).`);
        }
        if (looksLikeHtml(chapRes.data)) {
          nextWarnings.push("Inventário de capítulos retornou HTML em vez de JSON.");
        }
      }

      setInventoryDiagnostics({
        authorId,
        memoriesScope: nextMemoriesScope,
        chaptersScope: nextChaptersScope,
        memoriesRouteUsed: memRes.usedPath,
        chaptersRouteUsed: chapRes.usedPath,
        warnings: Array.from(new Set(nextWarnings)),
      });
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

  const displayThreads = useMemo<TimelineThread[]>(() => {
    return buildNarrativeThreads(displayEvents);
  }, [displayEvents]);

  const chipCounts = useMemo(() => {
    const visibleMemoriesFallback = countDistinctByKind(
      events,
      "Memória",
      detectEventKind,
      extractTarget
    );
    const visibleChaptersFallback = countDistinctByKind(
      events,
      "Capítulo",
      detectEventKind,
      extractTarget
    );
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
    const map = new Map<string, TimelineThread[]>();

    for (const thread of displayThreads) {
      const d = safeDateParse(thread.lead.at || thread.latestAt);
      const key = d ? formatDayLabel(d) : "Sem data";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(thread);
    }

    const entries = Array.from(map.entries()).map(([day, list]) => ({
      day,
      list: [...list].sort((a, b) => {
        if (a.score !== b.score) return b.score - a.score;
        return b.latestMs - a.latestMs;
      }),
      sortKey:
        day === "Sem data"
          ? -Infinity
          : Math.max(...list.map((x) => safeDateMs(x.lead.at || x.latestAt))),
    }));

    entries.sort((a, b) => b.sortKey - a.sortKey);
    return entries;
  }, [displayThreads]);

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

  const editorialSummary = useMemo(() => {
    return getEditorialSummary(timelineMeta);
  }, [timelineMeta]);

  const narrativeThreadSummary = useMemo(() => {
    return getNarrativeThreadSummary(timelineMeta);
  }, [timelineMeta]);

  const narrativeMomentum = useMemo(() => {
    const recentThreads = displayThreads.filter((thread) => {
      const days = daysAgoFromIso(thread.latestAt || thread.lead.at);
      return days != null && days <= 7;
    }).length;

    const activeChapters = new Set<number>();
    const activeMemories = new Set<number>();

    for (const ev of displayEvents) {
      const raw = ev.raw || {};
      const chapterId =
        toNum(raw?.chapter_id) ??
        toNum(raw?.chapterId) ??
        toNum(raw?.meta?.chapter_id) ??
        toNum(raw?.meta?.chapterId);

      const memoryId =
        toNum(raw?.memory_id) ??
        toNum(raw?.memoryId) ??
        toNum(raw?.meta?.memory_id) ??
        toNum(raw?.meta?.memoryId);

      if (chapterId && chapterId > 0) activeChapters.add(chapterId);
      if (memoryId && memoryId > 0) activeMemories.add(memoryId);
    }

    const avgScore = averageScore(displayThreads);
    const intensityLabel = getNarrativeMomentumLabel(avgScore, recentThreads, displayThreads.length);

    return {
      recentThreads,
      activeChapters: activeChapters.size,
      activeMemories: activeMemories.size,
      avgScore,
      intensityLabel,
      tone: getNarrativeMomentumTone(intensityLabel),
    };
  }, [displayThreads, displayEvents]);

  const narrativeSummary = useMemo<NarrativeSummary | null>(() => {
    if (!displayThreads.length) return null;

    const topThread = displayThreads[0];
    const activeChapters = new Set<number>();
    const activeMemories = new Set<number>();

    for (const ev of displayEvents) {
      const raw = ev.raw || {};

      const cid =
        toNum(raw?.chapter_id) ??
        toNum(raw?.chapterId) ??
        toNum(raw?.meta?.chapter_id) ??
        toNum(raw?.meta?.chapterId);

      const mid =
        toNum(raw?.memory_id) ??
        toNum(raw?.memoryId) ??
        toNum(raw?.meta?.memory_id) ??
        toNum(raw?.meta?.memoryId);

      if (cid) activeChapters.add(cid);
      if (mid) activeMemories.add(mid);
    }

    return {
      topTitle: topThread.lead.title || "(sem título)",
      threads: displayThreads.length,
      chapters: activeChapters.size,
      memories: activeMemories.size,
      heroKind: detectEventKind(topThread.lead),
      heroScore: topThread.score,
    };
  }, [displayThreads, displayEvents]);

  const narrativeMoment = useMemo(() => {
    if (!displayThreads.length) return null;

    const recentWindow = displayThreads.filter((thread) => {
      const days = daysAgoFromIso(thread.latestAt || thread.lead.at);
      return days != null && days <= 3;
    });

    const topRecent = recentWindow[0] || displayThreads[0];
    const recentCount = recentWindow.length;
    const days = daysAgoFromIso(topRecent.latestAt || topRecent.lead.at);
    const kindLabel = labelForKind(detectEventKind(topRecent.lead));

    let text = "";
    if (recentCount >= 5) {
      text = `A narrativa acelerou nos últimos dias, com ${recentCount} threads recentes e protagonismo de ${kindLabel.toLowerCase()} em “${topRecent.lead.title}”.`;
    } else if (recentCount >= 2) {
      text = `O sistema detecta continuidade narrativa recente, com ${recentCount} threads ativas e maior concentração editorial em “${topRecent.lead.title}”.`;
    } else {
      text = `O movimento mais forte deste recorte está em “${topRecent.lead.title}”, que lidera a leitura editorial atual da Timeline.`;
    }

    return {
      title: "Momento narrativo",
      text,
      meta:
        days != null
          ? `Último pico percebido ${days === 0 ? "hoje" : days === 1 ? "ontem" : `há ${days} dias`}`
          : "Pico narrativo detectado",
    };
  }, [displayThreads]);

  const intelligencePanel = useMemo<IntelligencePanel | null>(() => {
    return buildIntelligencePanel(displayThreads, activeFilter);
  }, [displayThreads, activeFilter]);

  useEffect(() => {
    setApprovedSuggestionIds((prev) =>
      prev.filter((id) => intelligencePanel?.chapterSuggestions.some((s) => s.id === id))
    );
    setSubmittedSuggestionIds((prev) =>
      prev.filter((id) => intelligencePanel?.chapterSuggestions.some((s) => s.id === id))
    );
    setSuggestionNotice(null);
  }, [intelligencePanel]);

  const inventoryScopeBadges = useMemo(() => {
    return [
      {
        key: "memories-scope",
        label: "Memórias",
        value: scopeLabel(inventoryDiagnostics.memoriesScope),
      },
      {
        key: "chapters-scope",
        label: "Capítulos",
        value: scopeLabel(inventoryDiagnostics.chaptersScope),
      },
    ];
  }, [inventoryDiagnostics]);

  const inventoryRouteLine = useMemo(() => {
    const parts: string[] = [];
    if (inventoryDiagnostics.memoriesRouteUsed) parts.push(`memórias: ${inventoryDiagnostics.memoriesRouteUsed}`);
    if (inventoryDiagnostics.chaptersRouteUsed) parts.push(`capítulos: ${inventoryDiagnostics.chaptersRouteUsed}`);
    return parts.length ? parts.join(" • ") : null;
  }, [inventoryDiagnostics]);

  const combinedWarnings = useMemo(() => {
    return Array.from(new Set([...warnings, ...inventoryDiagnostics.warnings]));
  }, [warnings, inventoryDiagnostics.warnings]);

  return (
    <div style={styles.page}>
      <div style={styles.heroHeaderCard}>
        <div style={styles.heroHeaderGlowLeft} />
        <div style={styles.heroHeaderGlowRight} />

        <div style={styles.headerRow}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={styles.eyebrow}>Editorial Timeline</div>
            <div style={styles.h1}>Timeline Editorial</div>
            <div style={styles.sub}>
              A história ganha forma em uma linha do tempo viva — com relevância editorial, contexto narrativo e evolução das memórias ao longo dos capítulos.
            </div>

            <div style={styles.badgeRow}>
              <span style={styles.badgeSoftPrimary}>
                Status: <b style={{ opacity: 1 }}>{statusLine}</b>
                {lastUpdated && !loading && !errorMsg ? (
                  <span style={{ opacity: 0.78 }}>
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

              <span style={styles.badgeSoft}>
                Modo: <b style={{ opacity: 1 }}>Editorial Premium</b>
              </span>

              {inventoryDiagnostics.authorId ? (
                <span style={styles.badgeSoft}>
                  Autor autenticado: <b style={{ opacity: 1 }}>#{inventoryDiagnostics.authorId}</b>
                </span>
              ) : null}

              {editorialSummary.scoreMax != null ? (
                <span style={styles.badgeSoft}>
                  Pico editorial: <b style={{ opacity: 1 }}>{editorialSummary.scoreMax}</b>
                </span>
              ) : null}

              {editorialSummary.scoreAvg != null ? (
                <span style={styles.badgeSoft}>
                  Média: <b style={{ opacity: 1 }}>{editorialSummary.scoreAvg}</b>
                </span>
              ) : null}

              {narrativeThreadSummary.totalThreads != null ? (
                <span style={styles.badgeSoft}>
                  Threads: <b style={{ opacity: 1 }}>{narrativeThreadSummary.totalThreads}</b>
                </span>
              ) : null}
            </div>
          </div>

          <div style={styles.headerActions}>
            <button
              type="button"
              style={{ ...styles.btnPrimary, ...((loading || inventoryLoading) ? styles.btnDisabled : {}) }}
              onClick={loadAll}
              disabled={loading || inventoryLoading}
            >
              {loading || inventoryLoading ? "Atualizando…" : "Atualizar"}
            </button>
          </div>
        </div>
      </div>

      {intelligencePanel && (
        <TimelineIntelligencePanel
          intelligencePanel={intelligencePanel}
          approvedSuggestionIds={approvedSuggestionIds}
          submittedSuggestionIds={submittedSuggestionIds}
          toggleSuggestionApproval={toggleSuggestionApproval}
          setSubmittedSuggestionIds={setSubmittedSuggestionIds}
          setSuggestionNotice={setSuggestionNotice}
          submitApprovedSuggestions={submitApprovedSuggestions}
          suggestionNotice={suggestionNotice}
        />
      )}

      {(narrativeSummary || narrativeMoment) && (
        <div style={styles.executiveStrip}>
          {narrativeSummary && (
            <div style={styles.summaryCard}>
              <div style={styles.summaryGlow} />
              <div style={styles.summaryHeader}>
                <div>
                  <div style={styles.sectionEyebrow}>Narrative Summary</div>
                  <div style={styles.summaryTitle}>Resumo narrativo do dia</div>
                </div>

                <div style={styles.summarySeal}>
                  {labelForKind(narrativeSummary.heroKind)} • score {narrativeSummary.heroScore}
                </div>
              </div>

              <div style={styles.summaryText}>
                <b>{narrativeSummary.threads}</b> threads • <b>{narrativeSummary.chapters}</b> capítulos •{" "}
                <b>{narrativeSummary.memories}</b> memórias
              </div>

              <div style={styles.summaryHighlight}>
                Destaque editorial: <b>{narrativeSummary.topTitle}</b>
              </div>
            </div>
          )}

          {narrativeMoment && (
            <div style={styles.momentCard}>
              <div style={styles.momentGlow} />
              <div style={styles.momentHeader}>
                <div>
                  <div style={styles.sectionEyebrow}>Narrative Pulse</div>
                  <div style={styles.momentTitle}>{narrativeMoment.title}</div>
                </div>
                <div style={styles.momentMeta}>{narrativeMoment.meta}</div>
              </div>
              <div style={styles.momentText}>{narrativeMoment.text}</div>
            </div>
          )}
        </div>
      )}

      <div
        style={{
          ...styles.pulseCard,
          ...(narrativeMomentum.tone === "high"
            ? styles.pulseCardHigh
            : narrativeMomentum.tone === "medium"
            ? styles.pulseCardMedium
            : styles.pulseCardLow),
        }}
      >
        <div style={styles.pulseGlow} />

        <div style={styles.rowBetween}>
          <div>
            <div style={styles.sectionEyebrowStrong}>Narrative Engine</div>
            <div style={styles.cardTitleHero}>Pulso narrativo</div>
            <div style={styles.cardMetaStrong}>
              O retrato executivo do movimento da história neste recorte da Timeline.
            </div>
          </div>

          <div style={styles.pulseToneBadge}>
            Intensidade: <b>{narrativeMomentum.intensityLabel}</b>
          </div>
        </div>

        <div style={styles.pulseGrid}>
          <div style={{ ...styles.pulseMetricCard, ...styles.pulseMetricCardFeatured }}>
            <div style={styles.pulseMetricLabel}>Memórias em movimento</div>
            <div style={styles.pulseMetricValueFeatured}>{narrativeMomentum.activeMemories}</div>
          </div>

          <div style={styles.pulseMetricCard}>
            <div style={styles.pulseMetricLabel}>Capítulos ativos</div>
            <div style={styles.pulseMetricValue}>{narrativeMomentum.activeChapters}</div>
          </div>

          <div style={styles.pulseMetricCard}>
            <div style={styles.pulseMetricLabel}>Threads recentes</div>
            <div style={styles.pulseMetricValue}>{narrativeMomentum.recentThreads}</div>
          </div>

          <div style={styles.pulseMetricCard}>
            <div style={styles.pulseMetricLabel}>Intensidade editorial</div>
            <div style={styles.pulseMetricValue}>{narrativeMomentum.avgScore}</div>
          </div>
        </div>
      </div>

      <div style={styles.timelineCard}>
        <div style={styles.rowBetween}>
          <div>
            <div style={styles.sectionEyebrow}>Narrative Order</div>
            <div style={styles.cardTitleLarge}>Em ordem editorial</div>
            <div style={styles.cardMetaStrong}>
              Os itens aparecem por relevância narrativa e, dentro de cada card, a linha narrativa mostra os movimentos mais importantes daquela história.
            </div>
          </div>
          <div style={styles.rightInfoBadge}>{loading ? "Carregando…" : "Threads narrativas ativas"}</div>
        </div>

        {errorMsg ? (
          <div style={styles.errorBox}>
            <div style={{ fontWeight: 900 }}>Não foi possível carregar a Timeline</div>
            <div style={{ marginTop: 6, opacity: 0.85 }}>{errorMsg}</div>
            <button type="button" style={{ ...styles.btnPrimary, marginTop: 12 }} onClick={loadAll}>
              Tentar novamente
            </button>
          </div>
        ) : loading ? (
          <div style={styles.infoBox}>Carregando eventos…</div>
        ) : displayThreads.length === 0 ? (
          <div style={styles.infoBox}>
            <div style={{ fontWeight: 900 }}>Nada para mostrar</div>
            <div style={{ marginTop: 6, opacity: 0.85 }}>
              Ajuste filtro ou busca, ou crie uma memória/capítulo para a timeline ganhar vida.
            </div>
          </div>
        ) : (
          <TimelineThreadList
            grouped={grouped}
            openMap={openMap}
            toggleOpen={toggleOpen}
            openEvent={openEvent}
          />
        )}

        <div style={styles.footerNote}>
          A tela consome <code>/api/timeline</code> com <code>q</code>, <code>type</code> e <code>limit</code>. A navegação prioriza o <code>meta.nav</code> vindo do backend para evitar abrir o ID errado.
        </div>
      </div>

      <div style={styles.toolsCard}>
        <div style={styles.rowBetween}>
          <div>
            <div style={styles.sectionEyebrowMuted}>Editorial Tools</div>
            <div style={styles.cardTitleTools}>Ferramentas editoriais</div>
            <div style={styles.cardMeta}>
              Busca, filtros e indicadores operacionais para leitura e exploração da Timeline híbrida.
            </div>
            {inventoryLine ? <div style={{ ...styles.cardMeta, marginTop: 8 }}>{inventoryLine}</div> : null}
            {inventoryRouteLine ? (
              <div style={{ ...styles.cardMeta, marginTop: 6 }}>
                Rotas validadas: <b>{inventoryRouteLine}</b>
              </div>
            ) : null}
          </div>

          <div style={styles.rightInfoBadgeMuted}>
            Visíveis: <b>{displayThreads.length}</b>
            {inventoryLoading ? <span style={{ marginLeft: 8, opacity: 0.75 }}>• Inventário…</span> : null}
          </div>
        </div>

        {(editorialSummary.high != null ||
          editorialSummary.medium != null ||
          editorialSummary.low != null ||
          narrativeThreadSummary.multiEventThreads != null) && (
          <div style={styles.editorialOverviewRow}>
            <div style={styles.editorialOverviewCardMuted}>
              <div style={styles.editorialOverviewLabel}>Alta relevância</div>
              <div style={styles.editorialOverviewValue}>{editorialSummary.high ?? "—"}</div>
            </div>
            <div style={styles.editorialOverviewCardMuted}>
              <div style={styles.editorialOverviewLabel}>Boa relevância</div>
              <div style={styles.editorialOverviewValue}>{editorialSummary.medium ?? "—"}</div>
            </div>
            <div style={styles.editorialOverviewCardMuted}>
              <div style={styles.editorialOverviewLabel}>Base narrativa</div>
              <div style={styles.editorialOverviewValue}>{editorialSummary.low ?? "—"}</div>
            </div>
            <div style={styles.editorialOverviewCardMuted}>
              <div style={styles.editorialOverviewLabel}>Threads com múltiplos movimentos</div>
              <div style={styles.editorialOverviewValue}>
                {narrativeThreadSummary.multiEventThreads ?? "—"}
              </div>
            </div>
          </div>
        )}

        <div style={styles.scopeRow}>
          {inventoryScopeBadges.map((item) => (
            <div key={item.key} style={styles.scopeCardMuted}>
              <div style={styles.scopeLabel}>{item.label}</div>
              <div style={styles.scopeValue}>{item.value}</div>
            </div>
          ))}
        </div>

        <div style={styles.filterWrap}>
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
                style={{ ...styles.chipMuted, ...(isActive ? styles.chipMutedActive : {}) }}
                onClick={() => setActiveFilter(f)}
              >
                {f}
                <span style={styles.chipCount}>{count}</span>
              </button>
            );
          })}
        </div>

        <div style={styles.searchPanelMuted}>
          <div style={styles.searchRow}>
            <div style={{ flex: 1 }}>
              <div style={styles.labelTop}>Buscar</div>
              <input
                style={styles.inputMuted}
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

            <button type="button" style={styles.btnPrimarySoft} onClick={runSearchNow}>
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

          <div style={{ ...styles.smallMuted, marginTop: 10 }}>
            A pesquisa consulta a API real por <code>q</code>, <code>type</code> e <code>limit</code>, com contexto de capítulo, score editorial e agrupamento em linha narrativa.
          </div>
        </div>

        {combinedWarnings.length > 0 && (
          <div style={styles.warnBoxMuted}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Avisos</div>
            {combinedWarnings.slice(0, 10).map((w, i) => (
              <div key={`warn-${i}`}>• {w}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: 18,
    color: "var(--hdud-text)",
  },

  heroHeaderCard: {
    position: "relative",
    overflow: "hidden",
    background:
      "linear-gradient(180deg, rgba(99,102,241,0.09) 0%, rgba(255,255,255,0.03) 24%, var(--hdud-card) 100%)",
    borderRadius: 22,
    padding: 18,
    boxShadow:
      "0 22px 48px rgba(15, 23, 42, 0.12), 0 12px 24px rgba(99,102,241,0.08), inset 0 1px 0 rgba(255,255,255,0.05)",
    border: "1px solid rgba(99,102,241,0.18)",
    marginBottom: 14,
  },

  heroHeaderGlowLeft: {
    position: "absolute",
    top: -40,
    left: -30,
    width: 180,
    height: 180,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(99,102,241,0.14) 0%, rgba(99,102,241,0) 72%)",
    filter: "blur(10px)",
    pointerEvents: "none",
  },

  heroHeaderGlowRight: {
    position: "absolute",
    top: -24,
    right: 30,
    width: 160,
    height: 160,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(16,185,129,0.08) 0%, rgba(16,185,129,0) 72%)",
    filter: "blur(10px)",
    pointerEvents: "none",
  },

  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
    position: "relative",
    zIndex: 1,
  },

  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },

  eyebrow: {
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 0.75,
    textTransform: "uppercase",
    opacity: 0.68,
    marginBottom: 8,
  },

  h1: {
    fontSize: 32,
    fontWeight: 900,
    letterSpacing: -0.7,
    marginBottom: 8,
    lineHeight: 1.04,
  },

  sub: {
    opacity: 0.84,
    fontSize: 14,
    lineHeight: 1.65,
    maxWidth: 980,
  },

  badgeRow: {
    marginTop: 12,
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },

  badgeSoftPrimary: {
    fontSize: 12,
    fontWeight: 800,
    padding: "7px 11px",
    borderRadius: 999,
    background: "rgba(99,102,241,0.10)",
    border: "1px solid rgba(99,102,241,0.18)",
    color: "var(--hdud-text)",
    opacity: 0.96,
  },

  badgeSoft: {
    fontSize: 12,
    fontWeight: 800,
    padding: "7px 11px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "var(--hdud-text)",
    opacity: 0.94,
  },

  executiveStrip: {
    display: "grid",
    gridTemplateColumns: "1.1fr 1fr",
    gap: 12,
    marginBottom: 14,
  },

  summaryCard: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 18,
    padding: 14,
    border: "1px solid rgba(16,185,129,0.18)",
    background: "linear-gradient(180deg, rgba(16,185,129,0.09) 0%, rgba(255,255,255,0.02) 28%, var(--hdud-card) 100%)",
    boxShadow: "0 12px 24px rgba(16, 185, 129, 0.08)",
  },

  summaryGlow: {
    position: "absolute",
    top: -34,
    right: -22,
    width: 140,
    height: 140,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(16,185,129,0.12) 0%, rgba(16,185,129,0) 72%)",
    pointerEvents: "none",
  },

  summaryHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
    position: "relative",
    zIndex: 1,
  },

  sectionEyebrow: {
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 0.65,
    textTransform: "uppercase",
    opacity: 0.62,
    marginBottom: 6,
  },

  sectionEyebrowStrong: {
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 0.72,
    textTransform: "uppercase",
    opacity: 0.78,
    marginBottom: 6,
  },

  sectionEyebrowMuted: {
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 0.65,
    textTransform: "uppercase",
    opacity: 0.5,
    marginBottom: 6,
  },

  summaryTitle: {
    fontSize: 16,
    fontWeight: 900,
    marginBottom: 2,
    letterSpacing: -0.3,
  },

  summaryText: {
    fontSize: 13,
    opacity: 0.92,
    lineHeight: 1.5,
    maxWidth: 900,
    position: "relative",
    zIndex: 1,
  },

  summarySeal: {
    fontSize: 10,
    fontWeight: 900,
    padding: "6px 9px",
    borderRadius: 999,
    border: "1px solid rgba(16,185,129,0.20)",
    background: "rgba(255,255,255,0.22)",
    whiteSpace: "nowrap",
  },

  summaryHighlight: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: 800,
    lineHeight: 1.42,
    position: "relative",
    zIndex: 1,
  },

  momentCard: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 18,
    padding: 14,
    border: "1px solid rgba(59,130,246,0.14)",
    background: "linear-gradient(180deg, rgba(59,130,246,0.07) 0%, rgba(255,255,255,0.02) 28%, var(--hdud-card) 100%)",
    boxShadow: "0 12px 22px rgba(59,130,246,0.06)",
  },

  momentGlow: {
    position: "absolute",
    top: -30,
    right: -18,
    width: 138,
    height: 138,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(59,130,246,0.10) 0%, rgba(59,130,246,0) 72%)",
    pointerEvents: "none",
  },

  momentHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
    position: "relative",
    zIndex: 1,
  },

  momentTitle: {
    fontSize: 16,
    fontWeight: 900,
    letterSpacing: -0.25,
  },

  momentMeta: {
    fontSize: 10,
    opacity: 0.72,
    fontWeight: 800,
    padding: "5px 8px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.05)",
  },

  momentText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 1.55,
    opacity: 0.9,
    position: "relative",
    zIndex: 1,
  },

  pulseCard: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
    border: "1px solid var(--hdud-border)",
    boxShadow:
      "0 20px 42px rgba(15, 23, 42, 0.10), inset 0 1px 0 rgba(255,255,255,0.04)",
  },

  pulseGlow: {
    position: "absolute",
    top: -30,
    right: -18,
    width: 190,
    height: 190,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 72%)",
    pointerEvents: "none",
  },

  pulseCardHigh: {
    background: "linear-gradient(180deg, rgba(16,185,129,0.12) 0%, rgba(255,255,255,0.02) 22%, var(--hdud-card) 100%)",
    border: "1px solid rgba(16, 185, 129, 0.22)",
  },

  pulseCardMedium: {
    background: "linear-gradient(180deg, rgba(245,158,11,0.10) 0%, rgba(255,255,255,0.02) 22%, var(--hdud-card) 100%)",
    border: "1px solid rgba(245, 158, 11, 0.20)",
  },

  pulseCardLow: {
    background: "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, var(--hdud-card) 100%)",
    border: "1px solid var(--hdud-border)",
  },

  pulseToneBadge: {
    fontSize: 12,
    fontWeight: 800,
    padding: "8px 11px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.06)",
    opacity: 0.94,
  },

  rowBetween: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
    position: "relative",
    zIndex: 1,
  },

  cardTitleHero: {
    fontWeight: 900,
    fontSize: 24,
    letterSpacing: -0.45,
    lineHeight: 1.05,
  },

  cardTitleLarge: {
    fontWeight: 900,
    fontSize: 20,
    letterSpacing: -0.35,
  },

  cardTitleTools: {
    fontWeight: 900,
    fontSize: 16,
    letterSpacing: -0.25,
    opacity: 0.86,
  },

  cardMetaStrong: {
    fontSize: 13,
    opacity: 0.82,
    marginTop: 6,
    lineHeight: 1.58,
    maxWidth: 900,
  },

  cardMeta: {
    fontSize: 12,
    opacity: 0.68,
    marginTop: 4,
    lineHeight: 1.45,
  },

  smallMuted: {
    fontSize: 12,
    opacity: 0.7,
  },

  pulseGrid: {
    display: "grid",
    gridTemplateColumns: "1.25fr repeat(3, 1fr)",
    gap: 12,
    marginTop: 16,
    position: "relative",
    zIndex: 1,
  },

  pulseMetricCard: {
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    padding: 14,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
    minHeight: 116,
  },

  pulseMetricCardFeatured: {
    background: "linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.05) 100%)",
    boxShadow:
      "0 14px 28px rgba(15, 23, 42, 0.08), inset 0 1px 0 rgba(255,255,255,0.06)",
  },

  pulseMetricLabel: {
    fontSize: 12,
    opacity: 0.72,
    fontWeight: 800,
  },

  pulseMetricValue: {
    marginTop: 10,
    fontSize: 30,
    fontWeight: 900,
    letterSpacing: -0.55,
    lineHeight: 1,
  },

  pulseMetricValueFeatured: {
    marginTop: 10,
    fontSize: 38,
    fontWeight: 900,
    letterSpacing: -0.8,
    lineHeight: 1,
  },

  timelineCard: {
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, var(--hdud-card) 100%)",
    borderRadius: 22,
    padding: 18,
    boxShadow:
      "0 18px 38px rgba(15, 23, 42, 0.08), inset 0 1px 0 rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    marginBottom: 14,
  },

  toolsCard: {
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.018) 0%, rgba(255,255,255,0.01) 100%)",
    borderRadius: 18,
    padding: 16,
    boxShadow:
      "0 10px 22px rgba(15, 23, 42, 0.04), inset 0 1px 0 rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
    marginBottom: 14,
  },

  rightInfoBadge: {
    fontSize: 12,
    opacity: 0.84,
    padding: "7px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)",
    whiteSpace: "nowrap",
  },

  rightInfoBadgeMuted: {
    fontSize: 11,
    opacity: 0.7,
    padding: "6px 9px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(255,255,255,0.03)",
    whiteSpace: "nowrap",
  },

  editorialOverviewRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: 10,
    marginTop: 14,
  },

  editorialOverviewCardMuted: {
    border: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(255,255,255,0.03)",
    borderRadius: 14,
    padding: 12,
  },

  editorialOverviewLabel: {
    fontSize: 12,
    opacity: 0.7,
    fontWeight: 800,
  },

  editorialOverviewValue: {
    marginTop: 6,
    fontSize: 22,
    fontWeight: 900,
    letterSpacing: -0.35,
    lineHeight: 1,
  },

  scopeRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 10,
    marginTop: 14,
  },

  scopeCardMuted: {
    border: "1px solid rgba(255,255,255,0.06)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, var(--hdud-surface-2) 100%)",
    borderRadius: 14,
    padding: 12,
  },

  scopeLabel: {
    fontSize: 12,
    opacity: 0.68,
    fontWeight: 800,
  },

  scopeValue: {
    marginTop: 6,
    fontSize: 15,
    fontWeight: 900,
    letterSpacing: -0.2,
  },

  filterWrap: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 14,
  },

  chipMuted: {
    border: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(255,255,255,0.03)",
    color: "var(--hdud-text)",
    padding: "8px 11px",
    borderRadius: 999,
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 12,
    display: "inline-flex",
    gap: 8,
    alignItems: "center",
    opacity: 0.82,
  },

  chipMutedActive: {
    opacity: 1,
    outline: "2px solid rgba(99,102,241,0.32)",
    background: "rgba(99,102,241,0.07)",
  },

  chipCount: {
    fontSize: 11,
    fontWeight: 900,
    padding: "2px 8px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "transparent",
    opacity: 0.9,
    minWidth: 28,
    textAlign: "center",
  },

  searchPanelMuted: {
    marginTop: 14,
    border: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(255,255,255,0.03)",
    borderRadius: 16,
    padding: 12,
  },

  searchRow: {
    display: "flex",
    gap: 12,
    alignItems: "flex-end",
    flexWrap: "wrap",
  },

  labelTop: {
    fontSize: 12,
    fontWeight: 900,
    opacity: 0.82,
    marginBottom: 6,
  },

  inputMuted: {
    width: "100%",
    border: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(255,255,255,0.04)",
    color: "var(--hdud-text)",
    borderRadius: 12,
    padding: "11px 13px",
    fontSize: 13,
    outline: "none",
  },

  btnPrimary: {
    border: "1px solid rgba(99,102,241,0.22)",
    background: "linear-gradient(180deg, rgba(99,102,241,0.22) 0%, rgba(99,102,241,0.13) 100%)",
    color: "var(--hdud-text)",
    padding: "9px 13px",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: 900,
    boxShadow: "0 12px 24px rgba(99,102,241,0.10)",
  },

  btnPrimarySoft: {
    border: "1px solid rgba(99,102,241,0.14)",
    background: "rgba(99,102,241,0.08)",
    color: "var(--hdud-text)",
    padding: "9px 13px",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: 900,
  },

  btnDisabled: {
    opacity: 0.55,
    cursor: "not-allowed",
  },

  btnGhost: {
    border: "1px solid rgba(255,255,255,0.08)",
    background: "transparent",
    color: "var(--hdud-text)",
    padding: "8px 11px",
    borderRadius: 999,
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 12,
    opacity: 0.82,
  },

  warnBoxMuted: {
    marginTop: 14,
    border: "1px dashed rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    borderRadius: 12,
    padding: 12,
    fontSize: 12,
    opacity: 0.88,
  },

  errorBox: {
    marginTop: 14,
    border: "1px solid rgba(255,0,80,0.22)",
    background: "rgba(255,0,80,0.10)",
    borderRadius: 16,
    padding: 14,
  },

  infoBox: {
    marginTop: 14,
    border: "1px dashed rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    padding: 14,
    fontSize: 12,
    opacity: 0.92,
  },

  footerNote: {
    marginTop: 16,
    border: "1px dashed rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    padding: 12,
    fontSize: 12,
    opacity: 0.78,
  },
};