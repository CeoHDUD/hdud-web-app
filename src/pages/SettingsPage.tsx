// C:\HDUD_DATA\hdud-web-app\src\pages\SettingsPage.tsx

import React from "react";

type Theme = "light" | "dark";

type Props = {
  theme: Theme;
  onThemeChange: (next: Theme) => void;
};

export default function SettingsPage({ theme, onThemeChange }: Props) {
  const isDark = theme === "dark";

  return (
    <div className="hdud-page">
      <div className="hdud-card">
        <h1 className="hdud-title">Configurações</h1>

        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16 }}>Tema</h2>
            <p className="hdud-subtitle" style={{ marginTop: 6 }}>
              Padrão: Light / Creme. Opcional: Dark. Sua escolha fica salva neste dispositivo.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              justifyContent: "space-between",
              padding: 12,
              borderRadius: 12,
              border: "1px solid var(--hdud-border)",
              background: "var(--hdud-surface-2)",
            }}
          >
            <div style={{ display: "grid", gap: 4 }}>
              <strong style={{ fontSize: 14 }}>Modo escuro</strong>
              <span style={{ fontSize: 13, opacity: 0.85 }}>
                {isDark ? "Ativado" : "Desativado"}
              </span>
            </div>

            <button
              type="button"
              className="hdud-btn"
              onClick={() => onThemeChange(isDark ? "light" : "dark")}
              aria-label="Alternar tema"
            >
              {isDark ? "Usar Light" : "Usar Dark"}
            </button>
          </div>

          <div className="hdud-card" style={{ padding: 12 }}>
            <p className="hdud-subtitle" style={{ margin: 0 }}>
              Em breve: ajustes de perfil, preferências, notificações e privacidade.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
