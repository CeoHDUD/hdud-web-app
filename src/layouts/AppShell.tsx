// C:\HDUD_DATA\hdud-web-app\src\layouts\AppShell.tsx

import { Outlet, NavLink, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";

type Props = {
  onLogout: () => void;
};

// Flag DEV-only (não existe em prod se não definida)
const DEBUG_AUTH =
  (import.meta as any).env?.VITE_DEBUG_AUTH === "1";

type AuthDebugStatus = "ok" | "refreshed" | "fail";

export default function AppShell({ onLogout }: Props) {
  const location = useLocation();

  // Estado DEV-only para observabilidade visual
  const [authStatus, setAuthStatus] = useState<AuthDebugStatus>("ok");

  useEffect(() => {
    if (!DEBUG_AUTH) return;

    // Escuta eventos simples disparados pelo App (custom events)
    function onAuthRefreshed() {
      setAuthStatus("refreshed");
      setTimeout(() => setAuthStatus("ok"), 2000);
    }

    function onAuthFail() {
      setAuthStatus("fail");
    }

    window.addEventListener("hdud:auth-refreshed", onAuthRefreshed);
    window.addEventListener("hdud:auth-fail", onAuthFail);

    return () => {
      window.removeEventListener("hdud:auth-refreshed", onAuthRefreshed);
      window.removeEventListener("hdud:auth-fail", onAuthFail);
    };
  }, []);

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "var(--hdud-bg)",
        color: "var(--hdud-text)",
      }}
    >
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
          <div style={{ fontWeight: 800, display: "flex", gap: 12 }}>
            <span>
              {location.pathname.startsWith("/memories") ? "Memórias" : "HDUD"}{" "}
              <span style={{ fontWeight: 500, opacity: 0.7 }}>
                AppShell mínimo (vNext)
              </span>
            </span>

            {/* Badge DEV-only */}
            {DEBUG_AUTH && (
              <span
                style={{
                  padding: "4px 8px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 800,
                  alignSelf: "center",
                  background:
                    authStatus === "ok"
                      ? "#1f7a1f"
                      : authStatus === "refreshed"
                      ? "#1f4fd8"
                      : "#b91c1c",
                  color: "#fff",
                }}
              >
                Auth: {authStatus}
              </span>
            )}
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
        <main style={{ flex: 1, background: "var(--hdud-bg)" }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
