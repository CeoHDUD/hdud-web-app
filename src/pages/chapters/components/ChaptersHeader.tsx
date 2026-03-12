// C:\HDUD_DATA\hdud-web-app\src\pages\chapters\components\ChaptersHeader.tsx

import React from "react";
import type { ChaptersPageUI } from "../styles";
import type { SortKey, StatusFilter } from "../types";

type Props = {
  ui: ChaptersPageUI;
  mode: "list" | "edit";
  countLabel: string;
  microcopy: string;
  pulseLabel: string;
  showDiag: boolean;
  loading: boolean;
  saving: boolean;
  q: string;
  statusFilter: StatusFilter;
  sortKey: SortKey;
  onQChange: (v: string) => void;
  onStatusFilterChange: (v: StatusFilter) => void;
  onSortKeyChange: (v: SortKey) => void;
  onReloadList: () => void;
  onToggleDiag: () => void;
  onCreateChapter: () => void;
};

export default function ChaptersHeader({
  ui,
  mode,
  countLabel,
  microcopy,
  pulseLabel,
  showDiag,
  loading,
  saving,
  q,
  statusFilter,
  sortKey,
  onQChange,
  onStatusFilterChange,
  onSortKeyChange,
  onReloadList,
  onToggleDiag,
  onCreateChapter,
}: Props) {
  return (
    <div style={ui.headerCard}>
      <div style={ui.headerGlow} />

      <div style={ui.h1Row}>
        <div>
          <h1 style={ui.h1}>Capítulos</h1>
          <div style={ui.subtitle}>
            Bom dia, Alexandre. <span style={{ opacity: 0.82 }}>{pulseLabel}</span>
          </div>
        </div>

        <div style={ui.pill}>{countLabel}</div>
      </div>

      <div style={{ marginTop: 10, opacity: 0.82, fontWeight: 750, position: "relative", zIndex: 1 }}>
        {microcopy}
      </div>

      {mode === "list" ? (
        <div style={ui.toolbarRow}>
          <button
            type="button"
            style={ui.btnPrimary}
            onClick={onCreateChapter}
            disabled={loading || saving}
            title="Criar um novo capítulo (rascunho local)"
          >
            + Criar capítulo
          </button>

          <div style={ui.spacer} />

          <input
            style={{ ...ui.input, width: 280 }}
            placeholder="Buscar (título, descrição ou #ID)…"
            value={q}
            onChange={(e) => onQChange(e.target.value)}
          />

          <select style={ui.select} value={statusFilter} onChange={(e) => onStatusFilterChange(e.target.value as StatusFilter)}>
            <option value="ALL">Status: Todos</option>
            <option value="DRAFT">Status: Rascunhos</option>
            <option value="PUBLIC">Status: Públicos</option>
          </select>

          <select style={ui.select} value={sortKey} onChange={(e) => onSortKeyChange(e.target.value as SortKey)}>
            <option value="RECENT">Mais recentes</option>
            <option value="OLD">Mais antigos</option>
            <option value="TITLE">Título</option>
          </select>

          <button type="button" style={ui.btn} onClick={onReloadList} disabled={loading || saving}>
            {loading ? "Atualizando…" : "Atualizar"}
          </button>

          <button type="button" style={showDiag ? ui.btnPrimary : ui.btn} onClick={onToggleDiag} disabled={loading || saving}>
            Diagnóstico
          </button>
        </div>
      ) : null}
    </div>
  );
}