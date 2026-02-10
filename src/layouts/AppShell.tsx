// C:\HDUD_DATA\hdud-web-app\src\layouts\AppShell.tsx

import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

type Props = {
  onLogout: () => void;
};

// Flag DEV-only (não existe em prod se não definida)
const DEBUG_AUTH = (import.meta as any).env?.VITE_DEBUG_AUTH === "1";

type AuthDebugStatus = "ok" | "refreshed" | "fail";

// Dirty Guard (app-level) via event
type DirtyState = {
  dirty: boolean;
  message?: string;
  source?: string;
};

type MiniProfileState = {
  initials: string;
  avatar_url: string | null;
};

function computeInitialsFromName(name?: string | null): string {
  const raw = String(name || "").trim();
  if (!raw) return "AN";

  const parts = raw
    .split(/\s+/g)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length === 0) return "AN";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  const first = parts[0].slice(0, 1);
  const last = parts[parts.length - 1].slice(0, 1);
  const out = `${first}${last}`.toUpperCase();
  return out || "AN";
}

function getInitialsFallback(): string {
  // MVP: iniciais fixas, estilo LinkedIn.
  // Próximo passo: puxar /me/profile e derivar das iniciais do name_public.
  return "AN";
}

export default function AppShell({ onLogout }: Props) {
  const location = useLocation();
  const navigate = useNavigate();

  // Estado DEV-only para observabilidade visual
  const [authStatus, setAuthStatus] = useState<AuthDebugStatus>("ok");

  // Dirty guard central (sidebar/logout)
  const [dirtyState, setDirtyState] = useState<DirtyState>({
    dirty: false,
    message: "Você tem alterações não salvas. Deseja sair sem salvar?",
    source: "",
  });

  const isDirty = !!dirtyState.dirty;

  const confirmLeave = (customMsg?: string) => {
    const msg =
      customMsg ||
      dirtyState.message ||
      "Você tem alterações não salvas. Deseja sair sem salvar?";
    return window.confirm(msg);
  };

  // Mini perfil (avatar + iniciais) — puxado do /me/profile (sem depender de outras páginas)
  const [miniProfile, setMiniProfile] = useState<MiniProfileState>(() => ({
    initials: getInitialsFallback(),
    avatar_url: null,
  }));

  // Escuta eventos de dirty disparados por páginas (ex.: ProfilePage)
  useEffect(() => {
    function onDirty(e: Event) {
      const ce = e as CustomEvent<DirtyState>;
      const next = ce?.detail || { dirty: false };

      setDirtyState((prev) => ({
        dirty: !!next.dirty,
        message:
          next.message ||
          prev.message ||
          "Você tem alterações não salvas. Deseja sair sem salvar?",
        source: next.source || prev.source || "",
      }));
    }

    window.addEventListener("hdud:dirty", onDirty as any);
    return () => window.removeEventListener("hdud:dirty", onDirty as any);
  }, []);

  // DEV auth badge events
  useEffect(() => {
    if (!DEBUG_AUTH) return;

    function onAuthRefreshed() {
      setAuthStatus("refreshed");
      setTimeout(() => setAuthStatus("ok"), 2000);
    }

    function onAuthFail() {
      setAuthStatus("fail");
    }

    window.addEventListener("hdud:auth-refreshed", onAuthRefreshed);
    window.addEventListener("hdud:auth-fail", onAuthFail);

    return () => {
      window.removeEventListener("hdud:auth-refreshed", onAuthRefreshed);
      window.removeEventListener("hdud:auth-fail", onAuthFail);
    };
  }, []);

  // 🔥 Puxa /me/profile quando:
  // - AppShell monta
  // - houve refresh de token (evento)
  // - usuário voltou pro app (tab focus)
  useEffect(() => {
    let cancelled = false;

    async function loadMeProfile() {
      try {
        const token = localStorage.getItem("access_token");
        if (!token) {
          if (!cancelled) {
            setMiniProfile({
              initials: getInitialsFallback(),
              avatar_url: null,
            });
          }
          return;
        }

        const API_BASE =
          (import.meta as any).env?.VITE_API_BASE_URL || "http://127.0.0.1:4000";

        const res = await fetch(`${API_BASE}/me/profile`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          // sem quebrar UX: mantém fallback
          if (!cancelled) {
            setMiniProfile({
              initials: getInitialsFallback(),
              avatar_url: null,
            });
          }
          return;
        }

        const data = await res.json();

        const namePublic =
          (data?.name_public && String(data.name_public).trim()) ||
          (data?.profile?.name_public && String(data.profile.name_public).trim()) ||
          null;

        const avatarUrl =
          (data?.avatar_url && String(data.avatar_url).trim()) ||
          (data?.profile?.avatar_url && String(data.profile.avatar_url).trim()) ||
          null;

        const initialsFromName = computeInitialsFromName(namePublic);

        if (!cancelled) {
          setMiniProfile({
            initials: initialsFromName || getInitialsFallback(),
            avatar_url: avatarUrl || null,
          });
        }
      } catch {
        if (!cancelled) {
          setMiniProfile({
            initials: getInitialsFallback(),
            avatar_url: null,
          });
        }
      }
    }

    loadMeProfile();

    function onAuthRefreshed() {
      loadMeProfile();
    }

    function onFocus() {
      loadMeProfile();
    }

    window.addEventListener("hdud:auth-refreshed", onAuthRefreshed);
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      window.removeEventListener("hdud:auth-refreshed", onAuthRefreshed);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  // Topbar title
  const topTitle = useMemo(() => {
    if (location.pathname.startsWith("/memories")) return "Memórias";
    if (location.pathname.startsWith("/chapters")) return "Capítulos";
    if (location.pathname.startsWith("/timeline")) return "Timeline";
    if (location.pathname.startsWith("/feed")) return "Feed";
    if (location.pathname.startsWith("/profile")) return "Perfil";
    if (location.pathname.startsWith("/settings")) return "Configurações";
    if (location.pathname.startsWith("/dashboard")) return "Início";
    return "HDUD";
  }, [location.pathname]);

  function handleNavClick(e: any, to: string) {
    if (to === location.pathname) return;

    if (isDirty) {
      e.preventDefault();
      const ok = confirmLeave(
        "Você tem alterações não salvas. Deseja navegar e perder essas alterações?"
      );
      if (!ok) return;

      navigate(to);
      return;
    }
  }

  function handleLogout() {
    if (isDirty) {
      const ok = confirmLeave(
        "Você tem alterações não salvas. Deseja sair mesmo assim?"
      );
      if (!ok) return;
    }
    onLogout();
  }

  function goProfile() {
    if (location.pathname.startsWith("/profile")) return;

    if (isDirty) {
      const ok = confirmLeave(
        "Você tem alterações não salvas. Deseja ir ao Perfil e perder essas alterações?"
      );
      if (!ok) return;
    }

    navigate("/profile");
  }

  const initials = miniProfile.initials;

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "var(--hdud-bg)",
        color: "var(--hdud-text)",
      }}
    >
      {/* Sidebar */}
      <aside
        style={{
          width: 260,
          background: "var(--hdud-surface)",
          borderRight: "1px solid var(--hdud-border)",
          padding: 16,
        }}
      >
        <div style={{ fontWeight: 900, marginBottom: 16 }}>HDUD</div>

        <nav style={{ display: "grid", gap: 6 }}>
          {[
            ["/dashboard", "Início"],
            ["/feed", "Feed"],
            ["/chapters", "Capítulos"],
            ["/memories", "Memórias"],
            ["/timeline", "Timeline"],
            ["/profile", "Perfil"],
            ["/settings", "Configurações"],
          ].map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              onClick={(e) => handleNavClick(e, to)}
              style={({ isActive }) => ({
                padding: "10px 12px",
                borderRadius: 10,
                fontWeight: 700,
                color: "var(--hdud-text)",
                background: isActive ? "var(--hdud-accent-bg)" : "transparent",
                border: isActive
                  ? "1px solid var(--hdud-accent-border)"
                  : "1px solid transparent",
              })}
              title={isDirty ? "Há alterações não salvas" : undefined}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {isDirty ? (
          <div style={{ marginTop: 12, opacity: 0.75, fontSize: 12 }}>
            Você tem alterações não salvas.
          </div>
        ) : null}
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Topbar */}
        <header
          style={{
            height: 56,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 16px",
            borderBottom: "1px solid var(--hdud-border)",
            background: "var(--hdud-surface)",
          }}
        >
          <div style={{ fontWeight: 800, display: "flex", gap: 12 }}>
            <span>
              {topTitle}{" "}
              <span style={{ fontWeight: 500, opacity: 0.7 }}>
                AppShell mínimo (vNext)
              </span>
            </span>

            {/* Badge DEV-only */}
            {DEBUG_AUTH && (
              <span
                style={{
                  padding: "4px 8px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 800,
                  alignSelf: "center",
                  background:
                    authStatus === "ok"
                      ? "#1f7a1f"
                      : authStatus === "refreshed"
                      ? "#1f4fd8"
                      : "#b91c1c",
                  color: "#fff",
                }}
              >
                Auth: {authStatus}
              </span>
            )}
          </div>

          {/* Right side: mini-perfil + sair (LinkedIn-like) */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={goProfile}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                border: "1px solid transparent",
                background: "transparent",
                color: "var(--hdud-text)",
                cursor: "pointer",
                padding: "6px 8px",
                borderRadius: 10,
              }}
              title={isDirty ? "Há alterações não salvas" : "Abrir perfil"}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 900,
                  fontSize: 12,
                  border: "1px solid var(--hdud-border)",
                  background: "rgba(255,255,255,0.04)",
                  userSelect: "none",
                  lineHeight: 1,
                  overflow: "hidden",
                }}
              >
                {miniProfile.avatar_url ? (
                  <img
                    src={miniProfile.avatar_url}
                    alt="avatar"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                    onError={() =>
                      setMiniProfile((prev) => ({ ...prev, avatar_url: null }))
                    }
                  />
                ) : (
                  initials
                )}
              </div>
              <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.9 }}>
                {initials}
              </div>
            </button>

            <button
              onClick={handleLogout}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid var(--hdud-border)",
                background: "var(--hdud-surface)",
                color: "var(--hdud-text)",
                fontWeight: 800,
                cursor: "pointer",
              }}
              title={isDirty ? "Há alterações não salvas" : "Sair"}
            >
              Sair
            </button>
          </div>
        </header>

        {/* Content */}
        <main style={{ flex: 1, background: "var(--hdud-bg)" }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
