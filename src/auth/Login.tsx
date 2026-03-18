import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  HDUD_AUTH_NOTICE_KEY,
  HDUD_AUTH_NOTICE_EXPIRED,
  parseJsonSafe,
  setAuthTokens,
} from "../lib/api";

type LoginResponse = {
  access_token?: string;
  refresh_token?: string;
  accessToken?: string;
  refreshToken?: string;
  user?: {
    authorId?: string | number;
    author_id?: string | number;
  };
};

type Props = {
  onLoggedIn: (accessToken: string) => void;
};

type MemoryBubble = {
  id: string;
  text: string;
  width: number;
  left: string;
  top: string;
  rotate?: number;
};

export default function Login({ onLoggedIn }: Props) {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showIntro, setShowIntro] = useState(true);
  const [isCompactNotebook, setIsCompactNotebook] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShowIntro(false);
    }, 3800);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    function handleViewport() {
      const compact = window.innerWidth <= 1440 && window.innerWidth > 1080;
      setIsCompactNotebook(compact);
    }

    handleViewport();
    window.addEventListener("resize", handleViewport);

    return () => window.removeEventListener("resize", handleViewport);
  }, []);

  useEffect(() => {
    try {
      const v = sessionStorage.getItem(HDUD_AUTH_NOTICE_KEY);
      if (v === HDUD_AUTH_NOTICE_EXPIRED) {
        setNotice("Sua sessão expirou por segurança. Entre novamente para continuar.");
      }
      sessionStorage.removeItem(HDUD_AUTH_NOTICE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const ui = {
    bg: "#F6EFE4",
    bgDeep: "#E9DCC7",
    bgSoft: "#FBF5EC",
    card: "rgba(255, 255, 255, 0.74)",
    ink: "#0F172A",
    muted: "rgba(15, 23, 42, 0.68)",
    softMuted: "rgba(15, 23, 42, 0.56)",
    border: "rgba(15, 23, 42, 0.10)",
    borderStrong: "rgba(15, 23, 42, 0.14)",
    shadow: "0 34px 90px rgba(15, 23, 42, 0.14)",
    shadowSoft: "0 18px 40px rgba(15, 23, 42, 0.08)",
    primary: "#0B4F8A",
    primarySoft: "rgba(11, 79, 138, 0.14)",
    inputBg: "rgba(255, 255, 255, 0.88)",
    errorBg: "#FFF4F4",
    errorBorder: "rgba(220, 38, 38, 0.24)",
    errorInk: "rgba(153, 27, 27, 0.95)",
    noticeBg: "rgba(11, 79, 138, 0.08)",
    noticeBorder: "rgba(11, 79, 138, 0.18)",
    noticeInk: "rgba(11, 79, 138, 0.96)",
    bubbleBg: "rgba(255, 255, 255, 0.78)",
    bubbleBorder: "rgba(255, 255, 255, 0.92)",
  };

  const memoryBubbles: MemoryBubble[] = useMemo(() => {
    return [
      {
        id: "b1",
        text: "“O dia em que minha filha nasceu mudou tudo.”",
        width: 250,
        left: "10%",
        top: "13%",
        rotate: -1.5,
      },
      {
        id: "b2",
        text: "“Em 2002 eu atravessei o país para recomeçar.”",
        width: 280,
        left: "36%",
        top: "8%",
        rotate: 0.8,
      },
      {
        id: "b3",
        text: "“Meu pai me ensinou a andar de bicicleta aos 6 anos.”",
        width: 300,
        left: isCompactNotebook ? "55%" : "60%",
        top: "13%",
        rotate: -1,
      },
      {
        id: "b4",
        text: "“Perdi tudo. E foi assim que comecei de novo.”",
        width: 280,
        left: "6%",
        top: "48%",
        rotate: -0.6,
      },
      {
        id: "b5",
        text: "“Cada memória que guardamos também nos guarda.”",
        width: 255,
        left: "10%",
        top: "80%",
        rotate: 0.8,
      },
      {
        id: "b6",
        text: "“Toda vida carrega capítulos que o mundo ainda não ouviu.”",
        width: 320,
        left: "38%",
        top: "86%",
        rotate: -0.8,
      },
      {
        id: "b7",
        text: "“A HDUD nasceu de uma pergunta: meu filho saberá quem eu fui?”",
        width: 340,
        left: isCompactNotebook ? "52%" : "58%",
        top: isCompactNotebook ? "81%" : "82%",
        rotate: 1.1,
      },
      {
        id: "b8",
        text: "“Cada vida carrega algo que merece ser lembrado.”",
        width: 270,
        left: isCompactNotebook ? "60%" : "65%",
        top: "52%",
        rotate: -0.7,
      },
    ];
  }, [isCompactNotebook]);

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    height: 52,
    padding: "0 14px",
    fontSize: 14,
    borderRadius: 16,
    border: `1px solid ${ui.borderStrong}`,
    background: ui.inputBg,
    color: ui.ink,
    outline: "none",
    boxSizing: "border-box",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.45)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    transition: "border-color 140ms ease, box-shadow 140ms ease, background 140ms ease",
  };

  const canSubmit = useMemo(() => {
    return email.trim().length > 0 && password.trim().length > 0 && !loading;
  }, [email, password, loading]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        const maybeJson = parseJsonSafe(t);
        const msg =
          (maybeJson && (maybeJson.detail || maybeJson.error)) ||
          t ||
          `Falha no login (HTTP ${res.status}).`;
        throw new Error(String(msg));
      }

      const data = (await res.json()) as LoginResponse;

      const accessToken = data.access_token ?? data.accessToken ?? "";
      const refreshToken = data.refresh_token ?? data.refreshToken ?? "";
      const user = data.user ?? {};
      const authorId = user.authorId ?? user.author_id ?? null;

      if (!accessToken) throw new Error("Login retornou sem access token.");

      setAuthTokens(String(accessToken), refreshToken ? String(refreshToken) : undefined);

      if (authorId !== null && authorId !== undefined && String(authorId).trim()) {
        localStorage.setItem("author_id", String(authorId));
        localStorage.setItem("HDUD_AUTHOR_ID", String(authorId));
      } else {
        localStorage.removeItem("author_id");
        localStorage.removeItem("HDUD_AUTHOR_ID");
      }

      onLoggedIn(String(accessToken));
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      setErrorMsg(err?.message || "Erro inesperado no login.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>
        {`
          @keyframes hdudIntroFade {
            0% { opacity: 1; }
            78% { opacity: 1; }
            100% { opacity: 0; }
          }

          @keyframes hdudIntroNautilusZoom {
            0% {
              transform: translate(-50%, -50%) scale(0.12);
              opacity: 0;
              filter: blur(8px);
            }
            16% {
              opacity: 1;
              filter: blur(0px);
            }
            58% {
              transform: translate(-50%, -50%) scale(1.12);
              opacity: 1;
            }
            84% {
              transform: translate(-50%, -50%) scale(1.85);
              opacity: 0.30;
            }
            100% {
              transform: translate(-50%, -50%) scale(2.12);
              opacity: 0;
              filter: blur(4px);
            }
          }

          @keyframes hdudIntroBrand {
            0%, 44% {
              opacity: 0;
              transform: translate(-50%, -50%) scale(0.96);
            }
            58% {
              opacity: 1;
              transform: translate(-50%, -50%) scale(1);
            }
            84% {
              opacity: 1;
              transform: translate(-50%, -50%) scale(1);
            }
            100% {
              opacity: 0;
              transform: translate(-50%, -50%) scale(1.02);
            }
          }

          @keyframes hdudFloatSoft {
            0% { transform: translateY(0px); }
            50% { transform: translateY(-6px); }
            100% { transform: translateY(0px); }
          }

          @keyframes hdudGlowBreath {
            0% { opacity: 0.22; transform: translate(-50%, -50%) scale(0.98); }
            50% { opacity: 0.48; transform: translate(-50%, -50%) scale(1.03); }
            100% { opacity: 0.22; transform: translate(-50%, -50%) scale(0.98); }
          }

          @keyframes hdudPortalBreath {
            0% { box-shadow: 0 34px 90px rgba(15, 23, 42, 0.14); }
            50% { box-shadow: 0 42px 110px rgba(15, 23, 42, 0.18); }
            100% { box-shadow: 0 34px 90px rgba(15, 23, 42, 0.14); }
          }

          @keyframes hdudShine {
            0% { transform: translateX(-120%); opacity: 0; }
            25% { opacity: 0.28; }
            100% { transform: translateX(220%); opacity: 0; }
          }

          @keyframes hdudFadeUp {
            from { opacity: 0; transform: translateY(18px); }
            to { opacity: 1; transform: translateY(0); }
          }

          .hdud-login-root * {
            box-sizing: border-box;
          }

          .hdud-intro-overlay {
            position: fixed;
            inset: 0;
            z-index: 9999;
            pointer-events: none;
            overflow: hidden;
            background:
              radial-gradient(circle at 50% 50%, rgba(255,255,255,0.56) 0%, rgba(246,239,228,0.18) 34%, rgba(233,220,199,0.06) 62%, rgba(233,220,199,0.02) 100%);
            animation: hdudIntroFade 3.8s ease-in-out forwards;
          }

          .hdud-intro-nautilus {
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            transform-origin: center center;
            animation: hdudIntroNautilusZoom 3.8s cubic-bezier(.2,.85,.2,1) forwards;
            filter: drop-shadow(0 24px 54px rgba(11,79,138,0.10));
          }

          .hdud-intro-brand-block {
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            animation: hdudIntroBrand 3.8s ease-in-out forwards;
          }

          .hdud-intro-hdud {
            color: ${ui.primary};
            font-size: 48px;
            font-weight: 800;
            letter-spacing: 0.18em;
            text-shadow: 0 14px 32px rgba(11,79,138,0.08);
          }

          .hdud-intro-tagline {
            color: rgba(11,79,138,0.86);
            font-size: 14px;
            letter-spacing: 0.18em;
            text-transform: uppercase;
          }

          .hdud-bg-nautilus {
            position: absolute;
            inset: 0;
            pointer-events: none;
          }

          .hdud-memory-bubble {
            position: absolute;
            border-radius: 24px;
            border: 1px solid ${ui.bubbleBorder};
            background: ${ui.bubbleBg};
            box-shadow: ${ui.shadowSoft};
            color: ${ui.softMuted};
            font-size: 14px;
            line-height: 1.55;
            padding: 14px 16px;
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            animation: hdudFloatSoft 9s ease-in-out infinite;
          }

          .hdud-center-copy {
            animation: hdudFadeUp 0.85s ease-out;
          }

          .hdud-investor-card {
            animation: hdudFadeUp 0.85s ease-out, hdudPortalBreath 8.5s ease-in-out infinite;
          }

          .hdud-card-shine::after {
            content: "";
            position: absolute;
            top: 0;
            left: -20%;
            width: 40%;
            height: 100%;
            background: linear-gradient(
              90deg,
              rgba(255,255,255,0) 0%,
              rgba(255,255,255,0.28) 45%,
              rgba(255,255,255,0) 100%
            );
            transform: translateX(-120%);
            animation: hdudShine 6.5s ease-in-out infinite;
            pointer-events: none;
          }

          .hdud-input:focus {
            border-color: rgba(11, 79, 138, 0.34) !important;
            box-shadow: 0 0 0 4px rgba(11, 79, 138, 0.10) !important;
            background: rgba(255, 255, 255, 0.96) !important;
          }

          .hdud-login-btn:hover:not(:disabled) {
            transform: translateY(-1px);
            filter: brightness(0.98);
          }

          .hdud-login-btn:active:not(:disabled) {
            transform: translateY(0);
          }

          @media (max-width: 1320px) {
            .hdud-memory-layer {
              display: none !important;
            }

            .hdud-login-grid {
              grid-template-columns: minmax(0, 1fr) 350px !important;
              gap: 20px !important;
            }

            .hdud-investor-card {
              padding: 26px !important;
            }
          }

          @media (max-width: 1080px) {
            .hdud-center-copy-panel {
              display: none !important;
            }

            .hdud-login-grid {
              grid-template-columns: minmax(340px, 410px) !important;
              justify-content: end !important;
            }

            .hdud-bg-nautilus {
              opacity: 0.92 !important;
            }
          }

          @media (max-width: 640px) {
            .hdud-login-shell {
              padding: 18px !important;
            }

            .hdud-investor-card {
              padding: 24px !important;
              border-radius: 24px !important;
            }

            .hdud-login-brand-title {
              font-size: 22px !important;
            }

            .hdud-intro-hdud {
              font-size: 30px !important;
              letter-spacing: 0.12em !important;
            }

            .hdud-intro-tagline {
              font-size: 11px !important;
              letter-spacing: 0.12em !important;
            }
          }
        `}
      </style>

      <div
        className="hdud-login-root"
        style={{
          minHeight: "100vh",
          position: "relative",
          overflow: "hidden",
          background: `radial-gradient(circle at 50% 50%, rgba(255,255,255,0.92) 0%, ${ui.bgSoft} 22%, ${ui.bg} 52%, ${ui.bgDeep} 100%)`,
        }}
      >
        {showIntro ? (
          <div className="hdud-intro-overlay" aria-hidden="true">
            <svg
              className="hdud-intro-nautilus"
              viewBox="0 0 600 600"
              width="1500"
              height="1500"
            >
              <path
                d="M304 302c0-16-13-29-29-29-18 0-33 15-33 33 0 22 18 40 40 40 27 0 49-22 49-49 0-33-27-60-60-60-41 0-74 33-74 74 0 50 41 91 91 91 62 0 112-50 112-112 0-76-62-138-138-138-92 0-166 74-166 166 0 111 90 201 201 201 133 0 241-108 241-241"
                fill="none"
                stroke="#0B4F8A"
                strokeWidth="18"
                strokeLinecap="round"
              />
            </svg>

            <div className="hdud-intro-brand-block">
              <div className="hdud-intro-hdud">HDUD</div>
              <div className="hdud-intro-tagline">Epicentro Vivo das Histórias Humanas</div>
            </div>
          </div>
        ) : null}

        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.26) 0%, rgba(255,255,255,0.04) 42%, rgba(15,23,42,0.03) 100%)",
            pointerEvents: "none",
          }}
        />

        <div className="hdud-bg-nautilus" aria-hidden="true">
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: "130vmax",
              height: "130vmax",
              minWidth: 1400,
              minHeight: 1400,
              transform: "translate(-50%, -50%)",
              opacity: 0.19,
            }}
          >
            <svg viewBox="0 0 600 600" width="100%" height="100%">
              <defs>
                <linearGradient id="hdudSpiralGradientBackFinal" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0B4F8A" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#0B4F8A" stopOpacity="0.06" />
                </linearGradient>
                <linearGradient id="hdudSpiralGradientFrontFinal" x1="10%" y1="10%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#8CB8DD" stopOpacity="0.92" />
                  <stop offset="36%" stopColor="#5A98CA" stopOpacity="0.78" />
                  <stop offset="100%" stopColor="#0B4F8A" stopOpacity="0.52" />
                </linearGradient>
                <filter id="hdudSpiralBlurFinal" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="6" />
                </filter>
              </defs>

              <path
                d="M304 302c0-16-13-29-29-29-18 0-33 15-33 33 0 22 18 40 40 40 27 0 49-22 49-49 0-33-27-60-60-60-41 0-74 33-74 74 0 50 41 91 91 91 62 0 112-50 112-112 0-76-62-138-138-138-92 0-166 74-166 166 0 111 90 201 201 201 133 0 241-108 241-241"
                fill="none"
                stroke="url(#hdudSpiralGradientBackFinal)"
                strokeWidth="34"
                strokeLinecap="round"
                filter="url(#hdudSpiralBlurFinal)"
              />
              <path
                d="M304 302c0-16-13-29-29-29-18 0-33 15-33 33 0 22 18 40 40 40 27 0 49-22 49-49 0-33-27-60-60-60-41 0-74 33-74 74 0 50 41 91 91 91 62 0 112-50 112-112 0-76-62-138-138-138-92 0-166 74-166 166 0 111 90 201 201 201 133 0 241-108 241-241"
                fill="none"
                stroke="url(#hdudSpiralGradientFrontFinal)"
                strokeWidth="15"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 420,
              height: 420,
              borderRadius: "50%",
              transform: "translate(-50%, -50%)",
              background:
                "radial-gradient(circle, rgba(11,79,138,0.18) 0%, rgba(11,79,138,0.09) 24%, rgba(11,79,138,0.04) 46%, rgba(11,79,138,0) 74%)",
              filter: "blur(10px)",
              animation: "hdudGlowBreath 8.4s ease-in-out infinite",
            }}
          />
        </div>

        <div
          className="hdud-memory-layer"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1,
            pointerEvents: "none",
          }}
        >
          {memoryBubbles.map((bubble, index) => (
            <div
              key={bubble.id}
              className="hdud-memory-bubble"
              style={{
                width: bubble.width,
                maxWidth: bubble.width,
                left: bubble.left,
                top: bubble.top,
                transform: `translate(-50%, -50%) rotate(${bubble.rotate ?? 0}deg)`,
                animationDelay: `${index * 0.35}s`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    marginTop: 6,
                    borderRadius: "50%",
                    background: ui.primary,
                    boxShadow: `0 0 0 6px ${ui.primarySoft}`,
                    flexShrink: 0,
                  }}
                />
                <div>{bubble.text}</div>
              </div>
            </div>
          ))}
        </div>

        <div
          className="hdud-login-shell"
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            padding: "20px 24px 20px 24px",
            position: "relative",
            zIndex: 2,
          }}
        >
          <div
            className="hdud-login-grid"
            style={{
              width: "100%",
              maxWidth: 1720,
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) 370px",
              gap: 28,
              alignItems: "center",
            }}
          >
            <div
              className="hdud-center-copy-panel"
              style={{
                minHeight: 680,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
              }}
            >
              <div
                className="hdud-center-copy"
                style={{
                  width: "100%",
                  maxWidth: 620,
                  padding: "20px 24px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  textAlign: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    width: "fit-content",
                    padding: "10px 16px",
                    borderRadius: 999,
                    border: `1px solid rgba(255,255,255,0.84)`,
                    background: "rgba(255,255,255,0.58)",
                    boxShadow: "0 12px 28px rgba(15,23,42,0.06)",
                    color: ui.primary,
                    fontSize: 13,
                    fontWeight: 600,
                    letterSpacing: 0.15,
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                    marginBottom: 22,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: ui.primary,
                      boxShadow: "0 0 0 6px rgba(11,79,138,0.10)",
                      flexShrink: 0,
                    }}
                  />
                  HDUD — Epicentro Vivo das Histórias Humanas
                </div>

                <h1
                  style={{
                    margin: 0,
                    maxWidth: 600,
                    color: ui.ink,
                    fontSize: 60,
                    lineHeight: 1.02,
                    letterSpacing: -1.8,
                    fontWeight: 700,
                    textShadow: "0 8px 26px rgba(255,255,255,0.32)",
                  }}
                >
                  Toda vida guarda uma história que o mundo ainda não ouviu.
                </h1>

                <p
                  style={{
                    margin: "22px 0 0",
                    maxWidth: 500,
                    color: ui.muted,
                    fontSize: 18,
                    lineHeight: 1.72,
                    textShadow: "0 6px 20px rgba(255,255,255,0.28)",
                  }}
                >
                  Um ecossistema vivo onde memórias, capítulos e identidade se organizam em
                  narrativa, legado e valor.
                </p>
              </div>
            </div>

            <div
              className="hdud-investor-card hdud-card-shine"
              style={{
                position: "relative",
                width: "100%",
                background: ui.card,
                border: `1px solid rgba(255,255,255,0.84)`,
                borderRadius: 34,
                boxShadow: ui.shadow,
                padding: 30,
                boxSizing: "border-box",
                overflow: "hidden",
                backdropFilter: "blur(18px)",
                WebkitBackdropFilter: "blur(18px)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(180deg, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0.06) 44%, rgba(15,23,42,0.02) 100%)",
                  pointerEvents: "none",
                }}
              />

              <div
                style={{
                  position: "absolute",
                  inset: 10,
                  borderRadius: 26,
                  border: "1px solid rgba(255,255,255,0.3)",
                  pointerEvents: "none",
                }}
              />

              <div style={{ position: "relative", zIndex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    textAlign: "center",
                    marginBottom: 22,
                  }}
                >
                  <div
                    style={{
                      width: 108,
                      height: 108,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "rgba(11, 79, 138, 0.07)",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55)",
                      marginBottom: 16,
                    }}
                  >
                    <img
                      src="/logo_hdud.png"
                      alt="HDUD"
                      style={{
                        width: 66,
                        height: 66,
                        objectFit: "contain",
                        display: "block",
                        userSelect: "none",
                      }}
                      draggable={false}
                    />
                  </div>

                  <div
                    className="hdud-login-brand-title"
                    style={{
                      margin: 0,
                      fontSize: 27,
                      lineHeight: 1.18,
                      letterSpacing: -0.6,
                      fontWeight: 800,
                      color: ui.ink,
                      maxWidth: 270,
                    }}
                  >
                    HDUD — Epicentro Vivo das Histórias Humanas
                  </div>

                  <p
                    style={{
                      margin: "12px 0 0",
                      color: ui.muted,
                      fontSize: 14,
                      lineHeight: 1.65,
                      maxWidth: 290,
                    }}
                  >
                    Entre para continuar escrevendo sua história.
                  </p>
                </div>

                <div
                  style={{
                    textAlign: "center",
                    fontSize: 13,
                    color: ui.softMuted,
                    letterSpacing: 0.2,
                    marginTop: -2,
                    marginBottom: 18,
                  }}
                >
                  Histórias de um Desconhecido até então
                </div>

                {notice ? (
                  <div
                    style={{
                      background: ui.noticeBg,
                      border: `1px solid ${ui.noticeBorder}`,
                      color: ui.noticeInk,
                      borderRadius: 16,
                      padding: "12px 14px",
                      marginBottom: 14,
                      fontSize: 13,
                      lineHeight: 1.45,
                      boxShadow: "0 8px 20px rgba(11,79,138,0.05)",
                    }}
                  >
                    {notice}
                  </div>
                ) : null}

                {errorMsg ? (
                  <div
                    style={{
                      background: ui.errorBg,
                      border: `1px solid ${ui.errorBorder}`,
                      color: ui.errorInk,
                      borderRadius: 16,
                      padding: "12px 14px",
                      marginBottom: 14,
                      fontSize: 13,
                      lineHeight: 1.45,
                    }}
                  >
                    {errorMsg}
                  </div>
                ) : null}

                <form onSubmit={handleSubmit}>
                  <div style={{ marginBottom: 14 }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: 12,
                        color: ui.muted,
                        marginBottom: 8,
                        fontWeight: 600,
                        letterSpacing: 0.12,
                      }}
                    >
                      E-mail
                    </label>
                    <input
                      className="hdud-input"
                      style={fieldStyle}
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      placeholder="seu@email.com"
                    />
                  </div>

                  <div style={{ marginBottom: 18 }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: 12,
                        color: ui.muted,
                        marginBottom: 8,
                        fontWeight: 600,
                        letterSpacing: 0.12,
                      }}
                    >
                      Senha
                    </label>
                    <input
                      className="hdud-input"
                      style={fieldStyle}
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      placeholder="••••••••••"
                    />
                  </div>

                  <button
                    className="hdud-login-btn"
                    type="submit"
                    disabled={!canSubmit}
                    style={{
                      width: "100%",
                      height: 54,
                      borderRadius: 18,
                      border: "none",
                      background: canSubmit ? ui.primary : "rgba(11, 79, 138, 0.35)",
                      color: "white",
                      fontWeight: 700,
                      fontSize: 15,
                      letterSpacing: 0.2,
                      cursor: canSubmit ? "pointer" : "not-allowed",
                      transition: "transform 120ms ease, filter 120ms ease, box-shadow 120ms ease",
                      boxShadow: canSubmit
                        ? "0 18px 40px rgba(11, 79, 138, 0.26)"
                        : "none",
                    }}
                  >
                    {loading ? "Entrando..." : "Entrar"}
                  </button>
                </form>

                <div
                  style={{
                    marginTop: 20,
                    paddingTop: 16,
                    borderTop: `1px solid rgba(15,23,42,0.08)`,
                    textAlign: "center",
                    color: ui.softMuted,
                    fontSize: 12,
                    lineHeight: 1.6,
                  }}
                >
                  Cada vida carrega memórias, capítulos e um legado que merece existir.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}