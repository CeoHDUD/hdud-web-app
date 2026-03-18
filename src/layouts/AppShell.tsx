/* C:\HDUD_DATA\hdud-web-app\src\layouts\AppShell.tsx */

import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

type Props = { onLogout: () => void };

const DEBUG_AUTH = (import.meta as any).env?.VITE_DEBUG_AUTH === "1";

type AuthDebugStatus = "ok" | "refreshed" | "fail";

type DirtyState = {
  dirty: boolean;
  message?: string;
  source?: string;
};

type MiniProfileState = {
  initials: string;
  avatar_url: string | null;
  name: string;
  bio: string;
  headline: string;
};

function safeJsonParse(v: string | null) {
  if (!v) return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

function safeInitials(name?: string | null) {
  const s = String(name ?? "").trim();
  if (!s) return "AN";
  const parts = s.split(/\s+/g).filter(Boolean);
  const a = (parts[0]?.[0] ?? "A").toUpperCase();
  const b = (parts[1]?.[0] ?? parts[0]?.[1] ?? "N").toUpperCase();
  return `${a}${b}`.slice(0, 2);
}

function toAbsUrl(s: string | null) {
  if (!s) return null;
  try {
    // já absoluta?
    if (/^https?:\/\//i.test(s)) {
      // normaliza localhost (evita mismatch com VITE_API_BASE_URL=127.0.0.1)
      return s
        .replace("http://localhost", "http://127.0.0.1")
        .replace("https://localhost", "https://127.0.0.1");
    }

    const API_BASE_URL =
      (import.meta as any).env?.VITE_API_BASE_URL || "http://127.0.0.1:4000";

    if (s.startsWith("/")) return `${API_BASE_URL}${s}`;
    return s;
  } catch {
    return s;
  }
}

// ============================
// Ícones (SVG inline minimal)
// ============================
type IconName =
  | "home"
  | "feed"
  | "chapters"
  | "memories"
  | "timeline"
  | "network"
  | "profile"
  | "settings";

function Icon({ name }: { name: IconName }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    "aria-hidden": true,
  } as const;

  switch (name) {
    case "home":
      return (
        <svg {...common}>
          <path
            d="M4 10.6 12 4l8 6.6V20a1.8 1.8 0 0 1-1.8 1.8H5.8A1.8 1.8 0 0 1 4 20v-9.4Z"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path
            d="M9.2 21.8V14a1.2 1.2 0 0 1 1.2-1.2h3.2A1.2 1.2 0 0 1 14.8 14v7.8"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "feed":
      return (
        <svg {...common}>
          <path
            d="M5 6h14M5 12h14M5 18h10"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      );
    case "chapters":
      return (
        <svg {...common}>
          <path
            d="M6 4h10a2 2 0 0 1 2 2v14H8a2 2 0 0 0-2 2V4Z"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path
            d="M8 8h8M8 12h8M8 16h6"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      );
    case "memories":
      return (
        <svg {...common}>
          <path
            d="M7 21h10a2 2 0 0 0 2-2V8l-5-5H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2Z"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path
            d="M14 3v5h5"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path
            d="M8 13h8M8 17h6"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      );
    case "timeline":
      return (
        <svg {...common}>
          <path
            d="M6 6h6M6 12h10M6 18h14"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M4 6h.01M4 12h.01M4 18h.01"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>
      );
    case "network":
      return (
        <svg {...common}>
          <path
            d="M8 10.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z"
            stroke="currentColor"
            strokeWidth="2.2"
          />
          <path
            d="M17 8.8a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6Z"
            stroke="currentColor"
            strokeWidth="2.2"
          />
          <path
            d="M6 20.8v-.7A4.1 4.1 0 0 1 10.1 16h3.1a4.1 4.1 0 0 1 4.1 4.1v.7"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M17.8 20.8v-.5a3.4 3.4 0 0 0-2.1-3.2"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      );
    case "profile":
      return (
        <svg {...common}>
          <path
            d="M20 21a8 8 0 0 0-16 0"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M12 13a4.2 4.2 0 1 0 0-8.4A4.2 4.2 0 0 0 12 13Z"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <path
            d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z"
            stroke="currentColor"
            strokeWidth="2.2"
          />
          <path
            d="M19.4 15a8.6 8.6 0 0 0 .06-1 8.6 8.6 0 0 0-.06-1l2.06-1.6-2-3.46-2.5 1a8.7 8.7 0 0 0-1.72-1l-.38-2.68H9.1l-.38 2.68a8.7 8.7 0 0 0-1.72 1l-2.5-1-2 3.46L4.6 13a8.6 8.6 0 0 0-.06 1 8.6 8.6 0 0 0 .06 1l-2.06 1.6 2 3.46 2.5-1a8.7 8.7 0 0 0 1.72 1l.38 2.68h5.8l.38-2.68a8.7 8.7 0 0 0 1.72-1l2.5 1 2-3.46L19.4 15Z"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
        </svg>
      );
    default:
      return null;
  }
}

export default function AppShell({ onLogout }: Props) {
  const loc = useLocation();
  const nav = useNavigate();

  const [dirty, setDirty] = useState<DirtyState>({ dirty: false });

  const [miniProfile, setMiniProfile] = useState<MiniProfileState>({
    initials: "AN",
    avatar_url: null,
    name: "Alexandre Neves",
    bio: "DBA Senior | HDUD",
    headline: "Founder | CEO HDUD",
  });

  // hidrata do storage (quando existir)
  useEffect(() => {
    const raw = safeJsonParse(localStorage.getItem("HDUD_PROFILE"));
    if (raw) {
      const name = String(raw?.name ?? "Alexandre Neves");
      const bio = String(raw?.bio ?? "DBA Senior | HDUD");
      const headline = String(raw?.headline ?? "Founder | CEO HDUD");
      const avatar_url = toAbsUrl(raw?.avatar_url ?? null);

      setMiniProfile({
        initials: safeInitials(name),
        avatar_url,
        name,
        bio,
        headline,
      });
    }

    const dirtyRaw = safeJsonParse(localStorage.getItem("HDUD_DIRTY"));
    if (dirtyRaw) {
      setDirty({
        dirty: !!dirtyRaw?.dirty,
        message: dirtyRaw?.message,
        source: dirtyRaw?.source,
      });
    }
  }, []);

  // escuta updates de outras abas
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      // perfil
      if (e.key === "HDUD_PROFILE") {
        const raw = safeJsonParse(e.newValue);
        const name = String(raw?.name ?? "Alexandre Neves");
        const bio = String(raw?.bio ?? "DBA Senior | HDUD");
        const headline = String(raw?.headline ?? "Founder | CEO HDUD");
        const avatar_url = toAbsUrl(raw?.avatar_url ?? null);

        setMiniProfile({
          initials: safeInitials(name),
          avatar_url,
          name,
          bio,
          headline,
        });
      }

      // dirty state (se alguma página quiser marcar)
      if (e.key === "HDUD_DIRTY") {
        const raw = safeJsonParse(e.newValue);
        setDirty({
          dirty: !!raw?.dirty,
          message: raw?.message,
          source: raw?.source,
        });
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // proteção simples ao navegar enquanto dirty
  function confirmIfDirty(nextPath?: string) {
    if (!dirty.dirty) return true;

    const msg =
      dirty.message ||
      "Você tem alterações não salvas. Se sair agora, pode perder o que digitou.";
    const extra = nextPath ? `\n\nIr para: ${nextPath}` : "";
    return window.confirm(`${msg}${extra}\n\nContinuar mesmo assim?`);
  }

  function guardedNavigate(path: string) {
    if (!confirmIfDirty(path)) return;
    nav(path);
  }

  function handleLogout() {
    if (!confirmIfDirty("Sair")) return;
    onLogout();
  }

  // título simples para o header
  const topTitle = useMemo(() => {
    const p = loc.pathname || "";
    if (p.startsWith("/dashboard")) return "Início";
    if (p.startsWith("/feed")) return "Feed";
    if (p.startsWith("/chapters")) return "Capítulos";
    if (p.startsWith("/memories")) return "Memórias";
    if (p.startsWith("/timeline")) return "Timeline";
    if (p.startsWith("/network")) return "Minha Rede";
    if (p.startsWith("/profile")) return "Perfil";
    if (p.startsWith("/settings")) return "Configurações";
    return "HDUD";
  }, [loc.pathname]);

  const navItems = useMemo(
    () => [
      { to: "/dashboard", label: "Início", icon: "home" as const },
      { to: "/feed", label: "Feed", icon: "feed" as const },
      { to: "/chapters", label: "Capítulos", icon: "chapters" as const },
      { to: "/memories", label: "Memórias", icon: "memories" as const },
      { to: "/timeline", label: "Timeline", icon: "timeline" as const },
      { to: "/network", label: "Minha Rede", icon: "network" as const },
      { to: "/profile", label: "Perfil", icon: "profile" as const },
    ],
    []
  );

  // debug auth (optional)
  const [authDebug, setAuthDebug] = useState<AuthDebugStatus>("ok");
  useEffect(() => {
    if (!DEBUG_AUTH) return;
    const t = setInterval(() => {
      const raw = localStorage.getItem("HDUD_TOKEN") || "";
      setAuthDebug(raw ? "ok" : "fail");
    }, 1500);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "56px 300px 1fr",
        minHeight: "100vh",
        background: "var(--hdud-bg)",
      }}
    >
      {/* COLUNA ÍCONES (nav) */}
      <aside
        style={{
          borderRight: "1px solid var(--hdud-border)",
          background: "var(--hdud-surface)",
          position: "sticky",
          top: 0,
          alignSelf: "stretch",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 0",
          gap: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            width: "100%",
            alignItems: "center",
            height: "100%",
          }}
        >
          {navItems.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              onClick={(e) => {
                if (!confirmIfDirty(it.to)) {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
              title={it.label}
              aria-label={it.label}
              style={({ isActive }) => ({
                height: 40,
                width: 40,
                borderRadius: 10,
                border: isActive
                  ? "1px solid var(--hdud-accent-border)"
                  : "1px solid transparent",
                background: isActive ? "var(--hdud-accent-bg)" : "transparent",
                display: "grid",
                placeItems: "center",
                color: "var(--hdud-text)",
              })}
            >
              {() => (
                <span
                  aria-hidden
                  style={{
                    width: 22,
                    height: 22,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name={it.icon} />
                </span>
              )}
            </NavLink>
          ))}

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              width: "100%",
              alignItems: "center",
              paddingBottom: 6,
            }}
          >
            {/* Configurações */}
            <button
              onClick={() => guardedNavigate("/settings")}
              title="Configurações"
              aria-label="Configurações"
              style={{
                height: 40,
                width: 40,
                borderRadius: 10,
                border: loc.pathname.startsWith("/settings")
                  ? "1px solid var(--hdud-accent-border)"
                  : "1px solid transparent",
                background: loc.pathname.startsWith("/settings")
                  ? "var(--hdud-accent-bg)"
                  : "transparent",
                display: "grid",
                placeItems: "center",
                color: "var(--hdud-text)",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                if (loc.pathname.startsWith("/settings")) return;
                e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                e.currentTarget.style.borderColor = "var(--hdud-border)";
              }}
              onMouseLeave={(e) => {
                if (loc.pathname.startsWith("/settings")) return;
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.borderColor = "transparent";
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 22,
                  height: 22,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name={"settings"} />
              </span>
            </button>

            {/* Sair — abaixo e colado em Configurações */}
            <button
              onClick={handleLogout}
              title="Sair"
              aria-label="Sair"
              style={{
                height: 40,
                width: 40,
                borderRadius: 10,
                border: "1px solid transparent",
                background: "transparent",
                display: "grid",
                placeItems: "center",
                color: "var(--hdud-text)",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                e.currentTarget.style.borderColor = "var(--hdud-border)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.borderColor = "transparent";
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
                <path
                  d="M16 17l5-5-5-5M21 12H9"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* COLUNA PERFIL (bio) */}
      <aside
        style={{
          borderRight: "1px solid var(--hdud-border)",
          background: "var(--hdud-bg)",
          padding: 14,
          position: "sticky",
          top: 0,
          alignSelf: "stretch",
        }}
      >
        <div
          style={{
            background: "var(--hdud-surface)",
            border: "1px solid var(--hdud-border)",
            borderRadius: 18,
            padding: 14,
            boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 16,
                border: "1px solid var(--hdud-border)",
                background: "rgba(255,255,255,0.04)",
                overflow: "hidden",
                display: "grid",
                placeItems: "center",
              }}
            >
              {miniProfile.avatar_url ? (
                <img
                  src={miniProfile.avatar_url || ""}
                  alt={miniProfile.name}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 800,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {miniProfile.initials}
                </div>
              )}
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, lineHeight: 1.1, fontSize: 16 }}>
                {miniProfile.name}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--hdud-muted)",
                  marginTop: 2,
                }}
              >
                {miniProfile.bio}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--hdud-muted)",
                  marginTop: 2,
                }}
              >
                {miniProfile.headline}
              </div>
            </div>
          </div>

          {/* ✅ CTA removido: Perfil já existe na navegação */}
          {DEBUG_AUTH && (
            <div style={{ marginTop: 10, fontSize: 12, color: "var(--hdud-muted)" }}>
              auth: <b>{authDebug}</b>
            </div>
          )}
        </div>
      </aside>

      {/* MAIN */}
      <main style={{ minWidth: 0 }}>
        {/* Topbar (sem ações globais) */}
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 50,
            background: "var(--hdud-bg)",
            borderBottom: "1px solid var(--hdud-border)",
          }}
        >
          <div
            style={{
              height: 52,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 18px",
            }}
          >
            <div style={{ fontWeight: 800 }}>{topTitle}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* intencionalmente vazio — ações contextuais ficam nas páginas */}
            </div>
          </div>
        </div>

        <div style={{ padding: 18 }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}