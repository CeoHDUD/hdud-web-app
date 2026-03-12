// C:\HDUD_DATA\hdud-web-app\src\pages\chapters\components\MoveMemoryModal.tsx

import React from "react";
import type { ChaptersPageUI } from "../styles";
import type { MoveLinkState } from "../types";

type Props = {
  ui: ChaptersPageUI;
  moveLink: MoveLinkState;
  saving: boolean;
  openChapterId: number | null;
  setMoveLink: React.Dispatch<React.SetStateAction<MoveLinkState>>;
  setPickerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setLinkedElsewhereMap: React.Dispatch<React.SetStateAction<Record<number, number>>>;
  doMoveMemory: (fromChapterId: number, toChapterId: number, memoryId: number) => Promise<boolean>;
  loadChapterMemories: (chapterId: number) => Promise<void>;
};

export default function MoveMemoryModal({
  ui,
  moveLink,
  saving,
  openChapterId,
  setMoveLink,
  setPickerOpen,
  setLinkedElsewhereMap,
  doMoveMemory,
  loadChapterMemories,
}: Props) {
  if (!moveLink?.open) return null;

  return (
    <div style={ui.overlay} onClick={() => setMoveLink(null)}>
      <div style={{ ...ui.modal, width: "min(720px, 96vw)", maxHeight: "min(60vh, 520px)" }} onClick={(e) => e.stopPropagation()}>
        <div style={ui.modalHead}>
          <div>
            <div style={{ fontWeight: 950, letterSpacing: -0.2 }}>Memória já vinculada</div>
            <div style={{ opacity: 0.75, fontSize: 12, fontWeight: 800 }}>
              Esta memória já está no capítulo <b>#{moveLink.from_chapter_id}</b>.
            </div>
          </div>
          <button type="button" style={ui.btn} onClick={() => setMoveLink(null)} disabled={saving}>
            Fechar
          </button>
        </div>

        <div style={ui.modalBody}>
          <div style={{ fontWeight: 900, opacity: 0.9 }}>
            {moveLink.title?.trim() ? moveLink.title : `Memória #${moveLink.memory_id}`}
            <span style={{ opacity: 0.7, fontSize: 12, fontWeight: 900 }}> — #{moveLink.memory_id}</span>
          </div>

          <div style={{ marginTop: 10, opacity: 0.82, fontSize: 12, fontWeight: 800, lineHeight: 1.45 }}>
            Quer <b>mover</b> essa memória para o capítulo atual <b>#{moveLink.to_chapter_id}</b>?
            <div style={{ marginTop: 6, opacity: 0.75 }}>
              Ação: remover do capítulo #{moveLink.from_chapter_id} e vincular aqui.
            </div>
          </div>

          <div style={{ marginTop: 14, display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <button type="button" style={ui.btn} onClick={() => setMoveLink(null)} disabled={saving}>
              Cancelar
            </button>
            <button
              type="button"
              style={ui.btnPrimary}
              disabled={saving}
              onClick={async () => {
                if (!moveLink) return;
                const ok = await doMoveMemory(moveLink.from_chapter_id, moveLink.to_chapter_id, moveLink.memory_id);
                if (!ok) return;

                setMoveLink(null);
                setPickerOpen(false);
                setLinkedElsewhereMap((prev) => {
                  const next = { ...prev };
                  delete next[moveLink.memory_id];
                  return next;
                });

                if (openChapterId) await loadChapterMemories(openChapterId);
              }}
            >
              {saving ? "Movendo…" : "Mover para este capítulo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}