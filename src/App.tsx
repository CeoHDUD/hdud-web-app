// C:\HDUD_DATA\hdud-web-app\src\App.tsx

import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

// 🔐 Auth
import Login from "./auth/Login";

// 📚 Core (não tocado)
import MemoriesPage from "./memories/MemoriesPage";
import MemoryDetailPage from "./memories/MemoryDetailPage";

// 🧭 Páginas de plataforma
import HomePage from "./pages/HomePage";
import TimelinePage from "./pages/TimelinePage";
import ProfilePage from "./pages/ProfilePage";

// 🧱 Layout
import AppShell from "./app/AppShell";

// 🎨 Tema
import { ThemeProvider } from "./theme/ThemeProvider";

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
    setToken(null);
  }

  // 🔒 Gate de autenticação (mantido)
  if (!token) {
    return <Login onLoggedIn={handleLoggedIn} />;
  }

  return (
    // 🎨 Tema GLOBAL
    <ThemeProvider>
      <Routes>
        {/* App com “cara de plataforma”: tudo dentro do AppShell */}
        <Route element={<AppShell onLogout={handleLogout} />}>
          {/* Dashboard */}
          <Route path="/" element={<HomePage token={token} />} />

          {/* Memórias (core preservado) */}
          <Route
            path="/memories"
            element={<MemoriesPage token={token} onLogout={handleLogout} />}
          />
          <Route
            path="/memories/new"
            element={<MemoryDetailPage token={token} />}
          />
          <Route
            path="/memories/:id"
            element={<MemoryDetailPage token={token} />}
          />

          {/* Timeline */}
          <Route path="/timeline" element={<TimelinePage token={token} />} />

          {/* Perfil / Configurações */}
          <Route path="/profile" element={<ProfilePage token={token} />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ThemeProvider>
  );
}
