// C:\HDUD_DATA\hdud-web-app\src\App.tsx

import { useEffect, useMemo, useRef, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Login from "./auth/Login";
import MemoriesPage from "./memories/MemoriesPage";
import MemoryDetailPage from "./memories/MemoryDetailPage";

import AppShell from "./layouts/AppShell";

import DashboardPage from "./pages/DashboardPage";
import FeedPage from "./pages/FeedPage";
import ChaptersPage from "./pages/ChaptersPage";
import TimelinePage from "./pages/TimelinePage";
import ProfilePage from "./pages/ProfilePage";
import SettingsPage from "./pages/SettingsPage";

import { setUnauthorizedHandler, apiRequest } from "./lib/api";

// =======================
// Theme
// =======================
const THEME_KEY = "hdud_theme";
type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

// =======================
// Token helpers
// =======================
function getTokenFromStorage(): string | null {
  return (
    localStorage.getItem("hdud_access_token") ||
    localStorage.getItem("HDUD_TOKEN") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("token")
  );
}

function setTokenToStorage(accessToken: string) {
  const t = String(accessToken || "");
  if (!t) return;

  localStorage.setItem("hdud_access_token", t);
  localStorage.setItem("HDUD_TOKEN", t);
  localStorage.setItem("access_token", t);
  localStorage.setItem("token", t);
}

function clearHdudSession() {
  const keys = [
    "hdud_access_token",
    "HDUD_TOKEN",
    "access_token",
    "token",
    "refresh_token",
    "author_id",
    "HDUD_AUTHOR_ID",
    "user_id",
    "email",
  ];
  for (const k of keys) localStorage.removeItem(k);
}

// =======================
// JWT utils
// =======================
type JwtPayload = {
  exp?: number; // seconds
};

function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getTokenExpMs(token: string): number | null {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return null;
  return payload.exp * 1000;
}

// Agenda refresh antes do expirar.
// safetySeconds: margem (ex.: 90s).
function computeRefreshDelayMs(token: string, safetySeconds = 90): number | null {
  const expMs = getTokenExpMs(token);
  if (!expMs) return null;

  const nowMs = Date.now();
  const targetMs = expMs - safetySeconds * 1000;

  const delay = targetMs - nowMs;
  return Math.max(0, delay);
}

// =======================
// Debug Auth (DEV-only)
// =======================
const DEBUG_AUTH = (import.meta as any).env?.VITE_DEBUG_AUTH === "1";

function emitAuthRefreshed() {
  if (!DEBUG_AUTH) return;
  try {
    window.dispatchEvent(new Event("hdud:auth-refreshed"));
  } catch {
    // ignore
  }
}

function emitAuthFail() {
  if (!DEBUG_AUTH) return;
  try {
    window.dispatchEvent(new Event("hdud:auth-fail"));
  } catch {
    // ignore
  }
}

function debugLog(...args: any[]) {
  if (!DEBUG_AUTH) return;
  // eslint-disable-next-line no-console
  console.debug("[HDUD][auth]", ...args);
}

// =======================
// “LinkedIn-like”: refresh on activity
// =======================
// Se o token estiver para expirar em <= 5 min, permitimos refresh ao voltar foco/atividade.
const REFRESH_IF_EXP_WITHIN_MS = 5 * 60 * 1000;
// Evita spam de refresh (mínimo 60s entre tentativas por atividade)
const ACTIVITY_REFRESH_THROTTLE_MS = 60 * 1000;
// Considera “idle” se sem atividade por 2 min (só para gatilho quando volta)
const IDLE_AFTER_MS = 2 * 60 * 1000;

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>("light");

  // Timer do refresh preventivo (exp - 90s)
  const refreshTimerRef = useRef<number | null>(null);

  // Controle de activity refresh (throttle + idle)
  const lastActivityAtRef = useRef<number>(Date.now());
  const lastActivityRefreshAtRef = useRef<number>(0);

  // =======================
  // Bootstrap
  // =======================
  useEffect(() => {
    const t = getTokenFromStorage();
    if (t) {
      setTokenToStorage(t);
      setToken(t);
    }

    const savedTheme =
      (localStorage.getItem(THEME_KEY) as Theme | null) ?? "light";
    setTheme(savedTheme);
    applyTheme(savedTheme);
  }, []);

  // =======================
  // Login / Logout
  // =======================
  function handleLoggedIn(accessToken: string) {
    setTokenToStorage(accessToken);
    setToken(accessToken);
  }

  function handleLogout() {
    clearHdudSession();
    window.location.href = "/";
  }

  // =======================
  // Handler global 401
  // =======================
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearHdudSession();
      window.location.href = "/";
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  // =======================
  // Theme change
  // =======================
  function handleThemeChange(next: Theme) {
    setTheme(next);
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  }

  // =======================
  // Função central de refresh (reutilizada)
  // =======================
  async function doRefresh(reason: string) {
    try {
      debugLog("refresh start:", reason);

      await apiRequest("/auth/refresh", {
        method: "POST",
        skipAuthRetry: true, // evita recursão
      });

      emitAuthRefreshed();
      debugLog("refresh ok:", reason);

      const newToken = getTokenFromStorage();
      if (newToken) setToken(newToken);
    } catch {
      emitAuthFail();
      debugLog("refresh fail:", reason);
      // Se falhar, o handler global de 401 cuida do logout (via requests seguintes)
    }
  }

  function shouldRefreshSoon(currentToken: string): boolean {
    const expMs = getTokenExpMs(currentToken);
    if (!expMs) return false;
    const remaining = expMs - Date.now();
    return remaining <= REFRESH_IF_EXP_WITHIN_MS;
  }

  // =======================
  // Auto-refresh preventivo (exp - 90s)
  // =======================
  useEffect(() => {
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    if (!token) return;

    const delayMs = computeRefreshDelayMs(token, 90);
    if (delayMs === null) return;

    debugLog("scheduled refresh in(ms):", delayMs);

    refreshTimerRef.current = window.setTimeout(() => {
      void doRefresh("timer(exp-90s)");
    }, delayMs);

    return () => {
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // =======================
  // Refresh on activity (LinkedIn-like)
  // =======================
  useEffect(() => {
    if (!token) return;

    function markActivity() {
      lastActivityAtRef.current = Date.now();
    }

    async function maybeRefreshOnReturn(reason: string) {
      if (!token) return;

      // throttle
      const now = Date.now();
      if (now - lastActivityRefreshAtRef.current < ACTIVITY_REFRESH_THROTTLE_MS) {
        return;
      }

      // só se estiver perto de expirar
      if (!shouldRefreshSoon(token)) return;

      lastActivityRefreshAtRef.current = now;
      await doRefresh(reason);
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        const now = Date.now();
        const idleFor = now - lastActivityAtRef.current;

        // Se voltou depois de idle, tenta refresh (se estiver perto do exp)
        if (idleFor >= IDLE_AFTER_MS) {
          void maybeRefreshOnReturn("return-from-idle(visibility)");
        } else {
          // Mesmo sem idle, ao voltar foco pode ser útil
          void maybeRefreshOnReturn("focus(visibility)");
        }
      }
    }

    function onFocus() {
      const now = Date.now();
      const idleFor = now - lastActivityAtRef.current;
      if (idleFor >= IDLE_AFTER_MS) {
        void maybeRefreshOnReturn("return-from-idle(focus)");
      } else {
        void maybeRefreshOnReturn("focus(window)");
      }
    }

    // Activity signals
    const activityEvents: Array<keyof WindowEventMap> = [
      "mousemove",
      "keydown",
      "scroll",
      "click",
      "touchstart",
    ];

    for (const ev of activityEvents) {
      window.addEventListener(ev, markActivity, { passive: true } as any);
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);

    return () => {
      for (const ev of activityEvents) {
        window.removeEventListener(ev, markActivity as any);
      }
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const isLoggedIn = useMemo(() => Boolean(token), [token]);

  if (!isLoggedIn || !token) {
    return <Login onLoggedIn={handleLoggedIn} />;
  }

  return (
    <Routes>
      <Route element={<AppShell onLogout={handleLogout} />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/feed" element={<FeedPage />} />
        <Route path="/chapters" element={<ChaptersPage />} />
        <Route path="/timeline" element={<TimelinePage />} />
        <Route path="/profile" element={<ProfilePage />} />

        <Route
          path="/settings"
          element={<SettingsPage theme={theme} onThemeChange={handleThemeChange} />}
        />

        <Route
          path="/memories"
          element={<MemoriesPage token={token} onLogout={handleLogout} />}
        />
        <Route path="/memories/:id" element={<MemoryDetailPage token={token} />} />

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
