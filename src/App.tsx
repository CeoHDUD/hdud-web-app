// C:\HDUD_DATA\hdud-web-app\src\App.tsx

import { useEffect, useMemo, useState } from "react";
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

import { setUnauthorizedHandler } from "./lib/api";

// ✅ Theme vNext (global, seguro, reversível, sem tocar no core)
const THEME_KEY = "hdud_theme";
type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

// ✅ Fonte única do token (compatível com todas as chaves já usadas no projeto)
function getTokenFromStorage(): string | null {
  return (
    localStorage.getItem("hdud_access_token") ||
    localStorage.getItem("HDUD_TOKEN") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("token")
  );
}

// ✅ Garante consistência (se existir UMA, existirá a principal)
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

export default function App() {
  const [token, setToken] = useState<string | null>(null);

  // ✅ Theme state (default: light/creme)
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    // 🔐 Bootstrap do token (compatível)
    const t = getTokenFromStorage();
    if (t) {
      // re-hidrata chave principal para evitar “bug fantasma”
      setTokenToStorage(t);
      setToken(t);
    }

    // Theme: carrega persistido; default = light
    const savedTheme = (localStorage.getItem(THEME_KEY) as Theme | null) ?? "light";
    setTheme(savedTheme);
    applyTheme(savedTheme);
  }, []);

  function handleLoggedIn(accessToken: string) {
    // ✅ garante armazenamento consistente mesmo se Login mudar no futuro
    setTokenToStorage(accessToken);
    setToken(accessToken);
  }

  function handleLogout() {
    clearHdudSession();
    window.location.href = "/";
  }

  // ✅ registra handler global (401/jwt expired) -> logout
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearHdudSession();
      window.location.href = "/";
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  // ✅ API local para SettingsPage
  function handleThemeChange(next: Theme) {
    setTheme(next);
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  }

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
