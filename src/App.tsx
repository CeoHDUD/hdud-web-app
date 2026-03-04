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

import {
  setUnauthorizedHandler,
  tryRefreshNow,
  setSessionExpiredNotice,
} from "./lib/api";

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

    // ✅ refresh keys (novas + compat)
    "refresh_token",
    "hdud_refresh_token",

    // user-ish
    "author_id",
    "HDUD_AUTHOR_ID",
    "user_id",
    "email",
  ];
  for (const k of keys) localStorage.removeItem(k);
}

// =======================
// After-login helpers
// =======================
function setAfterLoginPath(path: string, reason?: string) {
  try {
    const p = String(path || "").trim();
    if (p) sessionStorage.setItem("hdud_after_login_path", p);
    if (reason) sessionStorage.setItem("hdud_login_reason", reason);
  } catch {
    // ignore
  }
}

function consumeAfterLoginPath(): string | null {
  try {
    const p = sessionStorage.getItem("hdud_after_login_path");
    if (p) sessionStorage.removeItem("hdud_after_login_path");
    sessionStorage.removeItem("hdud_login_reason");
    return p || null;
  } catch {
    return null;
  }
}

function redirectToLogin(reason?: string) {
  try {
    setAfterLoginPath(
      window.location.pathname + window.location.search + window.location.hash,
      reason
    );
  } catch {
    // ignore
  }

  try {
    window.location.assign("/login");
  } catch {
    window.location.href = "/login";
  }
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

// =======================
// Dirty Guard (app-level)
// =======================
type DirtyState = {
  dirty: boolean;
  message?: string;
  source?: string;
};

export default function App() {
  const [token, setToken] = useState<string | null>(null);

  // Timer do refresh preventivo (exp - 90s)
  const refreshTimerRef = useRef<number | null>(null);

  // Controle de activity refresh (throttle + idle)
  const lastActivityAtRef = useRef<number>(Date.now());
  const lastActivityRefreshAtRef = useRef<number>(0);

  // Dirty state global (recebido por event)
  const dirtyRef = useRef<DirtyState>({
    dirty: false,
    message: "Você tem alterações não salvas. Deseja sair sem salvar?",
    source: "",
  });

  function isDirtyNow() {
    return !!dirtyRef.current?.dirty;
  }

  function confirmLeave(custom?: string) {
    const msg =
      custom ||
      dirtyRef.current?.message ||
      "Você tem alterações não salvas. Deseja sair sem salvar?";
    return window.confirm(msg);
  }

  // Escuta eventos hdud:dirty (emitido por páginas)
  useEffect(() => {
    function onDirty(e: Event) {
      const ce = e as CustomEvent<DirtyState>;
      const d = ce?.detail;
      dirtyRef.current = {
        dirty: !!d?.dirty,
        message: d?.message || dirtyRef.current.message,
        source: d?.source || dirtyRef.current.source,
      };
    }

    window.addEventListener("hdud:dirty", onDirty as any);
    return () => window.removeEventListener("hdud:dirty", onDirty as any);
  }, []);

  // Guard de back/forward (popstate)
  useEffect(() => {
    function onPopState() {
      if (!isDirtyNow()) return;

      const ok = confirmLeave(
        "Você tem alterações não salvas. Deseja voltar/avançar e perder essas alterações?"
      );

      if (!ok) {
        try {
          history.pushState(null, "", window.location.href);
        } catch {
          // ignore
        }
      }
    }

    try {
      history.pushState(null, "", window.location.href);
    } catch {
      // ignore
    }

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Guard de hashchange (se futuramente usar âncoras)
  useEffect(() => {
    function onHashChange(e: HashChangeEvent) {
      if (!isDirtyNow()) return;

      const ok = confirmLeave(
        "Você tem alterações não salvas. Deseja continuar e perder essas alterações?"
      );

      if (!ok) {
        e.preventDefault?.();
        try {
          window.location.hash = new URL(e.oldURL).hash;
        } catch {
          // ignore
        }
      }
    }

    window.addEventListener("hashchange", onHashChange as any);
    return () => window.removeEventListener("hashchange", onHashChange as any);
  }, []);

  // =======================
  // Bootstrap
  // =======================
  useEffect(() => {
    const t = getTokenFromStorage();
    if (t) {
      setTokenToStorage(t);
      setToken(t);
    }

    // ✅ Tema/Paleta agora é responsabilidade do HdudThemeProvider.
    // Nada de data-theme/localStorage aqui para evitar colisão.
  }, []);

  // =======================
  // Login / Logout
  // =======================
  function handleLoggedIn(accessToken: string) {
    setTokenToStorage(accessToken);
    setToken(accessToken);

    // ✅ Política de pós-login:
    // - respeita deep-links (ex: /memories/123), mas
    // - NÃO volta para /chapters (evita "login cai em capítulos")
    const after = consumeAfterLoginPath();
    const p = String(after || "").trim();

    const isChapters =
      p === "/chapters" ||
      p.startsWith("/chapters?") ||
      p.startsWith("/chapters#") ||
      p.startsWith("/chapters/");

    const isLoginish = p === "/login" || p.startsWith("/login?") || p.startsWith("/login#");

    if (p && !isChapters && !isLoginish) {
      try {
        window.location.assign(p);
        return;
      } catch {
        // ignore
      }
    }

    // fallback definitivo
    try {
      window.location.assign("/dashboard");
    } catch {
      // se falhar, o <Navigate> na rota /login resolve
    }
  }

  function handleLogout() {
    // 🔒 guard global
    if (isDirtyNow()) {
      const ok = confirmLeave("Você tem alterações não salvas. Deseja sair mesmo assim?");
      if (!ok) return;
    }

    try {
      clearHdudSession();
      setToken(null);
      setSessionExpiredNotice(null);
    } finally {
      redirectToLogin("logout");
    }
  }

  // =======================
  // Unauthorized handler (401)
  // =======================
  useEffect(() => {
    setUnauthorizedHandler(async (reason) => {
      debugLog("unauthorized handler fired:", reason);

      // tenta refresh imediato
      try {
        const ok = await tryRefreshNow();
        if (ok) {
          const t = getTokenFromStorage();
          if (t) {
            setTokenToStorage(t);
            setToken(t);
            emitAuthRefreshed();
            return true;
          }
        }
      } catch {
        // ignore
      }

      emitAuthFail();
      clearHdudSession();
      setToken(null);
      setSessionExpiredNotice("Sessão expirada. Faça login novamente.");
      redirectToLogin("session_expired");
      return false;
    });
  }, []);

  // =======================
  // Preventive refresh timer
  // =======================
  useEffect(() => {
    if (!token) return;

    const delay = computeRefreshDelayMs(token, 90);
    if (delay == null) return;

    if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);

    refreshTimerRef.current = window.setTimeout(async () => {
      try {
        const ok = await tryRefreshNow();
        if (ok) {
          const t = getTokenFromStorage();
          if (t) {
            setTokenToStorage(t);
            setToken(t);
            emitAuthRefreshed();
          }
        }
      } catch {
        emitAuthFail();
      }
    }, delay);

    return () => {
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    };
  }, [token]);

  // =======================
  // Activity refresh
  // =======================
  useEffect(() => {
    function onActivity() {
      lastActivityAtRef.current = Date.now();
    }

    window.addEventListener("mousemove", onActivity);
    window.addEventListener("keydown", onActivity);
    window.addEventListener("scroll", onActivity, { passive: true });
    window.addEventListener("click", onActivity);

    return () => {
      window.removeEventListener("mousemove", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("scroll", onActivity as any);
      window.removeEventListener("click", onActivity);
    };
  }, []);

  useEffect(() => {
    if (!token) return;

    const check = async () => {
      const exp = getTokenExpMs(token);
      if (!exp) return;

      const now = Date.now();
      const within = exp - now;

      const idle = now - lastActivityAtRef.current;
      if (idle < IDLE_AFTER_MS) return;

      if (within <= REFRESH_IF_EXP_WITHIN_MS) {
        const sinceLast = now - lastActivityRefreshAtRef.current;
        if (sinceLast < ACTIVITY_REFRESH_THROTTLE_MS) return;

        lastActivityRefreshAtRef.current = now;
        try {
          const ok = await tryRefreshNow();
          if (ok) {
            const t = getTokenFromStorage();
            if (t) {
              setTokenToStorage(t);
              setToken(t);
              emitAuthRefreshed();
            }
          }
        } catch {
          emitAuthFail();
        }
      }
    };

    function onFocus() {
      void check();
    }

    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [token]);

  const isAuthed = useMemo(() => !!token, [token]);

  return (
    <Routes>
      <Route
        path="/login"
        element={
          isAuthed ? <Navigate to="/dashboard" replace /> : <Login onLoggedIn={handleLoggedIn} />
        }
      />

      <Route element={<AppShell onLogout={handleLogout} />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/feed" element={<FeedPage />} />
        <Route path="/chapters" element={<ChaptersPage />} />
        <Route path="/timeline" element={<TimelinePage />} />
        <Route path="/profile" element={<ProfilePage />} />

        {/* ✅ Settings agora é 100% paletas (via HdudThemeProvider). */}
        <Route path="/settings" element={<SettingsPage />} />

        {/* ✅ Memórias: detalhe antes da lista (garante rota correta /memories/:id) */}
        <Route path="/memories/:id" element={<MemoryDetailPage token={token} onLogout={handleLogout} />} />
        <Route path="/memories" element={<MemoriesPage token={token} onLogout={handleLogout} />} />
      </Route>

      <Route path="/" element={<Navigate to={isAuthed ? "/dashboard" : "/login"} replace />} />
      <Route path="*" element={<Navigate to={isAuthed ? "/dashboard" : "/login"} replace />} />
    </Routes>
  );
}