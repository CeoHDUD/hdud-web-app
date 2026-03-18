// C:\HDUD_DATA\hdud-web-app\src\features\timeline\components\TimelineThreadList.tsx

import React, { useMemo, useState } from "react";
import type { TimelineEvent, TimelineThread } from "../types";
import {
  extractTarget,
  detectEventKind,
  summarizeThreadEvents,
} from "../selectors";
import {
  extractNav,
  formatRelative,
  formatTimeLabel,
  getChapterPrimary,
  getEditorialBandLabel,
  getEditorialCardLevel,
  getEditorialScore,
  getMatchReasonLabel,
  getPreviewValue,
  getResolvedChapterTitle,
  kindIcon,
  labelForKind,
  parseNavTarget,
  safeDateParse,
} from "../utils";

type Props = {
  grouped: {
    day: string;
    list: TimelineThread[];
    sortKey?: number;
  }[];
  openMap: Record<string, boolean>;
  toggleOpen: (id: string) => void;
  openEvent: (ev: TimelineEvent) => void;
};

export default function TimelineThreadList({
  grouped,
  openMap,
  toggleOpen,
  openEvent,
}: Props) {
  return (
    <div style={styles.root}>
      {grouped.map((g, groupIndex) => {
        const totalMovements = g.list.reduce((acc, x) => acc + x.count, 0);
        const heroCount = g.list.filter((thread) => {
          const lead = thread.lead;
          return getEditorialCardLevel(lead.raw) === "hero";
        }).length;

        return (
          <section key={g.day} style={{ ...styles.daySection, marginTop: groupIndex === 0 ? 0 : 18 }}>
            <div style={styles.dayHeader}>
              <div style={styles.dayHeaderLeft}>
                <span style={styles.dayPill}>{g.day}</span>
                <div style={styles.daySummaryLine}>
                  <span style={styles.dayMetric}>
                    <b>{g.list.length}</b> thread(s)
                  </span>
                  <span style={styles.dotSeparator}>•</span>
                  <span style={styles.dayMetric}>
                    <b>{totalMovements}</b> movimento(s)
                  </span>
                  {heroCount > 0 ? (
                    <>
                      <span style={styles.dotSeparator}>•</span>
                      <span style={styles.dayMetricAccent}>
                        <b>{heroCount}</b> destaque(s) editoriais
                      </span>
                    </>
                  ) : null}
                </div>
              </div>

              <div style={styles.dayHeaderRight}>
                <span style={styles.dayBadgeSoft}>Leitura narrativa</span>
              </div>
            </div>

            <div style={styles.dayList}>
              {g.list.map((thread) => (
                <ThreadCard
                  key={thread.id}
                  thread={thread}
                  isOpen={Boolean(openMap[thread.id])}
                  toggleOpen={toggleOpen}
                  openEvent={openEvent}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ThreadCard({
  thread,
  isOpen,
  toggleOpen,
  openEvent,
}: {
  thread: TimelineThread;
  isOpen: boolean;
  toggleOpen: (id: string) => void;
  openEvent: (ev: TimelineEvent) => void;
}) {
  const [hovered, setHovered] = useState(false);

  const it = thread.lead;
  const dt = safeDateParse(it.at);
  const time = dt ? formatTimeLabel(dt) : it.at;
  const rel = dt ? formatRelative(dt) : "";
  const note = getPreviewValue(it.raw, it.note);

  const target = extractTarget(it);
  const navTarget = parseNavTarget(extractNav(it.raw));
  const effectiveTarget = navTarget.kind !== "unknown" ? navTarget : target;
  const kind = detectEventKind(it);
  const matchReasonLabel = getMatchReasonLabel(it.raw);

  const canOpen =
    (kind === "Memória" &&
      effectiveTarget.kind === "memory" &&
      Boolean(effectiveTarget.id)) ||
    (kind === "Capítulo" &&
      effectiveTarget.kind === "chapter" &&
      Boolean(effectiveTarget.id));

  const seal = labelForKind(kind);
  const openLabel =
    kind === "Memória"
      ? "Abrir memória"
      : kind === "Capítulo"
      ? "Abrir capítulo"
      : "Detalhes";

  const editorialScore = getEditorialScore(it.raw);
  const editorialBandLabel = getEditorialBandLabel(editorialScore);
  const editorialReasons = getEventEditorialReasonsSafe(it.raw);
  const chapterPrimary = getChapterPrimary(it.raw);
  const resolvedChapterTitle = getResolvedChapterTitle(it.raw);
  const threadSummaries = summarizeThreadEvents(thread.events);
  const cardLevel = getEditorialCardLevel(it.raw);

  const cardToneStyle =
    cardLevel === "hero"
      ? styles.eventCardHero
      : cardLevel === "standard"
      ? styles.eventCardStandard
      : styles.eventCardBase;

  const relevanceToneStyle =
    cardLevel === "hero"
      ? styles.relevanceBadgeHero
      : cardLevel === "standard"
      ? styles.relevanceBadgeStandard
      : styles.relevanceBadgeBase;

  const heroGlow =
    cardLevel === "hero"
      ? styles.heroGlowEmerald
      : cardLevel === "standard"
      ? styles.heroGlowAmber
      : styles.heroGlowBase;

  const detailStats = useMemo(
    () => [
      {
        label: "Relevância",
        value: editorialBandLabel,
      },
      {
        label: "Score editorial",
        value: editorialScore,
      },
      {
        label: "Movimentos",
        value: thread.count,
      },
      {
        label: "Blocos consolidados",
        value: threadSummaries.length,
      },
    ],
    [editorialBandLabel, editorialScore, thread.count, threadSummaries.length]
  );

  return (
    <div
      style={{
        ...styles.eventCard,
        ...cardToneStyle,
        ...(hovered ? styles.eventCardHover : {}),
      }}
      onClick={() => openEvent(it)}
      title={canOpen ? "Clique para abrir" : "Clique para ver detalhes"}
      role="button"
      tabIndex={0}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") openEvent(it);
      }}
    >
      <div style={{ ...styles.cardGlow, ...heroGlow }} />

      <div style={styles.eventTop}>
        <div style={styles.eventLeft}>
          <div style={styles.eventMetaRow}>
            <span style={styles.eventMeta}>
              {kindIcon(kind)} <b>{time}</b>{" "}
              {rel ? <span style={{ opacity: 0.7 }}>({rel})</span> : null}
            </span>

            <span style={styles.badgeSoftSmall}>
              <b>{seal}</b>
            </span>

            <span
              style={{
                ...styles.relevanceBadge,
                ...relevanceToneStyle,
              }}
            >
              {editorialBandLabel}
            </span>

            {chapterPrimary ? (
              <span style={styles.badgePrimaryChapter}>
                <b>Capítulo principal</b>
              </span>
            ) : null}

            {matchReasonLabel ? (
              <span style={styles.badgeSoftSmall}>
                <b>{matchReasonLabel}</b>
              </span>
            ) : null}
          </div>

          <div style={styles.eventHeadlineRow}>
            <div style={styles.eventTitleBlock}>
              <div style={styles.eventTitle}>{it.title || "(sem título)"}</div>

              {resolvedChapterTitle ? (
                <div style={styles.contextLine}>
                  Em: <b>{resolvedChapterTitle}</b>
                </div>
              ) : null}
            </div>

            <div style={styles.scorePillar}>
              <div style={styles.scorePillarLabel}>Score</div>
              <div style={styles.scorePillarValue}>{editorialScore}</div>
            </div>
          </div>

          {note ? <div style={styles.eventNote}>{note}</div> : null}

          {editorialReasons.length > 0 ? (
            <div style={styles.editorialLine}>
              {editorialReasons.slice(0, 4).map((reason, idx) => (
                <span key={`${thread.id}-reason-${idx}`} style={styles.reasonPill}>
                  {reason}
                </span>
              ))}
            </div>
          ) : null}

          {thread.count > 1 && (
            <div style={styles.threadBox} onClick={(e) => e.stopPropagation()}>
              <div style={styles.threadBoxHeader}>
                <div>
                  <div style={styles.threadTitle}>Linha narrativa</div>
                  <div style={styles.threadSub}>
                    Evolução editorial consolidada desta história.
                  </div>
                </div>
                <div style={styles.threadCountBadge}>{thread.count} mov.</div>
              </div>

              <div style={styles.threadList}>
                {threadSummaries.slice(0, 6).map((summary, index) => {
                  const evDt = safeDateParse(summary.latestAt);
                  const evTime = evDt ? formatTimeLabel(evDt) : summary.latestAt;
                  const evLabel =
                    summary.count > 1
                      ? `${summary.label} · ${summary.count} movimentos`
                      : summary.label;

                  return (
                    <div key={summary.key} style={styles.threadItem}>
                      <div style={styles.threadConnectorCol}>
                        <div style={styles.threadItemDot} />
                        {index < threadSummaries.slice(0, 6).length - 1 ? (
                          <div style={styles.threadItemLine} />
                        ) : null}
                      </div>

                      <div style={styles.threadItemBody}>
                        <div style={styles.threadItemTop}>
                          <span style={styles.threadItemLabel}>{evLabel}</span>
                          <span style={styles.threadItemTime}>{evTime}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
                toggleOpen(thread.id);
              }}
            >
              {isOpen ? "Ocultar" : "Ver"} detalhes
            </button>
          </div>
        </div>
      </div>

      {isOpen && (
        <div style={styles.detailsBox} onClick={(e) => e.stopPropagation()}>
          <div style={styles.detailsHeader}>
            <div>
              <div style={styles.detailsTitle}>Visão editorial</div>
              <div style={styles.detailsSub}>
                Leitura expandida da relevância, estrutura narrativa e consolidação do card.
              </div>
            </div>
            <span style={styles.detailsBadge}>Expanded View</span>
          </div>

          <div style={styles.detailsGrid}>
            {detailStats.map((item) => (
              <div key={`${thread.id}-${item.label}`} style={styles.detailMiniCard}>
                <div style={styles.detailMiniLabel}>{item.label}</div>
                <div style={styles.detailMiniValue}>{item.value}</div>
              </div>
            ))}
          </div>

          {threadSummaries.length > 0 && (
            <div style={styles.detailNarrativeBox}>
              <div style={styles.detailNarrativeHeader}>
                <div style={styles.detailNarrativeTitle}>Linha narrativa expandida</div>
                <div style={styles.detailNarrativeSub}>
                  Ordem consolidada dos blocos narrativos deste recorte.
                </div>
              </div>

              <div style={styles.detailNarrativeList}>
                {threadSummaries.map((summary, index) => (
                  <div key={`detail-${summary.key}`} style={styles.detailNarrativeItem}>
                    <div style={styles.detailNarrativeConnectorCol}>
                      <div style={styles.detailNarrativeDot} />
                      {index < threadSummaries.length - 1 ? (
                        <div style={styles.detailNarrativeLine} />
                      ) : null}
                    </div>

                    <div style={styles.detailNarrativeText}>
                      {summary.count > 1
                        ? `${summary.label} · ${summary.count} movimentos`
                        : summary.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getEventEditorialReasonsSafe(raw: any): string[] {
  const arr = raw?.meta?.editorial_reason;
  if (!Array.isArray(arr)) return [];

  return arr
    .filter((x: any) => typeof x === "string" && x.trim())
    .map((reason: string) => {
      const key = String(reason || "").toLowerCase();
      if (key.startsWith("chapter_primary:")) return "Capítulo principal";
      if (key.startsWith("recency:")) return "Recente";
      if (key.startsWith("version_activity:")) return "Atividade de versão";
      if (key.startsWith("narrative_event:")) return "Movimento narrativo";
      return reason;
    });
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    marginTop: 12,
  },

  daySection: {
    position: "relative",
  },

  dayHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 14,
    marginBottom: 10,
    flexWrap: "wrap",
  },

  dayHeaderLeft: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    minWidth: 0,
  },

  dayHeaderRight: {
    display: "flex",
    alignItems: "center",
  },

  dayPill: {
    display: "inline-flex",
    alignItems: "center",
    width: "fit-content",
    fontSize: 11,
    fontWeight: 900,
    padding: "7px 12px",
    borderRadius: 999,
    border: "1px solid rgba(99,102,241,0.18)",
    background: "rgba(255,255,255,0.04)",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    opacity: 0.92,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
  },

  daySummaryLine: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },

  dayMetric: {
    fontSize: 12,
    opacity: 0.74,
  },

  dayMetricAccent: {
    fontSize: 12,
    fontWeight: 800,
    opacity: 0.9,
  },

  dotSeparator: {
    fontSize: 12,
    opacity: 0.4,
  },

  dayBadgeSoft: {
    fontSize: 10,
    fontWeight: 900,
    padding: "5px 9px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)",
    textTransform: "uppercase",
    letterSpacing: 0.45,
    opacity: 0.7,
  },

  dayList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },

  eventCard: {
    borderRadius: 22,
    padding: 18,
    cursor: "pointer",
    transition: "transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease",
    position: "relative",
    overflow: "hidden",
    backdropFilter: "blur(8px)",
  },

  eventCardHover: {
    transform: "translateY(-2px)",
    boxShadow: "0 20px 36px rgba(15, 23, 42, 0.12)",
  },

  eventCardHero: {
    border: "1px solid rgba(16, 185, 129, 0.22)",
    background: "linear-gradient(180deg, rgba(16,185,129,0.08) 0%, rgba(255,255,255,0.02) 24%, var(--hdud-surface-2) 100%)",
    boxShadow: "0 18px 40px rgba(16, 185, 129, 0.12)",
  },

  eventCardStandard: {
    border: "1px solid rgba(245, 158, 11, 0.18)",
    background: "linear-gradient(180deg, rgba(245,158,11,0.07) 0%, rgba(255,255,255,0.02) 24%, var(--hdud-surface-2) 100%)",
    boxShadow: "0 16px 32px rgba(245, 158, 11, 0.08)",
  },

  eventCardBase: {
    border: "1px solid var(--hdud-border)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.025) 0%, var(--hdud-surface-2) 100%)",
    boxShadow: "var(--hdud-shadow-soft)",
  },

  cardGlow: {
    position: "absolute",
    pointerEvents: "none",
    top: -46,
    right: -34,
    width: 160,
    height: 160,
    borderRadius: "50%",
    filter: "blur(10px)",
  },

  heroGlowEmerald: {
    background: "radial-gradient(circle, rgba(16,185,129,0.16) 0%, rgba(16,185,129,0) 72%)",
  },

  heroGlowAmber: {
    background: "radial-gradient(circle, rgba(245,158,11,0.14) 0%, rgba(245,158,11,0) 72%)",
  },

  heroGlowBase: {
    background: "radial-gradient(circle, rgba(99,102,241,0.08) 0%, rgba(99,102,241,0) 72%)",
  },

  eventTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },

  eventLeft: {
    minWidth: 0,
    flex: 1,
  },

  eventMetaRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },

  eventMeta: {
    fontSize: 12,
    opacity: 0.8,
  },

  badgeSoftSmall: {
    fontSize: 11,
    fontWeight: 900,
    padding: "5px 8px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "var(--hdud-text)",
    opacity: 0.95,
    whiteSpace: "nowrap",
  },

  badgePrimaryChapter: {
    fontSize: 11,
    fontWeight: 900,
    padding: "5px 8px",
    borderRadius: 999,
    background: "rgba(25, 118, 210, 0.10)",
    border: "1px solid rgba(25, 118, 210, 0.18)",
    color: "var(--hdud-text)",
    whiteSpace: "nowrap",
  },

  relevanceBadge: {
    fontSize: 11,
    fontWeight: 900,
    padding: "5px 8px",
    borderRadius: 999,
    whiteSpace: "nowrap",
    border: "1px solid var(--hdud-border)",
  },

  relevanceBadgeHero: {
    background: "rgba(16, 185, 129, 0.14)",
    border: "1px solid rgba(16, 185, 129, 0.20)",
  },

  relevanceBadgeStandard: {
    background: "rgba(245, 158, 11, 0.14)",
    border: "1px solid rgba(245, 158, 11, 0.20)",
  },

  relevanceBadgeBase: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
  },

  eventHeadlineRow: {
    marginTop: 12,
    display: "flex",
    gap: 16,
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
  },

  eventTitleBlock: {
    minWidth: 0,
    flex: 1,
  },

  eventTitle: {
    fontSize: 24,
    fontWeight: 900,
    lineHeight: 1.12,
    letterSpacing: -0.55,
  },

  scorePillar: {
    minWidth: 88,
    padding: "10px 12px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.05)",
    textAlign: "center",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
  },

  scorePillarLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: 900,
    opacity: 0.62,
  },

  scorePillarValue: {
    marginTop: 6,
    fontSize: 24,
    fontWeight: 900,
    lineHeight: 1,
    letterSpacing: -0.5,
  },

  contextLine: {
    marginTop: 8,
    fontSize: 12,
    opacity: 0.86,
  },

  eventNote: {
    marginTop: 12,
    fontSize: 13,
    opacity: 0.86,
    lineHeight: 1.6,
    maxWidth: 980,
  },

  editorialLine: {
    marginTop: 12,
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },

  reasonPill: {
    fontSize: 11,
    fontWeight: 800,
    padding: "5px 9px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.05)",
    opacity: 0.9,
  },

  threadBox: {
    marginTop: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, var(--hdud-card) 100%)",
    borderRadius: 16,
    padding: 14,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
  },

  threadBoxHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: 10,
  },

  threadTitle: {
    fontSize: 13,
    fontWeight: 900,
    opacity: 0.94,
  },

  threadSub: {
    marginTop: 4,
    fontSize: 12,
    opacity: 0.66,
    lineHeight: 1.45,
  },

  threadCountBadge: {
    fontSize: 10,
    fontWeight: 900,
    padding: "5px 8px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)",
    textTransform: "uppercase",
    letterSpacing: 0.45,
    opacity: 0.74,
  },

  threadList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  threadItem: {
    display: "flex",
    gap: 10,
    alignItems: "stretch",
  },

  threadConnectorCol: {
    width: 10,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    flexShrink: 0,
  },

  threadItemDot: {
    width: 8,
    height: 8,
    marginTop: 6,
    borderRadius: 999,
    background: "var(--hdud-accent-border)",
    flexShrink: 0,
    boxShadow: "0 0 0 4px rgba(99,102,241,0.08)",
  },

  threadItemLine: {
    width: 2,
    flex: 1,
    marginTop: 4,
    borderRadius: 999,
    background: "linear-gradient(180deg, var(--hdud-accent-border) 0%, transparent 100%)",
    opacity: 0.45,
    minHeight: 18,
  },

  threadItemBody: {
    minWidth: 0,
    flex: 1,
  },

  threadItemTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
  },

  threadItemLabel: {
    fontSize: 12,
    fontWeight: 800,
    opacity: 0.92,
    lineHeight: 1.4,
  },

  threadItemTime: {
    fontSize: 11,
    opacity: 0.65,
  },

  eventActions: {
    marginTop: 16,
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },

  btnMiniPrimary: {
    border: "1px solid var(--hdud-border)",
    background: "var(--hdud-primary-bg)",
    color: "var(--hdud-primary-text)",
    padding: "8px 11px",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 12,
  },

  btnMini: {
    border: "1px solid var(--hdud-border)",
    background: "transparent",
    color: "var(--hdud-text)",
    padding: "8px 11px",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 12,
    opacity: 0.88,
  },

  detailsBox: {
    marginTop: 14,
    border: "1px dashed rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.03)",
    borderRadius: 16,
    padding: 14,
  },

  detailsHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: 12,
  },

  detailsTitle: {
    fontWeight: 900,
    fontSize: 14,
  },

  detailsSub: {
    marginTop: 4,
    fontSize: 12,
    opacity: 0.68,
    lineHeight: 1.45,
  },

  detailsBadge: {
    fontSize: 10,
    fontWeight: 900,
    padding: "5px 8px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)",
    textTransform: "uppercase",
    letterSpacing: 0.45,
    opacity: 0.72,
  },

  detailsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 10,
  },

  detailMiniCard: {
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    padding: 12,
  },

  detailMiniLabel: {
    fontSize: 11,
    opacity: 0.68,
    fontWeight: 800,
  },

  detailMiniValue: {
    marginTop: 5,
    fontSize: 13,
    fontWeight: 900,
    lineHeight: 1.35,
  },

  detailNarrativeBox: {
    marginTop: 14,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.035)",
    borderRadius: 14,
    padding: 12,
  },

  detailNarrativeHeader: {
    marginBottom: 10,
  },

  detailNarrativeTitle: {
    fontSize: 12,
    fontWeight: 900,
    opacity: 0.9,
  },

  detailNarrativeSub: {
    marginTop: 4,
    fontSize: 12,
    opacity: 0.64,
    lineHeight: 1.4,
  },

  detailNarrativeList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  detailNarrativeItem: {
    display: "flex",
    gap: 8,
    alignItems: "stretch",
  },

  detailNarrativeConnectorCol: {
    width: 10,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    flexShrink: 0,
  },

  detailNarrativeDot: {
    width: 8,
    height: 8,
    marginTop: 6,
    borderRadius: 999,
    background: "var(--hdud-accent-border)",
    flexShrink: 0,
    boxShadow: "0 0 0 4px rgba(99,102,241,0.08)",
  },

  detailNarrativeLine: {
    width: 2,
    flex: 1,
    marginTop: 4,
    borderRadius: 999,
    background: "linear-gradient(180deg, var(--hdud-accent-border) 0%, transparent 100%)",
    opacity: 0.45,
    minHeight: 18,
  },

  detailNarrativeText: {
    fontSize: 12,
    lineHeight: 1.45,
    opacity: 0.88,
    flex: 1,
  },
};