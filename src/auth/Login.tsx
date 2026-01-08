import { useState } from "react";
import { authApi } from "../sdk/hdud";

type Props = {
  onLoggedIn: (accessToken: string) => void;
};

export default function Login({ onLoggedIn }: Props) {
  const [email, setEmail] = useState("dba.alexandre.neves@gmail.com");
  const [password, setPassword] = useState("SenhaForte#2025");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);

    try {
      const api = authApi();

      // SDK usa wrapper "authLoginRequest"
      const res: any = await (api as any).authLoginPost({
        authLoginRequest: { email, password },
      });

      // Normaliza nomes (snake_case vs camelCase)
      const accessToken = res.access_token ?? res.accessToken ?? res.token;
      const refreshToken = res.refresh_token ?? res.refreshToken ?? "";
      const user = res.user ?? {};
      const authorId = user.authorId ?? user.author_id ?? "";

      if (!accessToken) throw new Error("Login retornou sem access token.");

      // Storage padrão v0.1 (compatível)
      localStorage.setItem("hdud_access_token", String(accessToken)); // ✅ usado pelo App.tsx
      localStorage.setItem("access_token", String(accessToken));      // compat
      localStorage.setItem("token", String(accessToken));             // compat
      localStorage.setItem("refresh_token", String(refreshToken));
      localStorage.setItem("author_id", String(authorId ?? ""));
      localStorage.setItem("user_id", String(user.userId ?? user.user_id ?? ""));
      localStorage.setItem("email", String(user.email ?? ""));

      // Entrega para o App trocar de tela
      onLoggedIn(String(accessToken));
    } catch (e: any) {
      setError(e?.message ?? "Falha no login.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 520 }}>
      <h2 style={{ margin: 0 }}>Login</h2>
      <p style={{ opacity: 0.8 }}>
        Demo mínima — autenticação via SDK (@hdud/sdk).
      </p>

      <div style={{ display: "grid", gap: 12 }}>
        <label>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Email</div>
          <input
            style={{ width: "100%", padding: 10, fontSize: 14 }}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email"
          />
        </label>

        <label>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Senha</div>
          <input
            style={{ width: "100%", padding: 10, fontSize: 14 }}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="senha"
          />
        </label>

        <button
          onClick={submit}
          disabled={loading}
          style={{ padding: 12, fontWeight: 700, cursor: "pointer" }}
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>

        {error && (
          <div style={{ padding: 10, border: "1px solid #444" }}>
            <strong>Erro:</strong> {error}
          </div>
        )}
      </div>
    </div>
  );
}
