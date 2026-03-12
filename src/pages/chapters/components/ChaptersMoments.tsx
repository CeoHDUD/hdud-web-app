// C:\HDUD_DATA\hdud-web-app\src\pages\chapters\components\ChaptersMoments.tsx

import React from "react";
import type { ChaptersPageUI } from "../styles";
import type { ApiChapterListItem } from "../types";
import { formatDateBRShort } from "../utils";

type Props = {
  ui: ChaptersPageUI;
  latestChapter: ApiChapterListItem | null;
  pulseLabel: string;
  destaque: ApiChapterListItem | null;
  revisitar: ApiChapterListItem | null;
  hoverId: number | null;
  setHoverId: React.Dispatch<React.SetStateAction<number | null>>;
  confirmIfDirty: (actionLabel: string) => boolean;
  onOpenChapter: (chapterId: number) => void;
};

export default function ChaptersMoments({
  ui,
  latestChapter,
  pulseLabel,
  destaque,
  revisitar,
  hoverId,
  setHoverId,
  confirmIfDirty,
  onOpenChapter,
}: Props) {
  return (
    <div style={ui.card}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <div style={ui.cardTitle}>Momento</div>
        <div style={{ opacity: 0.75, fontSize: 12, fontWeight: 900 }}>
          {latestChapter ? `Pulso: ${pulseLabel}` : "Pulso: em silêncio"}
        </div>
      </div>

      <div style={ui.grid2}>
        {destaque ? (
          <div
            style={ui.momentCard}
            onClick={() => {
              if (!confirmIfDirty("Abrir capítulo (em destaque)")) return;
              onOpenChapter(destaque.chapter_id);
            }}
            onMouseEnter={() => setHoverId(destaque.chapter_id)}
            onMouseLeave={() => setHoverId((v) => (v === destaque.chapter_id ? null : v))}
            title="Abrir capítulo"
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ opacity: 0.8, fontSize: 12, fontWeight: 900 }}>Em destaque</div>
                <p style={ui.momentTitle}>
                  {destaque.title?.trim() ? destaque.title : `Capítulo #${destaque.chapter_id}`}
                </p>
              </div>
              <div style={{ opacity: 0.7, fontSize: 12, fontWeight: 900, whiteSpace: "nowrap" }}>
                {formatDateBRShort(destaque.updated_at || destaque.created_at)}
              </div>
            </div>
            <div style={ui.momentMeta}>
              {destaque.description ? destaque.description : "Abra e descreva a fase com 1–2 frases."}
            </div>
          </div>
        ) : (
          <div style={ui.empty}>
            <p style={ui.emptyTitle}>Seu mapa começa aqui.</p>
            <div style={ui.emptyText}>Crie o primeiro capítulo e dê estrutura às suas memórias.</div>
          </div>
        )}

        {revisitar ? (
          <div
            style={ui.momentCard}
            onClick={() => {
              if (!confirmIfDirty("Abrir capítulo (revisitar)")) return;
              onOpenChapter(revisitar.chapter_id);
            }}
            onMouseEnter={() => setHoverId(revisitar.chapter_id)}
            onMouseLeave={() => setHoverId((v) => (v === revisitar.chapter_id ? null : v))}
            title="Abrir capítulo"
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ opacity: 0.8, fontSize: 12, fontWeight: 900 }}>Revisitar</div>
                <p style={ui.momentTitle}>
                  {revisitar.title?.trim() ? revisitar.title : `Capítulo #${revisitar.chapter_id}`}
                </p>
              </div>
              <div style={{ opacity: 0.7, fontSize: 12, fontWeight: 900, whiteSpace: "nowrap" }}>
                {formatDateBRShort(revisitar.created_at)}
              </div>
            </div>
            <div style={ui.momentMeta}>
              {revisitar.description ? revisitar.description : "Volte aqui e refine — capítulos ficam melhores com revisita."}
            </div>
          </div>
        ) : (
          <div style={ui.empty}>
            <p style={ui.emptyTitle}>Sem revisitas ainda.</p>
            <div style={ui.emptyText}>Quando você tiver mais capítulos, eu trago um antigo de forma orgânica.</div>
          </div>
        )}
      </div>
    </div>
  );
}