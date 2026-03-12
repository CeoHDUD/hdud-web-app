// C:\HDUD_DATA\hdud-web-app\src\pages\chapters\components\ChapterEditorCard.tsx

import React from "react";
import ChapterTimeline from "../../../components/ChapterTimeline";
import type { ChaptersPageUI } from "../styles";
import type { ChapterMemoryItem, ChapterStatus, Toast } from "../types";
import { DEFAULT_NEW_TITLE } from "../utils";

type Props = {
  ui: ChaptersPageUI;
  token: string | null;
  authorId: number | null;
  openChapterId: number | null;
  isNewUnsaved: boolean;
  versionLabel: string;
  status: ChapterStatus;
  chapterMemories: ChapterMemoryItem[];
  loadingMemories: boolean;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
  toast: Toast | null;
  showDiag: boolean;
  lastApiInfo: string;
  isDirty: boolean;
  dirtyInfo: string;
  loading: boolean;
  saving: boolean;
  title: string;
  description: string;
  body: string;
  didFocusTitle: React.MutableRefObject<boolean>;
  onTitleChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onBodyChange: (v: string) => void;
  onOpenPicker: () => void;
  onRefreshLinks: () => void;
  onSaveDraft: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
  onReloadSelected: () => void;
  onGoListMode: () => void;
  onOpenMemory: (memoryId: number) => void;
  onEditMemory: (memoryId: number) => void;
  onMoveMemory: (memoryId: number, dir: -1 | 1) => void;
  onRemoveMemory: (memoryId: number) => void;
};

