// C:\HDUD_DATA\hdud-web-app\src\layouts\AppShell.tsx

import { Outlet, NavLink, useLocation } from "react-router-dom";

type Props = {
  onLogout: () => void;
};

export default function AppShell({ onLogout }: Props) {
  const location = useLocation();

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Sidebar */}
      <aside
        style={{
          width: 260,
          background: "var(--hdud-surface)",
          borderRight: "1px solid var(--hdud-border)",
          padding: 16,
        }}
      >
        <div style={{ fontWeight: 900, marginBottom: 16 }}>HDUD</div>

        <nav style={{ display: "grid", gap: 6 }}>
          {[
            ["/dashboard", "Início"],
            ["/feed", "Feed"],
            ["/chapters", "Capítulos"],
            ["/memories", "Memórias"],
            ["/timeline", "Timeline"],
            ["/profile", "Perfil"],
            ["/settings", "Configurações"],
          ].map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              style={({ isActive }) => ({
                padding: "10px 12px",
                borderRadius: 10,
                fontWeight: 700,
                color: "var(--hdud-text)",
                background: isActive ? "var(--hdud-accent-bg)" : "transparent",
                border: isActive
                  ? "1px solid var(--hdud-accent-border)"
                  : "1px solid transparent",
              })}
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Topbar */}
        <header
          style={{
            height: 56,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 16px",
            borderBottom: "1px solid var(--hdud-border)",
            background: "var(--hdud-surface)",
          }}
        >
          <div style={{ fontWeight: 800 }}>
            {location.pathname.startsWith("/memories") ? "Memórias" : "HDUD"}{" "}
            <span style={{ fontWeight: 500, opacity: 0.7 }}>
              AppShell mínimo (vNext)
            </span>
          </div>

          <div>
            <button
              onClick={onLogout}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid var(--hdud-border)",
                background: "var(--hdud-surface)",
                color: "var(--hdud-text)",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Sair
            </button>
          </div>
        </header>

        {/* Content */}
        <main style={{ flex: 1 }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
