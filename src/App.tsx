import { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Login from "./auth/Login";
import MemoriesPage from "./memories/MemoriesPage";
import MemoryDetailPage from "./memories/MemoryDetailPage";

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
  localStorage.removeItem("hdud_access_token");
  window.location.href = "/";
}

  if (!token) {
    return <Login onLoggedIn={handleLoggedIn} />;
  }

  return (
    <Routes>
      <Route
        path="/memories"
        element={<MemoriesPage token={token} onLogout={handleLogout} />}
      />
      <Route path="/memories/:id" element={<MemoryDetailPage token={token} />} />

      <Route path="/" element={<Navigate to="/memories" replace />} />
      <Route path="*" element={<Navigate to="/memories" replace />} />
    </Routes>
  );
}
