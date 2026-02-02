// C:\HDUD_DATA\hdud-web-app\src\App.tsx

import { useEffect, useMemo, useState, type ReactNode } from "react";
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

import { setUnauthorizedHandler, getAccessToken, clearHdudSession } from "./lib/api";

// =======================
// Theme
// =======================
const THEME_KEY = "hdud_theme";
type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

// =======================
// Auth gate
// =======================
function RequireAuth({ isAuthed, children }: { isAuthed: boolean; children: ReactNode }) {
  if (!isAuthed) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>("light");

  // =======================
  // Bootstrap
  // =======================
  useEffect(() => {
    // Fonte de verdade = storage
    const t = getAccessToken();
    setToken(t);

    const savedTheme = (localStorage.getItem(THEME_KEY) as Theme | null) ?? "light";
    setTheme(savedTheme);
    applyTheme(savedTheme);
  }, []);

  // =======================
  // Handler global 401/403
  // =======================
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearHdudSession();
      setToken(null);
      // ✅ UX consistente: sempre /login
      window.location.replace("/login");
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  // =======================
  // Login / Logout
  // =======================
  function handleLoggedIn(accessToken: string) {
    // Login.tsx já grava storage; aqui só espelha
    setToken(accessToken);
  }

  function handleLogout() {
    clearHdudSession();
    setToken(null);
    window.location.replace("/login");
  }

  // =======================
  // Theme change
  // =======================
  function handleThemeChange(next: Theme) {
    setTheme(next);
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  }

  // ✅ se token sumir do storage por qualquer motivo, mata state também (anti “token fantasma”)
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      // qualquer mexida nas chaves de token recalcula
      if (
        e.key === "HDUD_TOKEN" ||
        e.key === "hdud_access_token" ||
        e.key === "access_token" ||
        e.key === "token" ||
        e.key === null
      ) {
        setToken(getAccessToken());
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const isLoggedIn = useMemo(() => Boolean(token), [token]);

  return (
    <Routes>
      {/* Login */}
      <Route
        path="/login"
        element={
          isLoggedIn ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <Login
              onLoggedIn={(accessToken) => {
                handleLoggedIn(accessToken);
              }}
            />
          )
        }
      />

      {/* Área protegida */}
      <Route
        element={
          <RequireAuth isAuthed={isLoggedIn}>
            <AppShell onLogout={handleLogout} />
          </RequireAuth>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/feed" element={<FeedPage />} />
        <Route path="/chapters" element={<ChaptersPage />} />
        <Route path="/timeline" element={<TimelinePage />} />
        <Route path="/profile" element={<ProfilePage />} />

        <Route path="/settings" element={<SettingsPage theme={theme} onThemeChange={handleThemeChange} />} />

        {/* Mantém compat com props token (por enquanto) */}
        <Route path="/memories" element={<MemoriesPage token={token} onLogout={handleLogout} />} />
        <Route path="/memories/:id" element={<MemoryDetailPage token={token} />} />

        {/* Landing */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
