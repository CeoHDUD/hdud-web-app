// C:\HDUD_DATA\hdud-web-app\src\components\ChapterTimeline.tsx

import React, { useMemo } from "react";

export type ChapterTimelineMemory = {
  memory_id: number;
  title?: string | null;
  content?: string | null;
  created_at?: string | null;
  linked_at?: string | null;
  sort_order?: number | null;
  phase_name?: string | null;
  life_phase?: string | null;
};

type Props = {
  chapterTitle?: string | null;
  items: ChapterTimelineMemory[];
  loading?: boolean;
  busy?: boolean;
  onAddMemory: () => void;
  onOpenMemory: (memoryId: number) => void;
  onEditMemory: (memoryId: number) => void;
  onMoveUp: (memoryId: number) => void;
  onMoveDown: (memoryId: number) => void;
  onRemoveMemory: (memoryId: number) => void;
};

function safeText(v: any, max = 220) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

function formatDateLabel(v?: string | null) {
  if (!v) return "Sem data";
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "Sem data";
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(d);
  } catch {
    return "Sem data";
  }
}

function extractNarrativeYear(item: ChapterTimelineMemory): string {
  const raw = item.created_at || item.linked_at || null;
  if (!raw) return "—";
  try {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return "—";
    return String(d.getFullYear());
  } catch {
    return "—";
  }
}

