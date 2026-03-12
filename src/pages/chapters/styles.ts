// C:\HDUD_DATA\hdud-web-app\src\pages\chapters\styles.ts

import React from "react";

export function buildChaptersPageUI() {
  const page: React.CSSProperties = { padding: 0, color: "var(--hdud-text)" };

  const container: React.CSSProperties = {
    width: "100%",
    maxWidth: 1920,
    margin: "0 auto",
    padding: "18px clamp(16px, 2.2vw, 36px)",
    paddingBottom: 140,
    boxSizing: "border-box",
    position: "relative",
  };

  const headerCard: React.CSSProperties = {
    background: "var(--hdud-card)",
    borderRadius: 16,
    padding: 18,
    boxShadow: "var(--hdud-shadow)",
    marginBottom: 14,
    border: "1px solid var(--hdud-border)",
    position: "relative",
    overflow: "hidden",
  };

  const headerGlow: React.CSSProperties = {
    position: "absolute",
    inset: -60,
    background: "radial-gradient(closest-side, rgba(0,0,0,0.06), transparent 60%)",
    pointerEvents: "none",
    opacity: 0.55,
    filter: "blur(2px)",
    transform: "translate3d(0,0,0)",
  };

  const h1Row: React.CSSProperties = {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    position: "relative",
    zIndex: 1,
  };

  const h1: React.CSSProperties = {
    fontSize: 40,
    fontWeight: 950,
    letterSpacing: -0.7,
    margin: 0,
    lineHeight: 1,
  };

  const subtitle: React.CSSProperties = {
    marginTop: 8,
    opacity: 0.82,
    fontWeight: 750,
    position: "relative",
    zIndex: 1,
  };

  const toolbarRow: React.CSSProperties = {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 14,
    position: "relative",
    zIndex: 1,
  };

  const spacer: React.CSSProperties = { flex: "1 1 auto" };

  const card: React.CSSProperties = {
    background: "var(--hdud-card)",
    borderRadius: 16,
    padding: 14,
    boxShadow: "var(--hdud-shadow)",
    border: "1px solid var(--hdud-border)",
    marginBottom: 14,
    overflowX: "hidden",
  };

  const cardTitle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 950,
    marginBottom: 10,
    letterSpacing: 0.2,
    opacity: 0.9,
    textTransform: "uppercase",
  };

  const label: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 900,
    opacity: 0.85,
    marginBottom: 6,
  };

  const input: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid var(--hdud-border)",
    background: "var(--hdud-surface)",
    color: "var(--hdud-text)",
    outline: "none",
    minWidth: 0,
    boxSizing: "border-box",
  };

  const textarea: React.CSSProperties = {
    width: "100%",
    minHeight: 140,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid var(--hdud-border)",
    background: "var(--hdud-surface)",
    color: "var(--hdud-text)",
    outline: "none",
    resize: "vertical",
    fontFamily: "inherit",
    lineHeight: 1.35,
    minWidth: 0,
    boxSizing: "border-box",
  };

  const select: React.CSSProperties = {
    padding: "9px 12px",
    borderRadius: 12,
    border: "1px solid var(--hdud-border)",
    background: "var(--hdud-surface)",
    color: "var(--hdud-text)",
    outline: "none",
    fontWeight: 800,
    maxWidth: "100%",
  };

  const btn: React.CSSProperties = {
    padding: "9px 14px",
    borderRadius: 12,
    border: "1px solid var(--hdud-border)",
    background: "var(--hdud-surface)",
    color: "var(--hdud-text)",
    cursor: "pointer",
    fontWeight: 900,
    whiteSpace: "nowrap",
    boxShadow: "var(--hdud-shadow-soft)",
    transition: "transform 140ms ease, box-shadow 140ms ease, opacity 140ms ease",
    opacity: 1,
    maxWidth: "100%",
  };

  const btnDisabled: React.CSSProperties = {
    opacity: 0.55,
    cursor: "not-allowed",
  };

  const btnPrimary: React.CSSProperties = {
    ...btn,
    background: "var(--hdud-primary)",
    borderColor: "var(--hdud-primary)",
    color: "var(--hdud-primary-contrast)",
  };

  const btnGhost: React.CSSProperties = { ...btn, background: "transparent" };

  const pill: React.CSSProperties = {
    border: "1px solid var(--hdud-border)",
    padding: "5px 10px",
    borderRadius: 999,
    fontSize: 12,
    opacity: 0.9,
    whiteSpace: "nowrap",
    background: "var(--hdud-surface-2)",
    fontWeight: 900,
    maxWidth: "100%",
  };

  const grid2: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  };

  const momentCard: React.CSSProperties = {
    border: "1px solid var(--hdud-border)",
    background: "var(--hdud-surface)",
    borderRadius: 14,
    padding: 14,
    boxShadow: "var(--hdud-shadow-soft)",
    cursor: "pointer",
    transition: "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
    position: "relative",
  };

  const momentTitle: React.CSSProperties = {
    fontWeight: 950,
    margin: 0,
    fontSize: 14,
    letterSpacing: -0.2,
  };

  const momentMeta: React.CSSProperties = {
    marginTop: 6,
    opacity: 0.78,
    fontSize: 12,
    fontWeight: 800,
    lineHeight: 1.25,
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  };

  const listWrap: React.CSSProperties = { display: "grid", gap: 10, marginTop: 10 };

  const row: React.CSSProperties = {
    border: "1px solid var(--hdud-border)",
    background: "var(--hdud-surface)",
    borderRadius: 14,
    padding: 12,
    cursor: "pointer",
    boxShadow: "var(--hdud-shadow-soft)",
    transition: "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
    transform: "translate3d(0,0,0)",
    userSelect: "none",
    position: "relative",
    outline: "none",
  };

  const rowHover: React.CSSProperties = {
    transform: "translate3d(0,-2px,0)",
    boxShadow: "var(--hdud-shadow)",
    borderColor: "rgba(0,0,0,0.12)",
  };

  const rowSelected: React.CSSProperties = {
    borderColor: "rgba(0,0,0,0.18)",
    boxShadow: "0 0 0 3px rgba(0,0,0,0.06), var(--hdud-shadow)",
    background: "linear-gradient(180deg, rgba(0,0,0,0.015), rgba(0,0,0,0.0))",
  };

  const selectedBar: React.CSSProperties = {
    position: "absolute",
    left: 0,
    top: 10,
    bottom: 10,
    width: 4,
    borderRadius: 999,
    background: "var(--hdud-primary)",
    opacity: 0.9,
    boxShadow: "0 6px 18px rgba(0,0,0,0.10)",
  };

  const rowTop: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "baseline",
  };

  const rowTitle: React.CSSProperties = { fontWeight: 950, fontSize: 14, margin: 0, letterSpacing: -0.2 };

  const rowMeta: React.CSSProperties = { opacity: 0.75, fontSize: 12, whiteSpace: "nowrap", fontWeight: 800 };

  const rowSub: React.CSSProperties = {
    opacity: 0.82,
    fontSize: 12,
    marginTop: 8,
    lineHeight: 1.35,
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  };

  const empty: React.CSSProperties = {
    border: "1px dashed var(--hdud-border)",
    background: "var(--hdud-surface)",
    borderRadius: 14,
    padding: 16,
    opacity: 0.9,
  };

  const emptyTitle: React.CSSProperties = { margin: 0, fontWeight: 950, letterSpacing: -0.2 };

  const emptyText: React.CSSProperties = { marginTop: 6, opacity: 0.82, fontWeight: 750, lineHeight: 1.35 };

  const stickyActionsWrap: React.CSSProperties = {
    position: "sticky",
    bottom: 14,
    zIndex: 20,
    marginTop: 14,
    paddingTop: 10,
    background: "linear-gradient(180deg, rgba(255,255,255,0.00), rgba(255,255,255,0.85) 22%, rgba(255,255,255,0.95))",
    backdropFilter: "blur(6px)",
    borderTop: "1px solid rgba(0,0,0,0.06)",
  };

  const overlay: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 999,
  };

  const modal: React.CSSProperties = {
    width: "min(920px, 96vw)",
    maxHeight: "min(78vh, 720px)",
    overflow: "hidden",
    borderRadius: 16,
    border: "1px solid var(--hdud-border)",
    background: "var(--hdud-card)",
    boxShadow: "var(--hdud-shadow)",
    display: "flex",
    flexDirection: "column",
  };

  const modalHead: React.CSSProperties = {
    padding: 14,
    borderBottom: "1px solid var(--hdud-border)",
    display: "flex",
    gap: 10,
    alignItems: "center",
    justifyContent: "space-between",
  };

  const modalBody: React.CSSProperties = {
    padding: 14,
    overflow: "auto",
  };

  return {
    page,
    container,
    headerCard,
    headerGlow,
    h1Row,
    h1,
    subtitle,
    toolbarRow,
    spacer,
    card,
    cardTitle,
    label,
    input,
    textarea,
    select,
    btn,
    btnPrimary,
    btnGhost,
    btnDisabled,
    pill,
    grid2,
    momentCard,
    momentTitle,
    momentMeta,
    listWrap,
    row,
    rowHover,
    rowSelected,
    selectedBar,
    rowTop,
    rowTitle,
    rowMeta,
    rowSub,
    empty,
    emptyTitle,
    emptyText,
    stickyActionsWrap,
    overlay,
    modal,
    modalHead,
    modalBody,
  };
}

export type ChaptersPageUI = ReturnType<typeof buildChaptersPageUI>;