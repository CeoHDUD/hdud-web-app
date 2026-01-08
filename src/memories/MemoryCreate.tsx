import { useState } from "react";
import { authorsApi } from "../sdk/hdud";

export default function MemoryCreate({
  authorId,
  onCreated,
}: {
  authorId: number;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("access_token");
      if (!token) throw new Error("Token não encontrado. Faça login novamente.");

      const aId = Number(authorId);
      if (!aId || Number.isNaN(aId)) {
        throw new Error("authorId inválido (resolução falhou).");
      }

      const api = authorsApi(token);

      await api.authorsAuthorIdMemoriesPost({
        authorId: aId,
        memoryCreateRequest: { title, content },
      });

      setTitle("");
      setContent("");
      onCreated();
    } catch (e: any) {
      // captura o erro HTTP real (status + body), quando existir
      try {
        const status = e?.response?.status;
        const text = e?.response ? await e.response.text() : null;

        setError(
          `HTTP ${status ?? "?"} — ${
            text ?? e?.message ?? "Erro ao criar memória."
          }`
        );
      } catch {
        setError(e?.message ?? "Erro ao criar memória.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ marginTop: 24 }}>
      <h3>Criar Memória</h3>

      <input
        style={{ width: "100%", padding: 10, marginBottom: 8 }}
        placeholder="Título"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <textarea
        style={{ width: "100%", padding: 10, minHeight: 120 }}
        placeholder="Conteúdo"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />

      <button
        onClick={submit}
        disabled={loading || !title.trim() || !content.trim()}
        style={{
          marginTop: 12,
          padding: "12px 18px",
          fontWeight: 800,
          fontSize: 14,
          borderRadius: 10,
          border: "2px solid #111",
          cursor: "pointer",
          background: loading ? "#bbb" : "#111",
          color: loading ? "#333" : "#fff",
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? "Salvando..." : "Salvar memória"}
      </button>

      <div style={{ marginTop: 8, opacity: 0.8, fontSize: 12 }}>
        {loading ? "Executando POST no backend..." : "Pronto para salvar."}
      </div>

      {error && (
        <div style={{ color: "red", marginTop: 8, whiteSpace: "pre-wrap" }}>
          {error}
        </div>
      )}
    </div>
  );
}