export default function ChapterTimeline({
  chapterTitle,
  items,
  loading = false,
  busy = false,
  onAddMemory,
  onOpenMemory,
  onEditMemory,
  onMoveUp,
  onMoveDown,
  onRemoveMemory,
}: Props) {
  const hasItems = items.length > 0;

  const rows = useMemo(() => {
    return items.map((item, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === items.length - 1;
      const title = String(item.title ?? "").trim() || `Memória #${item.memory_id}`;
      const excerpt =
        safeText(item.content, 220) ||
        "Esta memória ainda não possui trecho narrativo suficiente para pré-visualização.";
      const year = extractNarrativeYear(item);
      const dateLabel = formatDateLabel(item.created_at || item.linked_at || null);
      const phase = String(item.phase_name ?? item.life_phase ?? "").trim();

      return {
        ...item,
        _ui: {
          isFirst,
          isLast,
          title,
          excerpt,
          year,
          dateLabel,
          phase,
        },
      };
    });
  }, [items]);

  const styles = {
    wrap: {
      background: "var(--hdud-card)",
      borderRadius: 18,
      padding: 18,
      border: "1px solid var(--hdud-border)",
      boxShadow: "var(--hdud-shadow)",
      marginTop: 14,
      overflow: "hidden" as const,
    },
    header: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 14,
      flexWrap: "wrap" as const,
      marginBottom: 14,
    },
    headerLeft: {
      minWidth: 0,
      flex: "1 1 420px",
    },
    eyebrow: {
      fontSize: 12,
      fontWeight: 900,
      letterSpacing: 0.3,
      textTransform: "uppercase" as const,
      opacity: 0.72,
      marginBottom: 6,
    },
    title: {
      margin: 0,
      fontSize: 24,
      lineHeight: 1.05,
      letterSpacing: -0.4,
      fontWeight: 950,
      color: "var(--hdud-text)",
    },
    subtitle: {
      marginTop: 8,
      fontSize: 13,
      lineHeight: 1.45,
      fontWeight: 700,
      opacity: 0.78,
      color: "var(--hdud-text)",
    },
    addBtn: {
      padding: "10px 14px",
      borderRadius: 12,
      border: "1px solid var(--hdud-primary)",
      background: "var(--hdud-primary)",
      color: "var(--hdud-primary-contrast)",
      fontWeight: 900,
      cursor: busy ? "not-allowed" : "pointer",
      opacity: busy ? 0.6 : 1,
      boxShadow: "var(--hdud-shadow-soft)",
      whiteSpace: "nowrap" as const,
    },
    loadingBox: {
      border: "1px dashed var(--hdud-border)",
      background: "var(--hdud-surface)",
      borderRadius: 16,
      padding: 18,
      fontWeight: 800,
      opacity: 0.82,
    },
    emptyBox: {
      border: "1px dashed var(--hdud-border)",
      background: "linear-gradient(180deg, var(--hdud-surface), var(--hdud-surface-2))",
      borderRadius: 18,
      padding: 22,
    },
    emptyTitle: {
      margin: 0,
      fontSize: 18,
      fontWeight: 950,
      letterSpacing: -0.2,
      color: "var(--hdud-text)",
    },
    emptyText: {
      marginTop: 8,
      fontSize: 14,
      lineHeight: 1.5,
      opacity: 0.8,
      fontWeight: 700,
      color: "var(--hdud-text)",
      maxWidth: 760,
    },
    emptyActions: {
      marginTop: 14,
      display: "flex",
      gap: 10,
      flexWrap: "wrap" as const,
    },
    ghostBtn: {
      padding: "10px 14px",
      borderRadius: 12,
      border: "1px solid var(--hdud-border)",
      background: "var(--hdud-surface)",
      color: "var(--hdud-text)",
      fontWeight: 900,
      cursor: busy ? "not-allowed" : "pointer",
      opacity: busy ? 0.6 : 1,
      boxShadow: "var(--hdud-shadow-soft)",
    },
    list: {
      display: "grid",
      gap: 16,
      position: "relative" as const,
    },
    row: {
      display: "grid",
      gridTemplateColumns: "88px minmax(0, 1fr)",
      gap: 14,
      alignItems: "stretch",
    },
    leftRail: {
      position: "relative" as const,
      minHeight: 96,
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "center",
    },
    line: {
      position: "absolute" as const,
      left: "50%",
      top: 0,
      bottom: 0,
      width: 2,
      transform: "translateX(-50%)",
      background: "linear-gradient(180deg, rgba(15,23,42,0.12), rgba(15,23,42,0.05))",
    },
    dotWrap: {
      position: "relative" as const,
      zIndex: 1,
      marginTop: 6,
      display: "flex",
      flexDirection: "column" as const,
      alignItems: "center",
      gap: 8,
    },
    dot: {
      width: 14,
      height: 14,
      borderRadius: 999,
      background: "var(--hdud-primary)",
      boxShadow: "0 0 0 4px rgba(15,23,42,0.06)",
      border: "2px solid rgba(255,255,255,0.85)",
    },
    year: {
      fontSize: 12,
      fontWeight: 950,
      letterSpacing: 0.3,
      opacity: 0.82,
      color: "var(--hdud-text)",
      textTransform: "uppercase" as const,
    },
    card: {
      border: "1px solid var(--hdud-border)",
      background: "linear-gradient(180deg, var(--hdud-surface), var(--hdud-surface-2))",
      borderRadius: 18,
      padding: 16,
      boxShadow: "var(--hdud-shadow-soft)",
      minWidth: 0,
    },
    cardTop: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 12,
      flexWrap: "wrap" as const,
    },
    cardTitleWrap: {
      minWidth: 0,
      flex: "1 1 320px",
    },
    memoryTitle: {
      margin: 0,
      fontSize: 18,
      lineHeight: 1.15,
      letterSpacing: -0.25,
      fontWeight: 950,
      color: "var(--hdud-text)",
      wordBreak: "break-word" as const,
    },
    memoryMeta: {
      marginTop: 8,
      display: "flex",
      gap: 8,
      flexWrap: "wrap" as const,
      alignItems: "center",
    },
    pill: {
      display: "inline-flex",
      alignItems: "center",
      padding: "5px 9px",
      borderRadius: 999,
      border: "1px solid var(--hdud-border)",
      background: "rgba(255,255,255,0.62)",
      fontSize: 11,
      fontWeight: 900,
      opacity: 0.86,
      color: "var(--hdud-text)",
    },
    sortTag: {
      display: "inline-flex",
      alignItems: "center",
      padding: "5px 9px",
      borderRadius: 999,
      border: "1px solid var(--hdud-border)",
      background: "rgba(255,255,255,0.72)",
      fontSize: 11,
      fontWeight: 950,
      opacity: 0.9,
      color: "var(--hdud-text)",
      whiteSpace: "nowrap" as const,
    },
    excerpt: {
      marginTop: 12,
      fontSize: 14,
      lineHeight: 1.55,
      opacity: 0.86,
      color: "var(--hdud-text)",
      fontWeight: 700,
      wordBreak: "break-word" as const,
    },
    actions: {
      marginTop: 14,
      display: "flex",
      gap: 8,
      flexWrap: "wrap" as const,
      alignItems: "center",
    },
    actionBtn: {
      padding: "8px 11px",
      borderRadius: 10,
      border: "1px solid var(--hdud-border)",
      background: "var(--hdud-surface)",
      color: "var(--hdud-text)",
      fontWeight: 900,
      cursor: busy ? "not-allowed" : "pointer",
      opacity: busy ? 0.6 : 1,
      boxShadow: "var(--hdud-shadow-soft)",
      fontSize: 12,
      whiteSpace: "nowrap" as const,
    },
    dangerBtn: {
      padding: "8px 11px",
      borderRadius: 10,
      border: "1px solid rgba(127,29,29,0.18)",
      background: "rgba(127,29,29,0.06)",
      color: "var(--hdud-text)",
      fontWeight: 900,
      cursor: busy ? "not-allowed" : "pointer",
      opacity: busy ? 0.6 : 1,
      boxShadow: "var(--hdud-shadow-soft)",
      fontSize: 12,
      whiteSpace: "nowrap" as const,
    },
  };

  return (
    <section style={styles.wrap}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.eyebrow}>Memórias deste capítulo</div>
          <h3 style={styles.title}>
            {chapterTitle?.trim() ? `Timeline de “${chapterTitle}”` : "Timeline narrativa"}
          </h3>
          <div style={styles.subtitle}>
            Organize a linha da história deste capítulo. A ordem visual respeita o vínculo narrativo atual.
          </div>
        </div>

        <button type="button" style={styles.addBtn} onClick={onAddMemory} disabled={busy}>
          + Adicionar memória
        </button>
      </div>

      {loading ? (
        <div style={styles.loadingBox}>Carregando memórias deste capítulo…</div>
      ) : !hasItems ? (
        <div style={styles.emptyBox}>
          <p style={styles.emptyTitle}>Este capítulo ainda não possui memórias.</p>
          <div style={styles.emptyText}>
            Adicione memórias para transformar este capítulo em uma linha narrativa viva, com ordem,
            contexto e progressão.
          </div>

          <div style={styles.emptyActions}>
            <button type="button" style={styles.ghostBtn} onClick={onAddMemory} disabled={busy}>
              Adicionar memória ao capítulo
            </button>
          </div>
        </div>
      ) : (
        <div style={styles.list}>
          {rows.map((item) => (
            <div key={item.memory_id} style={styles.row}>
              <div style={styles.leftRail}>
                {!item._ui.isLast && <div style={styles.line} />}
                <div style={styles.dotWrap}>
                  <div style={styles.dot} />
                  <div style={styles.year}>{item._ui.year}</div>
                </div>
              </div>

              <article style={styles.card}>
                <div style={styles.cardTop}>
                  <div style={styles.cardTitleWrap}>
                    <h4 style={styles.memoryTitle}>{item._ui.title}</h4>

                    <div style={styles.memoryMeta}>
                      <span style={styles.pill}>{item._ui.dateLabel}</span>

                      {item._ui.phase ? <span style={styles.pill}>{item._ui.phase}</span> : null}

                      <span style={styles.sortTag}>
                        ordem {item.sort_order != null ? item.sort_order : "auto"}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={styles.excerpt}>{item._ui.excerpt}</div>

                <div style={styles.actions}>
                  <button
                    type="button"
                    style={styles.actionBtn}
                    onClick={() => onOpenMemory(item.memory_id)}
                    disabled={busy}
                  >
                    Abrir
                  </button>

                  <button
                    type="button"
                    style={styles.actionBtn}
                    onClick={() => onEditMemory(item.memory_id)}
                    disabled={busy}
                  >
                    Editar
                  </button>

                  <button
                    type="button"
                    style={styles.actionBtn}
                    onClick={() => onMoveUp(item.memory_id)}
                    disabled={busy || item._ui.isFirst}
                    title="Mover para cima"
                  >
                    ↑
                  </button>

                  <button
                    type="button"
                    style={styles.actionBtn}
                    onClick={() => onMoveDown(item.memory_id)}
                    disabled={busy || item._ui.isLast}
                    title="Mover para baixo"
                  >
                    ↓
                  </button>

                  <button
                    type="button"
                    style={styles.dangerBtn}
                    onClick={() => onRemoveMemory(item.memory_id)}
                    disabled={busy}
                  >
                    Remover do capítulo
                  </button>
                </div>
              </article>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}