export default function ChapterEditorCard({
  ui,
  token,
  authorId,
  openChapterId,
  isNewUnsaved,
  versionLabel,
  status,
  chapterMemories,
  loadingMemories,
  createdAt,
  updatedAt,
  publishedAt,
  toast,
  showDiag,
  lastApiInfo,
  isDirty,
  dirtyInfo,
  loading,
  saving,
  title,
  description,
  body,
  didFocusTitle,
  onTitleChange,
  onDescriptionChange,
  onBodyChange,
  onOpenPicker,
  onRefreshLinks,
  onSaveDraft,
  onPublish,
  onUnpublish,
  onReloadSelected,
  onGoListMode,
  onOpenMemory,
  onEditMemory,
  onMoveMemory,
  onRemoveMemory,
}: Props) {
  const publishDisabledBecauseAlreadyPublic = !isNewUnsaved && status === "PUBLIC" && !isDirty;
  const canUnpublish = !isNewUnsaved && !!openChapterId && status === "PUBLIC";

  const publishBtnLabel =
    isNewUnsaved ? "Publicar" : status === "PUBLIC" ? (isDirty ? "Atualizar publicação" : "Publicado") : "Publicar";

  return (
    <div style={ui.card}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <div style={ui.pill}>{isNewUnsaved ? "SEM ID" : `ID ${openChapterId ?? "—"}`}</div>
        <div style={ui.pill}>{versionLabel}</div>
        <div style={ui.pill}>{status === "PUBLIC" ? "Público" : "Rascunho"}</div>
        <div style={ui.pill}>{loadingMemories ? "memórias: …" : `memórias: ${chapterMemories.length}`}</div>

        <div style={{ flex: "1 1 auto" }} />

        <button
          type="button"
          style={isNewUnsaved || !openChapterId ? { ...ui.btn, ...ui.btnDisabled } : ui.btnPrimary}
          disabled={saving || loading || isNewUnsaved || !openChapterId}
          onClick={onOpenPicker}
          title={isNewUnsaved ? "Salve o capítulo primeiro" : "Vincular uma memória"}
        >
          + Vincular memória
        </button>

        <button
          type="button"
          style={isNewUnsaved || !openChapterId ? { ...ui.btn, ...ui.btnDisabled } : ui.btn}
          disabled={saving || loading || isNewUnsaved || !openChapterId}
          onClick={onRefreshLinks}
          title="Atualizar vínculos"
        >
          Atualizar vínculos
        </button>
      </div>

      <div style={{ marginTop: 10, opacity: 0.75, fontSize: 12, fontWeight: 800 }}>
        Criado: {createdAt} • Última atualização: {updatedAt} • Publicado: {publishedAt}
      </div>

      {toast ? (
        <div
          style={{
            marginTop: 12,
            padding: 10,
            borderRadius: 12,
            border: "1px solid var(--hdud-border)",
            background:
              toast.kind === "ok"
                ? "rgba(52, 199, 89, 0.10)"
                : toast.kind === "warn"
                ? "rgba(255, 204, 0, 0.10)"
                : "rgba(255, 59, 48, 0.10)",
          }}
        >
          <b style={{ textTransform: "uppercase", fontSize: 11, opacity: 0.8 }}>{toast.kind}</b> — {toast.msg}
        </div>
      ) : null}

      {showDiag ? (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid var(--hdud-border)", background: "rgba(255,255,255,0.02)" }}>
          <div style={{ fontWeight: 950, marginBottom: 6 }}>Diagnóstico</div>
          <div style={{ fontSize: 12, opacity: 0.78, marginTop: 6 }}>token: {token ? "OK" : "—"}</div>
          <div style={{ fontSize: 12, opacity: 0.78, marginTop: 6 }}>authorId (JWT): {authorId ?? "—"}</div>
          <div style={{ fontSize: 12, opacity: 0.78, marginTop: 6 }}>API: {lastApiInfo || "—"}</div>
          <div style={{ fontSize: 12, opacity: 0.78, marginTop: 6 }}>isDirty: {String(isDirty)}</div>
          <div style={{ fontSize: 12, opacity: 0.78, marginTop: 6 }}>dirtyInfo: {dirtyInfo}</div>
          <div style={{ fontSize: 12, opacity: 0.78, marginTop: 6 }}>isNewUnsaved: {String(isNewUnsaved)}</div>
        </div>
      ) : null}

      <div style={{ marginTop: 14 }}>
        <div style={ui.label}>Título (livre)</div>
        <input
          style={ui.input}
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          onFocus={() => {
            if (!didFocusTitle.current) {
              didFocusTitle.current = true;
              if (title === DEFAULT_NEW_TITLE) onTitleChange("");
            }
          }}
          placeholder="Ex.: Minha chegada ao mundo"
        />
        <div style={{ fontSize: 11, opacity: 0.7, marginTop: 6, fontWeight: 800 }}>
          {title.trim().length} / 120
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={ui.label}>Descrição curta (opcional)</div>
        <textarea
          style={ui.textarea}
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Uma frase curta: sobre o que é essa fase da sua vida?"
          maxLength={220}
        />
        <div style={{ fontSize: 11, opacity: 0.7, marginTop: 6, fontWeight: 800 }}>
          {description.trim().length} / 220
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={ui.label}>Texto do capítulo</div>
        <textarea
          style={{ ...ui.textarea, minHeight: 240 }}
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          placeholder="Escreva com calma. Isso é o mapa da sua vida."
        />
        <div style={{ fontSize: 11, opacity: 0.7, marginTop: 6, fontWeight: 800 }}>
          {body.trim().length} caracteres
        </div>
      </div>

      <ChapterTimeline
        chapterTitle={title}
        items={chapterMemories}
        loading={loadingMemories}
        busy={saving || loading || loadingMemories}
        onAddMemory={onOpenPicker}
        onOpenMemory={onOpenMemory}
        onEditMemory={onEditMemory}
        onMoveUp={(memoryId) => onMoveMemory(memoryId, -1)}
        onMoveDown={(memoryId) => onMoveMemory(memoryId, 1)}
        onRemoveMemory={(memoryId) => onRemoveMemory(memoryId)}
      />

      <div style={ui.stickyActionsWrap}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" style={ui.btnPrimary} onClick={onSaveDraft} disabled={loading || saving}>
            {saving ? "Salvando…" : "Salvar"}
          </button>

          <button
            type="button"
            style={{ ...ui.btn, ...(publishDisabledBecauseAlreadyPublic ? ui.btnDisabled : null) }}
            onClick={onPublish}
            disabled={loading || saving || publishDisabledBecauseAlreadyPublic}
            title={
              publishDisabledBecauseAlreadyPublic
                ? "Já está publicado (sem mudanças). Edite algo para habilitar."
                : isNewUnsaved
                ? "Publicar e criar no banco"
                : "Publicar"
            }
          >
            {publishBtnLabel}
          </button>

          <button
            type="button"
            style={{ ...ui.btn, ...(!canUnpublish ? ui.btnDisabled : null) }}
            onClick={onUnpublish}
            disabled={loading || saving || !canUnpublish}
            title={isNewUnsaved ? "Crie/publicar primeiro" : status !== "PUBLIC" ? "Somente quando estiver público" : "Voltar para rascunho"}
          >
            Despublicar
          </button>

          <button type="button" style={ui.btn} onClick={onReloadSelected} disabled={loading || saving || isNewUnsaved || !openChapterId}>
            Recarregar
          </button>

          <div style={{ flex: "1 1 auto" }} />

          <button type="button" style={ui.btnGhost} onClick={onGoListMode} disabled={loading || saving}>
            Voltar
          </button>
        </div>
      </div>
    </div>
  );
}