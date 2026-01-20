// C:\HDUD_DATA\hdud-web-app\src\auth\Login.tsx
import { useState } from "react";
import { authApi } from "../sdk/hdud";

type Props = {
  onLoggedIn: (accessToken: string) => void;
};

export default function Login({ onLoggedIn }: Props) {
  const [email, setEmail] = useState("dba.alexandre.neves@gmail.com");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      const api = authApi();

      const res: any = await (api as any).authLoginPost({
        authLoginRequest: { email, password },
      });

      const accessToken = res.access_token ?? res.accessToken ?? res.token;
      const refreshToken = res.refresh_token ?? res.refreshToken ?? "";
      const user = res.user ?? {};
      const authorId = user.authorId ?? user.author_id ?? "";

      if (!accessToken) throw new Error("Login retornou sem access token.");

      localStorage.setItem("hdud_access_token", String(accessToken));
      localStorage.setItem("access_token", String(accessToken));
      localStorage.setItem("token", String(accessToken));
      localStorage.setItem("refresh_token", String(refreshToken));
      localStorage.setItem("author_id", String(authorId ?? ""));
      localStorage.setItem("user_id", String(user.userId ?? user.user_id ?? ""));
      localStorage.setItem("email", String(user.email ?? ""));

      onLoggedIn(String(accessToken));
    } catch (e: any) {
      setError(e?.message ?? "Falha no login.");
    } finally {
      setLoading(false);
    }
  }

  function onEnter(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") submit();
  }

  const ui = {
    bg: "#FBF5E9",
    card: "#FFFDF8",
    ink: "#0F172A",
    muted: "rgba(15, 23, 42, 0.68)",
    border: "rgba(15, 23, 42, 0.14)",
    shadow: "0 12px 40px rgba(2, 6, 23, 0.10)",
    primary: "#0B4F8A",
    primaryHover: "#0A4578",
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
    outline: "none",
    background: ui.inputBg,
    boxSizing: "border-box" as const, // ✅ garante simetria visual
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: ui.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        color: ui.ink,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          background: ui.card,
          border: `1px solid ${ui.border}`,
          borderRadius: 18,
          boxShadow: ui.shadow,
          padding: 32, // ✅ padding uniforme (corrige percepção direita/esquerda)
          boxSizing: "border-box",
        }}
      >
        {/* Logo */}
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

        {/* Headline */}
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <h1 style={{ margin: 0, fontSize: 28, letterSpacing: -0.4 }}>Entrar</h1>
          <p style={{ margin: "8px 0 0", color: ui.muted, fontSize: 13.5 }}>
            Autenticação via SDK (@hdud/sdk). Bem-vindo ao seu espaço de memórias.
          </p>
        </div>

        {/* Form */}
        <div style={{ display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, color: ui.muted }}>Email</div>
            <input
              style={fieldStyle}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={onEnter}
              placeholder="email@dominio.com"
              autoComplete="username"
              inputMode="email"
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, color: ui.muted }}>Senha</div>
            <input
              style={fieldStyle}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={onEnter}
              placeholder="Sua senha"
              autoComplete="current-password"
            />
          </label>

          <button
            onClick={submit}
            disabled={loading}
            style={{
              ...fieldStyle,              // ✅ exatamente o mesmo box dos inputs
              borderRadius: 999,
              background: ui.primary,
              color: "white",
              fontWeight: 800,
              letterSpacing: 0.2,
              cursor: loading ? "not-allowed" : "pointer",
              boxShadow: "0 10px 24px rgba(11, 79, 138, 0.22)",
            }}
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>

          {error && (
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                border: `1px solid ${ui.errorBorder}`,
                background: ui.errorBg,
                fontSize: 13.5,
              }}
            >
              <strong>Erro:</strong> {error}
            </div>
          )}

          <div style={{ textAlign: "center", marginTop: 2 }}>
            <span style={{ fontSize: 12.5, color: ui.muted }}>
              Dica: pressione <strong>Enter</strong> para entrar.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
