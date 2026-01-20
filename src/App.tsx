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

const TOKEN_KEY = "hdud_access_token";

export default function App() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const t = localStorage.getItem(TOKEN_KEY);
    if (t) setToken(t);
  }, []);

  function handleLoggedIn(accessToken: string) {
    localStorage.setItem(TOKEN_KEY, accessToken);
    setToken(accessToken);
  }

  function handleLogout() {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = "/";
  }

  const isLoggedIn = useMemo(() => Boolean(token), [token]);

  if (!isLoggedIn || !token) {
    return <Login onLoggedIn={handleLoggedIn} />;
  }

  return (
    <Routes>
      {/* AppShell (somente estado logado) */}
      <Route element={<AppShell onLogout={handleLogout} />}>
        {/* Landing oficial */}
        <Route path="/dashboard" element={<DashboardPage />} />

        {/* placeholders (sem tocar no core) */}
        <Route path="/feed" element={<FeedPage />} />
        <Route path="/chapters" element={<ChaptersPage />} />
        <Route path="/timeline" element={<TimelinePage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/settings" element={<SettingsPage />} />

        {/* Core preservado */}
        <Route
          path="/memories"
          element={<MemoriesPage token={token} onLogout={handleLogout} />}
        />
        <Route path="/memories/:id" element={<MemoryDetailPage token={token} />} />

        {/* Defaults: tudo cai no dashboard */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
