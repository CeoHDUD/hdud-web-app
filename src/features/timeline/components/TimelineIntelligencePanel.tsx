// C:\HDUD_DATA\hdud-web-app\src\features\timeline\components\TimelineIntelligencePanel.tsx

import React, { useMemo, useState } from "react";
import type { ChapterSuggestionItem, IntelligencePanel } from "../types";

type Props = {
  intelligencePanel: IntelligencePanel;
  approvedSuggestionIds: string[];
  submittedSuggestionIds: string[];
  toggleSuggestionApproval: (id: string) => void;
  setSubmittedSuggestionIds: React.Dispatch<React.SetStateAction<string[]>>;
  setSuggestionNotice: (msg: string | null) => void;
  submitApprovedSuggestions: () => void;
  suggestionNotice: string | null;
};

export default function TimelineIntelligencePanel({
  intelligencePanel,
  approvedSuggestionIds,
  submittedSuggestionIds,
  toggleSuggestionApproval,
  setSubmittedSuggestionIds,
  setSuggestionNotice,
  submitApprovedSuggestions,
  suggestionNotice,
}: Props) {
  const [hoveredSuggestionId, setHoveredSuggestionId] = useState<string | null>(null);
  const [heroHovered, setHeroHovered] = useState(false);
  const [ctaHovered, setCtaHovered] = useState(false);

  const topEventTitle = intelligencePanel.topEvent?.title || "—";
  const hasSuggestions = intelligencePanel.chapterSuggestions.length > 0;

  const activeEngineText = useMemo(() => {
    const totalSignals = [
      intelligencePanel.dominantChapter,
      intelligencePanel.pivotMemory,
      intelligencePanel.topEvent?.title,
    ].filter(Boolean).length;

    if (totalSignals >= 3) return "Motor ativo • dominância consolidada";
    if (totalSignals === 2) return "Motor ativo • leitura em evolução";
    return "Motor ativo • sinais em formação";
  }, [
    intelligencePanel.dominantChapter,
    intelligencePanel.pivotMemory,
    intelligencePanel.topEvent?.title,
  ]);

  return (
    <div style={styles.shell}>
      <div style={styles.bgGlowLeft} />
      <div style={styles.bgGlowRight} />
      <div style={styles.bgGlowBottom} />

      <div style={styles.card}>
        <div style={styles.topBar}>
          <div style={styles.engineBadge}>
            <span style={styles.engineDot} />
            <span style={styles.engineText}>{activeEngineText}</span>
          </div>

          <div style={styles.seal}>
            Investor Layer • score <b>{intelligencePanel.topEventScore}</b>
          </div>
        </div>

        <div style={styles.heroLayout}>
          <div
            style={{
              ...styles.heroMain,
              ...(heroHovered ? styles.heroMainHover : {}),
            }}
            onMouseEnter={() => setHeroHovered(true)}
            onMouseLeave={() => setHeroHovered(false)}
          >
            <div style={styles.heroMainGlow} />

            <div style={styles.heroHeader}>
              <div>
                <div style={styles.eyebrow}>Timeline Intelligence</div>
                <div style={styles.title}>Painel de Inteligência Narrativa</div>
              </div>

              <div style={styles.heroSignal}>
                <div style={styles.heroSignalLabel}>Insight principal</div>
                <div style={styles.heroSignalScore}>
                  score editorial <b>{intelligencePanel.topEventScore}</b>
                </div>
              </div>
            </div>

            <div style={styles.heroEventLabel}>Evento dominante</div>
            <div style={styles.heroTitle}>{topEventTitle}</div>

            <div style={styles.heroSub}>
              A camada executiva da Timeline identifica a força narrativa dominante, aponta a
              memória pivô, mede o peso editorial do recorte atual e transforma leitura narrativa em
              proposta concreta de valor para demo, pitch e investidor.
            </div>

            <div style={styles.heroMetaGrid}>
              <div style={styles.heroMetaCard}>
                <div style={styles.heroMetaLabel}>Capítulo dominante</div>
                <div style={styles.heroMetaValue}>
                  {intelligencePanel.dominantChapter || "—"}
                </div>
                <div style={styles.heroMetaScore}>
                  Score: <b>{intelligencePanel.dominantChapterScore}</b>
                </div>
              </div>

              <div style={styles.heroMetaCard}>
                <div style={styles.heroMetaLabel}>Memória pivô</div>
                <div style={styles.heroMetaValue}>
                  {intelligencePanel.pivotMemory || "—"}
                </div>
                <div style={styles.heroMetaScore}>
                  Score: <b>{intelligencePanel.pivotMemoryScore}</b>
                </div>
              </div>
            </div>

            <div style={styles.heroBottomBand}>
              <div style={styles.heroBottomTitle}>Leitura de dominância</div>
              <div style={styles.heroBottomText}>
                Este é o ponto de maior força editorial do recorte atual da Timeline e deve ser lido
                como o melhor ângulo de entrada para percepção de produto, inteligência narrativa e
                valor de plataforma.
              </div>
            </div>
          </div>

          <div style={styles.heroAside}>
            <div style={styles.asideCard}>
              <div style={styles.asideTitle}>Leitura executiva do período</div>
              <div style={styles.asideText}>{intelligencePanel.executiveReading}</div>
            </div>

            <div style={styles.asideCardInvestor}>
              <div style={styles.asideTitle}>Resumo pronto para investidor</div>
              <div style={styles.asideText}>{intelligencePanel.investorSummary}</div>
            </div>

            <div style={styles.sideMetrics}>
              <MetricCard
                label="Capítulo dominante"
                value={intelligencePanel.dominantChapter || "—"}
                meta={
                  <>
                    Score: <b>{intelligencePanel.dominantChapterScore}</b>
                  </>
                }
                accent="violet"
              />

              <MetricCard
                label="Memória pivô"
                value={intelligencePanel.pivotMemory || "—"}
                meta={
                  <>
                    Score: <b>{intelligencePanel.pivotMemoryScore}</b>
                  </>
                }
                accent="emerald"
              />

              <MetricCard
                label="Evento de maior score"
                value={topEventTitle}
                meta={
                  <>
                    Score editorial: <b>{intelligencePanel.topEventScore}</b>
                  </>
                }
                accent="sky"
              />
            </div>
          </div>
        </div>

        <div style={styles.suggestionsCard}>
          <div style={styles.suggestionsHeader}>
            <div>
              <div style={styles.suggestionsEyebrow}>Editorial Workflow</div>
              <div style={styles.suggestionsTitle}>Sugestões de capítulo</div>
              <div style={styles.suggestionsSub}>
                A IA consolidou o recorte narrativo e propôs capítulos para curadoria humana.
                Aprove, destaque e marque a submissão sem alterar o fluxo atual.
              </div>
            </div>

            <div style={styles.counters}>
              <div style={styles.counterCard}>
                <div style={styles.counterLabel}>Aprovadas</div>
                <div style={styles.counterValue}>{approvedSuggestionIds.length}</div>
              </div>
              <div style={styles.counterCard}>
                <div style={styles.counterLabel}>Submetidas</div>
                <div style={styles.counterValue}>{submittedSuggestionIds.length}</div>
              </div>
            </div>
          </div>

          {!hasSuggestions ? (
            <div style={styles.emptyStateBox}>
              <div style={styles.emptyStateTitle}>Nenhuma sugestão disponível neste recorte</div>
              <div style={styles.emptyStateText}>
                A Timeline ainda não acumulou densidade editorial suficiente para sugerir novos
                capítulos neste momento.
              </div>
            </div>
          ) : (
            <div style={styles.suggestionsList}>
              {intelligencePanel.chapterSuggestions.map((suggestion, index) => {
                const approved = approvedSuggestionIds.includes(suggestion.id);
                const submitted = submittedSuggestionIds.includes(suggestion.id);
                const hovered = hoveredSuggestionId === suggestion.id;

                return (
                  <SuggestionItem
                    key={suggestion.id}
                    suggestion={suggestion}
                    index={index}
                    approved={approved}
                    submitted={submitted}
                    hovered={hovered}
                    onHoverStart={() => setHoveredSuggestionId(suggestion.id)}
                    onHoverEnd={() =>
                      setHoveredSuggestionId((prev) =>
                        prev === suggestion.id ? null : prev
                      )
                    }
                    onToggleApproval={() => toggleSuggestionApproval(suggestion.id)}
                    onSubmit={() => {
                      if (!approved) {
                        setSuggestionNotice("A sugestão precisa ser aprovada antes da submissão.");
                        return;
                      }

                      setSubmittedSuggestionIds((prev) =>
                        prev.includes(suggestion.id) ? prev : [...prev, suggestion.id]
                      );
                      setSuggestionNotice(`Sugestão “${suggestion.title}” marcada como submetida.`);
                    }}
                  />
                );
              })}
            </div>
          )}

          <div style={styles.bulkRow}>
            <button
              type="button"
              style={{
                ...styles.ctaButton,
                ...(ctaHovered ? styles.ctaButtonHover : {}),
              }}
              onMouseEnter={() => setCtaHovered(true)}
              onMouseLeave={() => setCtaHovered(false)}
              onClick={submitApprovedSuggestions}
            >
              <span style={styles.ctaShimmer} />
              <span style={styles.ctaText}>Submeter aprovadas</span>
            </button>

            {suggestionNotice ? (
              <div style={styles.notice}>{suggestionNotice}</div>
            ) : (
              <div style={styles.smallMuted}>
                Fluxo atual em frontend: aprovação e submissão visual prontas para integração
                posterior com backend.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  meta,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  meta: React.ReactNode;
  accent: "violet" | "emerald" | "sky";
}) {
  const [hovered, setHovered] = useState(false);

  const accentStyle =
    accent === "emerald"
      ? styles.metricEmerald
      : accent === "sky"
      ? styles.metricSky
      : styles.metricViolet;

  return (
    <div
      style={{
        ...styles.metricCard,
        ...accentStyle,
        ...(hovered ? styles.metricCardHover : {}),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={styles.metricTopLine} />
      <div style={styles.metricLabel}>{label}</div>
      <div style={styles.metricValue}>{value}</div>
      <div style={styles.metricMeta}>{meta}</div>
    </div>
  );
}

function SuggestionItem({
  suggestion,
  index,
  approved,
  submitted,
  hovered,
  onHoverStart,
  onHoverEnd,
  onToggleApproval,
  onSubmit,
}: {
  suggestion: ChapterSuggestionItem;
  index: number;
  approved: boolean;
  submitted: boolean;
  hovered: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  onToggleApproval: () => void;
  onSubmit: () => void;
}) {
  return (
    <div
      style={{
        ...styles.suggestionItem,
        ...(hovered ? styles.suggestionItemHover : {}),
        ...(approved ? styles.suggestionItemApproved : {}),
        ...(submitted ? styles.suggestionItemSubmitted : {}),
      }}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
    >
      <div style={styles.suggestionGlow} />

      <div style={styles.suggestionTop}>
        <div style={{ minWidth: 0 }}>
          <div style={styles.suggestionIndex}>Sugestão {index + 1}</div>
          <div style={styles.suggestionTitle}>{suggestion.title}</div>
        </div>

        <div style={styles.suggestionBadges}>
          {approved ? <span style={styles.badgeApproved}>Aprovada</span> : null}
          {submitted ? <span style={styles.badgeSubmitted}>Submetida</span> : null}
          {!approved && !submitted ? <span style={styles.badgeNeutral}>Em análise</span> : null}
        </div>
      </div>

      <div style={styles.suggestionRationale}>{suggestion.rationale}</div>

      <div style={styles.basedOnRow}>
        {suggestion.basedOn.map((item, idx) => (
          <span key={`${suggestion.id}-based-${idx}`} style={styles.reasonPill}>
            {item}
          </span>
        ))}
      </div>

      <div style={styles.suggestionActions}>
        <button
          type="button"
          style={{
            ...styles.btnPrimaryMini,
            ...(approved ? styles.btnPrimaryMiniSoft : {}),
          }}
          onClick={onToggleApproval}
        >
          {approved ? "Desaprovar" : "Aprovar"}
        </button>

        <button
          type="button"
          style={{
            ...styles.btnMini,
            ...(submitted ? styles.btnMiniDisabled : {}),
          }}
          onClick={onSubmit}
          disabled={submitted}
        >
          {submitted ? "Submetida" : "Submeter"}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    position: "relative",
    marginBottom: 14,
  },

  bgGlowLeft: {
    position: "absolute",
    left: -20,
    top: 18,
    width: 220,
    height: 220,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(99,102,241,0.18) 0%, rgba(99,102,241,0) 72%)",
    filter: "blur(14px)",
    pointerEvents: "none",
  },

  bgGlowRight: {
    position: "absolute",
    right: 20,
    top: -10,
    width: 240,
    height: 240,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(16,185,129,0.13) 0%, rgba(16,185,129,0) 72%)",
    filter: "blur(16px)",
    pointerEvents: "none",
  },

  bgGlowBottom: {
    position: "absolute",
    left: "28%",
    bottom: -20,
    width: 320,
    height: 120,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(59,130,246,0.10) 0%, rgba(59,130,246,0) 72%)",
    filter: "blur(18px)",
    pointerEvents: "none",
  },

  card: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 24,
    padding: 20,
    border: "1px solid rgba(99,102,241,0.24)",
    background:
      "linear-gradient(180deg, rgba(12,18,32,0.16) 0%, rgba(99,102,241,0.10) 0%, rgba(255,255,255,0.03) 16%, var(--hdud-card) 100%)",
    boxShadow:
      "0 24px 56px rgba(15, 23, 42, 0.18), 0 12px 28px rgba(99,102,241,0.12), inset 0 1px 0 rgba(255,255,255,0.06)",
    backdropFilter: "blur(12px)",
  },

  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 16,
  },

  engineBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 9,
    padding: "8px 13px",
    borderRadius: 999,
    border: "1px solid rgba(99,102,241,0.22)",
    background: "rgba(255,255,255,0.06)",
    boxShadow: "0 0 0 1px rgba(255,255,255,0.02) inset",
  },

  engineDot: {
    width: 9,
    height: 9,
    borderRadius: "50%",
    background: "rgba(16,185,129,0.95)",
    boxShadow: "0 0 0 4px rgba(16,185,129,0.14)",
    flexShrink: 0,
  },

  engineText: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0.45,
    opacity: 0.9,
  },

  seal: {
    fontSize: 11,
    fontWeight: 900,
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(99,102,241,0.22)",
    background: "rgba(255,255,255,0.16)",
    whiteSpace: "nowrap",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
  },

  heroLayout: {
    display: "grid",
    gridTemplateColumns: "minmax(520px, 1.45fr) minmax(280px, 0.75fr)",
    gap: 16,
    alignItems: "stretch",
  },

  heroMain: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 22,
    padding: 20,
    minHeight: 360,
    border: "1px solid rgba(255,255,255,0.08)",
    background:
      "linear-gradient(135deg, rgba(99,102,241,0.22) 0%, rgba(26,32,56,0.22) 35%, rgba(255,255,255,0.04) 100%)",
    boxShadow:
      "0 24px 46px rgba(99,102,241,0.14), inset 0 1px 0 rgba(255,255,255,0.06)",
    transition: "transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease",
  },

  heroMainHover: {
    transform: "translateY(-2px)",
    boxShadow:
      "0 30px 54px rgba(99,102,241,0.18), inset 0 1px 0 rgba(255,255,255,0.08)",
    border: "1px solid rgba(99,102,241,0.24)",
  },

  heroMainGlow: {
    position: "absolute",
    top: -70,
    right: -40,
    width: 240,
    height: 240,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 72%)",
    pointerEvents: "none",
  },

  heroHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    flexWrap: "wrap",
  },

  eyebrow: {
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    opacity: 0.7,
    marginBottom: 10,
  },

  title: {
    fontSize: 28,
    fontWeight: 900,
    lineHeight: 1.04,
    letterSpacing: -0.7,
  },

  heroSignal: {
    minWidth: 170,
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.08)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
  },

  heroSignalLabel: {
    fontSize: 10,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0.55,
    opacity: 0.7,
  },

  heroSignalScore: {
    marginTop: 5,
    fontSize: 12,
    fontWeight: 800,
    opacity: 0.9,
  },

  heroEventLabel: {
    marginTop: 24,
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    opacity: 0.72,
  },

  heroTitle: {
    marginTop: 10,
    fontSize: 34,
    fontWeight: 900,
    lineHeight: 1.08,
    letterSpacing: -1,
    maxWidth: 900,
  },

  heroSub: {
    marginTop: 16,
    fontSize: 14,
    lineHeight: 1.68,
    opacity: 0.92,
    maxWidth: 920,
  },

  heroMetaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(180px, 1fr))",
    gap: 12,
    marginTop: 20,
  },

  heroMetaCard: {
    borderRadius: 16,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.06)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
  },

  heroMetaLabel: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0.55,
    opacity: 0.68,
  },

  heroMetaValue: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: 900,
    lineHeight: 1.28,
    letterSpacing: -0.25,
  },

  heroMetaScore: {
    marginTop: 8,
    fontSize: 11,
    opacity: 0.76,
  },

  heroBottomBand: {
    marginTop: 18,
    paddingTop: 16,
    borderTop: "1px solid rgba(255,255,255,0.08)",
  },

  heroBottomTitle: {
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 0.2,
    marginBottom: 8,
  },

  heroBottomText: {
    fontSize: 13,
    lineHeight: 1.62,
    opacity: 0.88,
  },

  heroAside: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    minWidth: 0,
  },

  asideCard: {
    borderRadius: 18,
    padding: 14,
    border: "1px solid rgba(99,102,241,0.16)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)",
    boxShadow: "0 12px 22px rgba(15,23,42,0.08)",
  },

  asideCardInvestor: {
    borderRadius: 18,
    padding: 14,
    border: "1px solid rgba(16,185,129,0.18)",
    background: "linear-gradient(180deg, rgba(16,185,129,0.12) 0%, rgba(255,255,255,0.03) 100%)",
    boxShadow: "0 12px 22px rgba(16,185,129,0.08)",
  },

  asideTitle: {
    fontSize: 12,
    fontWeight: 900,
    marginBottom: 8,
    letterSpacing: 0.2,
  },

  asideText: {
    fontSize: 13,
    lineHeight: 1.62,
    opacity: 0.92,
  },

  sideMetrics: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 10,
  },

  metricCard: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 16,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, var(--hdud-surface-2) 100%)",
    boxShadow: "0 10px 22px rgba(15,23,42,0.08)",
    transition: "transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease",
  },

  metricCardHover: {
    transform: "translateY(-2px)",
    boxShadow: "0 16px 30px rgba(15,23,42,0.12)",
    border: "1px solid rgba(255,255,255,0.12)",
  },

  metricViolet: {
    background: "linear-gradient(180deg, rgba(99,102,241,0.12) 0%, rgba(255,255,255,0.03) 100%)",
  },

  metricEmerald: {
    background: "linear-gradient(180deg, rgba(16,185,129,0.12) 0%, rgba(255,255,255,0.03) 100%)",
  },

  metricSky: {
    background: "linear-gradient(180deg, rgba(59,130,246,0.12) 0%, rgba(255,255,255,0.03) 100%)",
  },

  metricTopLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    background:
      "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.42) 50%, rgba(255,255,255,0) 100%)",
    opacity: 0.5,
  },

  metricLabel: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0.45,
    opacity: 0.72,
  },

  metricValue: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: 900,
    lineHeight: 1.28,
    letterSpacing: -0.25,
  },

  metricMeta: {
    marginTop: 8,
    fontSize: 11,
    opacity: 0.76,
    lineHeight: 1.45,
  },

  suggestionsCard: {
    marginTop: 18,
    borderRadius: 20,
    padding: 16,
    border: "1px solid rgba(99,102,241,0.16)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(99,102,241,0.05) 100%)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
  },

  suggestionsHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },

  suggestionsEyebrow: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0.65,
    opacity: 0.66,
    marginBottom: 6,
  },

  suggestionsTitle: {
    fontSize: 20,
    fontWeight: 900,
    letterSpacing: -0.45,
  },

  suggestionsSub: {
    fontSize: 12,
    opacity: 0.78,
    marginTop: 6,
    lineHeight: 1.58,
    maxWidth: 920,
  },

  counters: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },

  counterCard: {
    minWidth: 96,
    borderRadius: 14,
    padding: "10px 12px",
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.06)",
    textAlign: "center",
  },

  counterLabel: {
    fontSize: 10,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    opacity: 0.68,
  },

  counterValue: {
    marginTop: 6,
    fontSize: 22,
    fontWeight: 900,
    lineHeight: 1,
    letterSpacing: -0.4,
  },

  suggestionsList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    marginTop: 16,
  },

  suggestionItem: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 16,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, var(--hdud-surface-2) 100%)",
    boxShadow: "0 10px 22px rgba(15,23,42,0.08)",
    transition: "transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease",
  },

  suggestionItemHover: {
    transform: "translateY(-2px)",
    boxShadow: "0 16px 30px rgba(15,23,42,0.12)",
    border: "1px solid rgba(99,102,241,0.20)",
  },

  suggestionItemApproved: {
    border: "1px solid rgba(16,185,129,0.28)",
    boxShadow: "0 12px 24px rgba(16,185,129,0.08)",
  },

  suggestionItemSubmitted: {
    border: "1px solid rgba(59,130,246,0.24)",
    boxShadow: "0 12px 24px rgba(59,130,246,0.08)",
  },

  suggestionGlow: {
    position: "absolute",
    top: -38,
    right: -28,
    width: 112,
    height: 112,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(99,102,241,0.12) 0%, rgba(99,102,241,0) 70%)",
    pointerEvents: "none",
  },

  suggestionTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },

  suggestionIndex: {
    fontSize: 10,
    fontWeight: 900,
    opacity: 0.66,
    textTransform: "uppercase",
    letterSpacing: 0.65,
  },

  suggestionTitle: {
    marginTop: 6,
    fontSize: 17,
    fontWeight: 900,
    lineHeight: 1.3,
    letterSpacing: -0.25,
  },

  suggestionRationale: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 1.62,
    opacity: 0.9,
  },

  basedOnRow: {
    marginTop: 12,
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },

  suggestionActions: {
    marginTop: 14,
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },

  suggestionBadges: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
    alignItems: "center",
  },

  badgeApproved: {
    fontSize: 10,
    fontWeight: 900,
    padding: "5px 8px",
    borderRadius: 999,
    background: "rgba(16,185,129,0.14)",
    border: "1px solid rgba(16,185,129,0.22)",
    whiteSpace: "nowrap",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  badgeSubmitted: {
    fontSize: 10,
    fontWeight: 900,
    padding: "5px 8px",
    borderRadius: 999,
    background: "rgba(59,130,246,0.14)",
    border: "1px solid rgba(59,130,246,0.22)",
    whiteSpace: "nowrap",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },

  badgeNeutral: {
    fontSize: 10,
    fontWeight: 900,
    padding: "5px 8px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.10)",
    whiteSpace: "nowrap",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    opacity: 0.82,
  },

  bulkRow: {
    marginTop: 16,
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
  },

  ctaButton: {
    position: "relative",
    overflow: "hidden",
    border: "1px solid rgba(99,102,241,0.24)",
    background:
      "linear-gradient(180deg, rgba(99,102,241,0.24) 0%, rgba(99,102,241,0.14) 100%)",
    color: "var(--hdud-text)",
    padding: "10px 16px",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: 900,
    boxShadow: "0 14px 26px rgba(99,102,241,0.14)",
    transition: "transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease",
  },

  ctaButtonHover: {
    transform: "translateY(-1px)",
    boxShadow: "0 18px 30px rgba(99,102,241,0.18)",
    border: "1px solid rgba(99,102,241,0.30)",
  },

  ctaShimmer: {
    position: "absolute",
    inset: 0,
    background:
      "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0) 100%)",
    pointerEvents: "none",
  },

  ctaText: {
    position: "relative",
    zIndex: 1,
  },

  notice: {
    fontSize: 12,
    fontWeight: 800,
    opacity: 0.94,
    lineHeight: 1.45,
  },

  emptyStateBox: {
    marginTop: 14,
    border: "1px dashed rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    padding: 14,
  },

  emptyStateTitle: {
    fontSize: 13,
    fontWeight: 900,
    marginBottom: 6,
  },

  emptyStateText: {
    fontSize: 12,
    lineHeight: 1.55,
    opacity: 0.78,
  },

  smallMuted: {
    fontSize: 12,
    opacity: 0.72,
    lineHeight: 1.45,
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

  btnPrimaryMini: {
    border: "1px solid var(--hdud-border)",
    background: "var(--hdud-primary-bg)",
    color: "var(--hdud-primary-text)",
    padding: "8px 11px",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 12,
    transition: "transform 160ms ease, opacity 160ms ease",
  },

  btnPrimaryMiniSoft: {
    opacity: 0.85,
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
    transition: "transform 160ms ease, opacity 160ms ease",
  },

  btnMiniDisabled: {
    opacity: 0.55,
    cursor: "not-allowed",
  },
};