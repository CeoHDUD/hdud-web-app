// C:\HDUD_DATA\hdud-web-app\src\pages\chapters\components\MemoryPickerModal.tsx

import React from "react";
import type { ChaptersPageUI } from "../styles";
import type { ChapterMemoryItem } from "../types";
import { formatDateBRShort, safeText } from "../utils";

type Props = {
  ui: ChaptersPageUI;
  pickerOpen: boolean;
  pickerQ: string;
  pickerLoading: boolean;
  pickerViewItems: ChapterMemoryItem[];
  linkedIds: Set<number>;
  linkedElsewhereMap: Record<number, number>;
  openChapterId: number | null;
  saving: boolean;
  setPickerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setPickerQ: React.Dispatch<React.SetStateAction<string>>;
  setMoveLink: React.Dispatch<any>;
  linkMemory: (memoryId: number, memoryTitle?: string | null) => Promise<void>;
};

export default function MemoryPickerModal({
  ui,
  pickerOpen,
  pickerQ,
  pickerLoading,
  pickerViewItems,
  linkedIds,
  linkedElsewhereMap,
  openChapterId,
  saving,
  setPickerOpen,
  setPickerQ,
  setMoveLink,
  linkMemory,
}: Props) {
  if (!pickerOpen) return null;

  return (
    <div style={ui.overlay} onClick={() => setPickerOpen(false)}>
      <div style={ui.modal} onClick={(e) => e.stopPropagation()}>
        <div style={ui.modalHead}>
          <div>
            <div style={{ fontWeight: 950, letterSpacing: -0.2 }}>Vincular memória</div>
            <div style={{ opacity: 0.75, fontSize: 12, fontWeight: 800 }}>
              Escolha uma memória para anexar a este capítulo.
            </div>
          </div>
          <button type="button" style={ui.btn} onClick={() => setPickerOpen(false)}>
            Fechar
          </button>
        </div>

        <div style={ui.modalBody}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <input
              style={{ ...ui.input, maxWidth: 420 }}
              placeholder="Buscar por título, conteúdo ou #ID…"
              value={pickerQ}
              onChange={(e) => setPickerQ(e.target.value)}
            />
            <div style={ui.pill}>{pickerLoading ? "carregando…" : `${pickerViewItems.length} resultado(s)`}</div>
          </div>

          {pickerLoading ? (
            <div style={{ marginTop: 12, opacity: 0.85, fontWeight: 900 }}>Carregando inventário…</div>
          ) : pickerViewItems.length === 0 ? (
            <div style={{ marginTop: 12, ...ui.empty }}>
              <p style={ui.emptyTitle}>Nada encontrado.</p>
              <div style={ui.emptyText}>Tente outra busca — ou crie uma nova memória em Memórias.</div>
            </div>
          ) : (
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {pickerViewItems.map((m) => {
                const titleText = (m.title && String(m.title).trim()) || `Memória #${m.memory_id}`;
                const when = formatDateBRShort(m.created_at || null);
                const phaseLabel = (m.phase_name || m.life_phase || "").toString().trim();

                const alreadyHere = linkedIds.has(m.memory_id);
                const elsewhere = linkedElsewhereMap[m.memory_id] ?? null;
                const alreadyElsewhere = !!elsewhere && elsewhere !== openChapterId;

                const pillText = alreadyHere
                  ? "já vinculada neste capítulo"
                  : alreadyElsewhere
                  ? `já vinculada em outro capítulo #${elsewhere}`
                  : "";

                return (
                  <div
                    key={m.memory_id}
                    style={{
                      border: "1px solid var(--hdud-border)",
                      background: "var(--hdud-surface)",
                      borderRadius: 14,
                      padding: 12,
                      boxShadow: "var(--hdud-shadow-soft)",
                      display: "flex",
                      gap: 12,
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ minWidth: 0, flex: "1 1 520px" }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                        <div style={{ fontWeight: 950, letterSpacing: -0.2 }}>{titleText}</div>
                        <div style={{ opacity: 0.72, fontSize: 12, fontWeight: 900 }}>
                          #{m.memory_id}
                          {phaseLabel ? ` • ${phaseLabel}` : ""}
                          {when !== "—" ? ` • ${when}` : ""}
                        </div>
                      </div>

                      <div style={{ marginTop: 8, opacity: 0.82, fontSize: 12, lineHeight: 1.35, fontWeight: 750 }}>
                        {safeText(m.content, 220)}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
                      {pillText ? <div style={ui.pill}>{pillText}</div> : null}

                      {alreadyElsewhere ? (
                        <button
                          type="button"
                          style={ui.btnPrimary}
                          disabled={saving}
                          onClick={() => {
                            if (!openChapterId || !elsewhere) return;
                            setMoveLink({
                              open: true,
                              memory_id: m.memory_id,
                              from_chapter_id: elsewhere,
                              to_chapter_id: openChapterId,
                              title: m.title ?? null,
                            });
                          }}
                          title="Mover esta memória para o capítulo atual"
                        >
                          Mover para este capítulo
                        </button>
                      ) : (
                        <button
                          type="button"
                          style={alreadyHere ? { ...ui.btn, ...ui.btnDisabled } : ui.btnPrimary}
                          disabled={alreadyHere || saving}
                          onClick={() => void linkMemory(m.memory_id, m.title ?? null)}
                          title={alreadyHere ? "Esta memória já está vinculada neste capítulo" : "Vincular esta memória"}
                        >
                          {alreadyHere ? "Já vinculada" : "Vincular"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}