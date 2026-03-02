// C:\HDUD_DATA\hdud-web-app\src\theme\ThemeProvider.tsx
import React, { createContext, useContext, useMemo, useState } from "react";

export type HdudPalette = "editorial" | "noturno" | "jardim-vivo" | "aurora" | "terra";

/**
 * Move 1 — Fundação
 * - Um único ponto de verdade para aplicar paleta:
 *   document.documentElement.setAttribute("data-hdud-palette", value)
 * - Persistência:
 *   localStorage.setItem("HDUD_PALETTE", value)
 *
 * Compat:
 * - data-theme continua sendo escrito (light/dark) só para UA (forms/scrollbars)
 * - mas NO CSS ele é fallback: não tem prioridade quando data-hdud-palette existir.
 */
const STORAGE_KEY = "HDUD_PALETTE";

// compat (legado)
const LEGACY_THEME_KEY = "hdud_theme"; // "light" | "dark" (antigo do App.tsx)

type ThemeCtx = {
  palette: HdudPalette;
  setPalette: (p: HdudPalette) => void;
  palettes: { id: HdudPalette; label: string; description: string }[];
};

const ThemeContext = createContext<ThemeCtx | null>(null);

function isValidPalette(p: any): p is HdudPalette {
  return p === "editorial" || p === "noturno" || p === "jardim-vivo" || p === "aurora" || p === "terra";
}

/**
 * ✅ Setter central único (exportável)
 * Um único ponto que faz:
 * - setAttribute("data-hdud-palette", value)
 * - localStorage.setItem("HDUD_PALETTE", value)
 */
export function setHdudPalette(value: HdudPalette, opts?: { persist?: boolean }) {
  const persist = opts?.persist !== false;

  try {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-hdud-palette", value);

      // UA hint (não é fonte de verdade do CSS)
      const isDark = value === "noturno";
      document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
    }
  } catch {
    // ignore
  }

  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
      // compat: mantém a chave antiga coerente
      localStorage.setItem(LEGACY_THEME_KEY, value === "noturno" ? "dark" : "light");
    } catch {
      // ignore
    }
  }
}

function normalizeInitialPalette(): HdudPalette {
  // 1) Novo formato (fonte de verdade)
  const p = (localStorage.getItem(STORAGE_KEY) || "").trim();
  if (isValidPalette(p)) return p;

  // 2) Compat legado “light/dark”
  const legacy = (localStorage.getItem(LEGACY_THEME_KEY) || "").trim().toLowerCase();
  if (legacy === "dark") return "noturno";
  if (legacy === "light") return "jardim-vivo";

  // 3) Default estratégico
  return "jardim-vivo";
}

export function HdudThemeProvider({ children }: { children: React.ReactNode }) {
  /**
   * ✅ Boot: aplicar ANTES do paint (o máximo possível sem mexer no core)
   * - O initializer roda no primeiro render do provider.
   * - Aplicamos setHdudPalette(..., persist:false) aqui para evitar flicker.
   */
  const [palette, setPaletteState] = useState<HdudPalette>(() => {
    const initial = normalizeInitialPalette();
    setHdudPalette(initial, { persist: false });
    return initial;
  });

  const palettes = useMemo(
    () => [
      {
        id: "jardim-vivo" as const,
        label: "Jardim Vivo",
        description: "Humano, orgânico, calor inteligente (default do HDUD).",
      },
      {
        id: "editorial" as const,
        label: "Editorial",
        description: "Livro, legado, leitura longa premium.",
      },
      {
        id: "noturno" as const,
        label: "Noturno",
        description: "Profundo, intelectual, tech premium.",
      },
      {
        id: "aurora" as const,
        label: "Aurora",
        description: "Criativo, sensível, narrativo (emocional).",
      },
      {
        id: "terra" as const,
        label: "Terra",
        description: "Raiz, cultura, ancestralidade (autoral e global).",
      },
    ],
    []
  );

  const setPalette = (p: HdudPalette) => {
    setPaletteState(p);
    setHdudPalette(p, { persist: true });
  };

  const value = useMemo<ThemeCtx>(() => ({ palette, setPalette, palettes }), [palette, palettes]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useHdudTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useHdudTheme must be used within HdudThemeProvider");
  return ctx;
}