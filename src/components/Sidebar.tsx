// C:\HDUD_DATA\hdud-web-app\src\components\Sidebar.tsx

import React from "react";
import { NavLink } from "react-router-dom";

const linkStyle: React.CSSProperties = {
  display: "block",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid transparent",
};

export default function Sidebar() {
  return (
    <aside
      style={{
        borderRight: "1px solid var(--border)",
        background: "var(--surface-2)",
        padding: 14,
        position: "sticky",
        top: 0,
        height: "100vh",
      }}
    >
      <div style={{ padding: "6px 8px 14px 8px" }}>
        <div style={{ fontWeight: 750, letterSpacing: "-0.02em" }}>HDUD</div>
        <div style={{ color: "var(--muted)", fontSize: 12 }}>
          Plataforma de Memórias
        </div>
      </div>

      <nav style={{ display: "grid", gap: 8 }}>
        <NavLink
          to="/dashboard"
          style={({ isActive }) => ({
            ...linkStyle,
            background: isActive ? "var(--surface)" : "transparent",
            borderColor: isActive ? "var(--border)" : "transparent",
          })}
        >
          Início
        </NavLink>

        <NavLink
          to="/feed"
          style={({ isActive }) => ({
            ...linkStyle,
            background: isActive ? "var(--surface)" : "transparent",
            borderColor: isActive ? "var(--border)" : "transparent",
          })}
        >
          Feed
        </NavLink>

        <NavLink
          to="/chapters"
          style={({ isActive }) => ({
            ...linkStyle,
            background: isActive ? "var(--surface)" : "transparent",
            borderColor: isActive ? "var(--border)" : "transparent",
          })}
        >
          Capítulos
        </NavLink>

        <NavLink
          to="/memories"
          style={({ isActive }) => ({
            ...linkStyle,
            background: isActive ? "var(--surface)" : "transparent",
            borderColor: isActive ? "var(--border)" : "transparent",
          })}
        >
          Memórias
        </NavLink>

        <NavLink
          to="/timeline"
          style={({ isActive }) => ({
            ...linkStyle,
            background: isActive ? "var(--surface)" : "transparent",
            borderColor: isActive ? "var(--border)" : "transparent",
          })}
        >
          Timeline
        </NavLink>

        <div style={{ height: 10 }} />

        <NavLink
          to="/profile"
          style={({ isActive }) => ({
            ...linkStyle,
            background: isActive ? "var(--surface)" : "transparent",
            borderColor: isActive ? "var(--border)" : "transparent",
          })}
        >
          Perfil
        </NavLink>

        <NavLink
          to="/settings"
          style={({ isActive }) => ({
            ...linkStyle,
            background: isActive ? "var(--surface)" : "transparent",
            borderColor: isActive ? "var(--border)" : "transparent",
          })}
        >
          Configurações
        </NavLink>
      </nav>
    </aside>
  );
}
