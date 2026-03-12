// C:\HDUD_DATA\hdud-web-app\src\pages\chapters\components\ChaptersList.tsx

import React from "react";
import type { ChaptersPageUI } from "../styles";
import type { ApiChapterListItem } from "../types";
import { formatDateBRShort } from "../utils";

type Props = {
  ui: ChaptersPageUI;
  items: ApiChapterListItem[];
  allItemsCount: number;
  openChapterId: number | null;
  selectedChapterId: number | null;
  hoverId: number | null;
  setHoverId: React.Dispatch<React.SetStateAction<number | null>>;
  confirmIfDirty: (actionLabel: string) => boolean;
  onOpenChapter: (chapterId: number) => void;
  onClearFilters: () => void;
};

export default function ChaptersList({
  ui,
  items,
  allItemsCount,
  openChapterId,
  selectedChapterId,
  hoverId,
  setHoverId,
  confirmIfDirty,
  onOpenChapter,
  onClearFilters,
}: Props) {
  return (
    <div style={ui.card}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={ui.cardTitle}>Capítulos existentes</div>

        <div style={{ opacity: 0.75, fontSize: 12, fontWeight: 900 }}>
          {items.length === allItemsCount ? `${allItemsCount} capítulo(s)` : `${items.length}/${allItemsCount} capítulo(s)`}
        </div>
      </div>

      {items.length === 0 ? (
        <div style={ui.empty}>
          <p style={ui.emptyTitle}>
            {allItemsCount === 0 ? "Nenhum capítulo ainda." : "Nenhum capítulo encontrado."}
          </p>

          <div style={ui.emptyText}>
            {allItemsCount === 0
              ? "Crie o primeiro capítulo para começar a organizar as suas memórias em fases da vida."
              : "A busca e os filtros atuais não retornaram capítulos. Ajuste os filtros para continuar."}
          </div>

          {allItemsCount > 0 ? (
            <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" style={ui.btn} onClick={onClearFilters}>
                Limpar filtros
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div style={ui.listWrap}>
          {items.map((c) => {
            const selected = (openChapterId ?? selectedChapterId) === c.chapter_id;
            const hovered = hoverId === c.chapter_id;

            return (
              <div
                key={c.chapter_id}
                style={{
                  ...ui.row,
                  ...(hovered ? ui.rowHover : null),
                  ...(selected ? ui.rowSelected : null),
                }}
                onMouseEnter={() => setHoverId(c.chapter_id)}
                onMouseLeave={() => setHoverId((v) => (v === c.chapter_id ? null : v))}
                onClick={() => {
                  if (!confirmIfDirty(`Abrir capítulo #${c.chapter_id}`)) return;
                  onOpenChapter(c.chapter_id);
                }}
                title="Abrir capítulo"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (!confirmIfDirty(`Abrir capítulo #${c.chapter_id}`)) return;
                    onOpenChapter(c.chapter_id);
                  }
                }}
              >
                {selected ? <div style={ui.selectedBar} /> : null}

                <div style={ui.rowTop}>
                  <div style={{ minWidth: 0 }}>
                    <p style={ui.rowTitle}>{c.title?.trim() ? c.title : `Capítulo #${c.chapter_id}`}</p>
                  </div>

                  <div style={ui.rowMeta}>{formatDateBRShort(c.updated_at || c.created_at)}</div>
                </div>

                <div style={ui.rowSub}>
                  {c.description?.trim()
                    ? c.description
                    : "Sem descrição curta. Abra o capítulo para escrever o contexto desta fase."}
                </div>

                <div
                  style={{
                    marginTop: 10,
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <div style={ui.pill}>ID {c.chapter_id}</div>
                  <div style={ui.pill}>{c.status === "PUBLIC" ? "Público" : "Rascunho"}</div>
                  {c.current_version_id ? <div style={ui.pill}>v{c.current_version_id}</div> : null}
                  {c.published_at ? <div style={ui.pill}>Publicado</div> : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}