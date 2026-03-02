// C:\HDUD_DATA\hdud-web-app\src\pages\SettingsPage.tsx

import React, { useMemo } from "react";
import { useHdudTheme, type HdudPalette } from "../theme/ThemeProvider";

type LegacyTheme = "light" | "dark";

/**
 * SettingsPage — Identity Palettes v1
 *
 * ✅ Selector de paletas (5) — FONTE DE VERDADE = HdudThemeProvider (palette)
 * ✅ Persistência e troca instantânea via HdudThemeProvider
 *
 * Compat: mantém props legadas (theme/onThemeChange) para não quebrar
 * enquanto o App.tsx ainda estiver no modelo antigo.
 *
 * ⚠️ Regra Move 2:
 * - Legacy NÃO pode sobrepor a paleta (senão "light" força jardim-vivo pra sempre).
 * - Legacy serve só como "atalho" (dark <-> noturno) e compat.
 */
type Props = {
  theme?: LegacyTheme; // legado (opcional)
  onThemeChange?: (next: LegacyTheme) => void; // legado (opcional)
};

function paletteToLegacyTheme(p: HdudPalette): LegacyTheme {
  return p === "noturno" ? "dark" : "light";
}

export default function SettingsPage({ theme, onThemeChange }: Props) {
  const { palette, setPalette, palettes } = useHdudTheme();

  // ✅ Fonte de verdade é a paleta do provider.
  // Legacy theme NÃO sobrepõe.
  const effectivePalette = palette;

  // Legacy “estado” exibido (apenas informativo/compat)
  const effectiveLegacyTheme: LegacyTheme = useMemo(() => {
    // se App manda theme, mostramos esse “sinal”
    if (theme === "dark" || theme === "light") return theme;
    // senão, derivamos da paleta real
    return paletteToLegacyTheme(effectivePalette);
  }, [theme, effectivePalette]);

  const handlePaletteChange = (next: HdudPalette) => {
    setPalette(next);

    // compat: se o App ainda depende de light/dark, mantemos coerente,
    // mas SEM nunca reverter paleta para jardim-vivo por causa de "light".
    if (onThemeChange) {
      onThemeChange(paletteToLegacyTheme(next));
    }
  };

  // Atalho legacy: "modo escuro" vira NOTURNO, "modo claro" volta para JARDIM VIVO.
  // (Simples e previsível, sem destruir as outras paletas.)
  const handleLegacyToggle = () => {
    const nextLegacy: LegacyTheme = effectiveLegacyTheme === "dark" ? "light" : "dark";
    const nextPalette: HdudPalette = nextLegacy === "dark" ? "noturno" : "jardim-vivo";
    handlePaletteChange(nextPalette);
  };

  return (
    <div className="hdud-page">
      <div className="hdud-card">
        <h1 className="hdud-title">Configurações</h1>

        <div style={{ marginTop: 12, display: "grid", gap: 14 }}>
          {/* =========================
              Identidade Visual (Paletas)
             ========================= */}
          <div>
            <h2 style={{ margin: 0, fontSize: 16 }}>Identidade Visual</h2>
            <p className="hdud-subtitle" style={{ marginTop: 6 }}>
              Escolha a paleta conceitual do HDUD. A troca é instantânea e fica salva neste dispositivo.
            </p>
          </div>

          <div
            className="hdud-card"
            style={{
              padding: 12,
              display: "grid",
              gap: 10,
              borderRadius: 14,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: 12,
                borderRadius: 12,
                border: "1px solid var(--hdud-border)",
                background: "var(--hdud-surface-2)",
              }}
            >
              <div style={{ display: "grid", gap: 4 }}>
                <strong style={{ fontSize: 14 }}>Paleta ativa</strong>
                <span style={{ fontSize: 13, opacity: 0.85 }}>
                  {palettes.find((p) => p.id === effectivePalette)?.label || effectivePalette}
                </span>
              </div>

              {/* Preview pequeno usando tokens (zero hardcoded) */}
              <div aria-hidden="true" title="Preview" style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 999,
                    background: "var(--hdud-bg)",
                    border: "1px solid var(--hdud-border)",
                  }}
                />
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 999,
                    background: "var(--hdud-surface-2)",
                    border: "1px solid var(--hdud-border)",
                  }}
                />
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 999,
                    background: "var(--hdud-primary-bg)",
                    border: "1px solid var(--hdud-border)",
                  }}
                />
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 999,
                    background: "var(--hdud-accent-bg)",
                    border: "1px solid var(--hdud-accent-border)",
                  }}
                />
              </div>
            </div>

            {/* Lista de paletas */}
            <div style={{ display: "grid", gap: 10 }}>
              {palettes.map((p) => {
                const active = p.id === effectivePalette;

                return (
                  <button
                    key={p.id}
                    type="button"
                    className="hdud-btn"
                    onClick={() => handlePaletteChange(p.id)}
                    aria-pressed={active}
                    style={{
                      textAlign: "left",
                      display: "grid",
                      gap: 4,
                      padding: 12,
                      borderRadius: 12,
                      border: active ? "1px solid var(--hdud-accent-border)" : "1px solid var(--hdud-border)",
                      background: active ? "var(--hdud-accent-bg)" : "var(--hdud-surface-2)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <strong style={{ fontSize: 14 }}>{p.label}</strong>
                      {active ? (
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 850,
                            padding: "4px 8px",
                            borderRadius: 999,
                            border: "1px solid var(--hdud-accent-border)",
                            background: "var(--hdud-surface)",
                          }}
                        >
                          Ativa
                        </span>
                      ) : null}
                    </div>
                    <span style={{ fontSize: 13, opacity: 0.86 }}>{p.description}</span>
                  </button>
                );
              })}
            </div>

            {/* Compat: toggle simples (light/dark) */}
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
                <strong style={{ fontSize: 14 }}>Atalho: Modo escuro</strong>
                <span style={{ fontSize: 13, opacity: 0.85 }}>
                  {paletteToLegacyTheme(effectivePalette) === "dark" ? "Ativado (Noturno)" : "Desativado"}
                  {theme ? <span style={{ opacity: 0.75 }}> — compat App: {effectiveLegacyTheme}</span> : null}
                </span>
              </div>

              <button type="button" className="hdud-btn" onClick={handleLegacyToggle} aria-label="Alternar modo escuro">
                {paletteToLegacyTheme(effectivePalette) === "dark" ? "Usar Light" : "Usar Dark"}
              </button>
            </div>
          </div>

          {/* =========================
              Placeholder roadmap
             ========================= */}
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