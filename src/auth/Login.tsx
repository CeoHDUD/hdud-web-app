// C:\HDUD_DATA\hdud-web-app\src\auth\Login.tsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { setAuthTokens } from "../lib/api";

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

export default function Login({ onLoggedIn }: Props) {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const ui = {
    bg: "#FBF5E9",
    card: "#FFFDF8",
    ink: "#0F172A",
    muted: "rgba(15, 23, 42, 0.68)",
    border: "rgba(15, 23, 42, 0.14)",
    shadow: "0 12px 40px rgba(2, 6, 23, 0.10)",
    primary: "#0B4F8A",
    inputBg: "rgba(255, 255, 255, 0.9)",
    errorBg: "#FFF4F4",
    errorBorder: "rgba(220, 38, 38, 0.35)",
  };

  const fieldStyle = {
    width: "100%",
    height: 46,
    padding: "0 12px",
    fontSize: 14,
    borderRadius: 12,
    border: `1px solid ${ui.border}`,
    background: ui.inputBg,
    color: ui.ink,
    outline: "none",
    boxSizing: "border-box" as const,
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
        throw new Error(t || `Falha no login (HTTP ${res.status}).`);
      }

      const data = (await res.json()) as LoginResponse;

      const accessToken = (data.access_token ?? data.accessToken ?? "").trim();
      const refreshToken = (data.refresh_token ?? data.refreshToken ?? "").trim();

      const user = data.user ?? {};
      const authorId = user.authorId ?? user.author_id ?? null;

      if (!accessToken) throw new Error("Login retornou sem access token.");

      // ✅ 1 fonte de verdade p/ tokens e ids
      setAuthTokens(accessToken, refreshToken || undefined, authorId);

      // ✅ CRÍTICO: destrava o App (state) sem depender só de navigate()
      onLoggedIn(accessToken);

      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      setErrorMsg(err?.message || "Erro inesperado no login.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: ui.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: ui.card,
          border: `1px solid ${ui.border}`,
          borderRadius: 18,
          boxShadow: ui.shadow,
          padding: 32,
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
          <img
            src="/logo_hdud.png"
            alt="HDUD"
            style={{
              width: 160,
              height: "auto",
              display: "block",
              userSelect: "none",
            }}
            draggable={false}
          />
        </div>

        <div
          style={{
            textAlign: "center",
            fontSize: 13,
            color: ui.muted,
            letterSpacing: 0.2,
            marginTop: 2,
            marginBottom: 14,
          }}
        >
          Histórias de um Desconhecido até então
        </div>

        <div
          style={{
            height: 1,
            background: ui.border,
            opacity: 0.55,
            margin: "0 0 18px",
          }}
        />

        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <h1 style={{ margin: 0, fontSize: 28, letterSpacing: -0.4 }}>Entrar</h1>
          <p style={{ margin: "6px 0 0", color: ui.muted, fontSize: 13 }}>
            Entre para continuar
          </p>
        </div>

        {errorMsg ? (
          <div
            style={{
              background: ui.errorBg,
              border: `1px solid ${ui.errorBorder}`,
              color: "rgba(153, 27, 27, 0.95)",
              borderRadius: 12,
              padding: "10px 12px",
              marginBottom: 14,
              fontSize: 13,
              lineHeight: 1.35,
            }}
          >
            {errorMsg}
          </div>
        ) : null}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 12, color: ui.muted, marginBottom: 6 }}>
              E-mail
            </label>
            <input
              style={fieldStyle}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="seu@email.com"
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, color: ui.muted, marginBottom: 6 }}>
              Senha
            </label>
            <input
              style={fieldStyle}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              width: "100%",
              height: 46,
              borderRadius: 14,
              border: "none",
              background: canSubmit ? ui.primary : "rgba(11, 79, 138, 0.35)",
              color: "white",
              fontWeight: 700,
              fontSize: 14,
              cursor: canSubmit ? "pointer" : "not-allowed",
              transition: "filter 120ms ease",
            }}
            onMouseEnter={(e) => {
              if (!canSubmit) return;
              (e.currentTarget as HTMLButtonElement).style.filter = "brightness(0.95)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.filter = "none";
            }}
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>

          <p
            style={{
              margin: "14px 0 0",
              fontSize: 12,
              color: ui.muted,
              textAlign: "center",
              lineHeight: 1.35,
            }}
          >
            Dica: se o token expirar, o HDUD vai te redirecionar para o login automaticamente.
          </p>
        </form>
      </div>
    </div>
  );
}
