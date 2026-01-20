// C:\HDUD_DATA\hdud-web-app\src\components\Topbar.tsx

import React from "react";
import { useLocation, useNavigate } from "react-router-dom";

type Props = {
  onLogout: () => void;
};

function titleFromPath(pathname: string) {
  if (pathname.startsWith("/dashboard")) return "Início";
  if (pathname.startsWith("/feed")) return "Feed";
  if (pathname.startsWith("/chapters")) return "Capítulos";
  if (pathname.startsWith("/memories")) return "Memórias";
  if (pathname.startsWith("/timeline")) return "Timeline";
  if (pathname.startsWith("/profile")) return "Perfil";
  if (pathname.startsWith("/settings")) return "Configurações";
  return "HDUD";
}

export default function Topbar({ onLogout }: Props) {
  const location = useLocation();
  const navigate = useNavigate();

  const title = titleFromPath(location.pathname);

  return (
    <header
      style={{
        height: "var(--topbar-h)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        borderBottom: "1px solid var(--border)",
        background: "var(--surface)",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ fontWeight: 700 }}>{title}</div>
        <div style={{ color: "var(--muted)", fontSize: 12 }}>
          AppShell mínimo (vNext)
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          type="button"
          onClick={() => navigate("/memories")}
          style={{
            border: "1px solid var(--border)",
            background: "var(--surface)",
            padding: "8px 10px",
            borderRadius: 12,
            cursor: "pointer",
          }}
        >
          Ir p/ Memórias
        </button>

        <button
          type="button"
          onClick={onLogout}
          style={{
            border: "1px solid var(--border)",
            background: "var(--primary)",
            color: "var(--primary-contrast)",
            padding: "8px 10px",
            borderRadius: 12,
            cursor: "pointer",
          }}
        >
          Sair
        </button>
      </div>
    </header>
  );
}
