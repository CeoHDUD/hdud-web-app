import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

type MemoryItem = {
  memory_id: number;
  author_id: number;
  title: string | null;
  content: string | null;
  created_at: string;
  version_number?: number;
  is_deleted?: boolean;
};

type ListResponse = {
  author_id: number;
  memories: MemoryItem[];
};

type Props = {
  token: string;
  onLogout: () => void;
};

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", { hour12: false });
  } catch {
    return iso;
  }
}

async function api<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });

  const text = await res.text();
  const json = text
    ? (() => {
        try { return JSON.parse(text); } catch { return null; }
      })()
    : null;

  if (!res.ok) {
    // Ajuda quando o Vite não está proxyando /api e devolve 404 HTML/texto.
    const msgFromJson = json && (json.error || json.message);
    const msg =
      msgFromJson ||
      (res.status === 404 && `${text}`.includes("Not Found")
        ? "Not Found — verifique o proxy do Vite para /api (deve apontar para http://hdud-api:4000)."
        : `HTTP ${res.status}`);

    throw new Error(msg);
  }

  return (json ?? ({} as any)) as T;
}

export default function MemoriesPage({ token, onLogout }: Props) {
  const nav = useNavigate();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [items, setItems] = useState<MemoryItem[]>([]);

  const countLabel = useMemo(() => `${items.length} item(ns)`, [items.length]);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const data = await api<ListResponse>(`/authors/1/memories`, token);
      setItems(Array.isArray(data?.memories) ? data.memories : []);
    } catch (e: any) {
      setItems([]);
      setError(e?.message ?? "Falha ao carregar histórico.");
    } finally {
      setLoading(false);
    }
  }

  async function create() {
    setError(null);
    if (!content.trim()) {
      setError("Conteúdo é obrigatório.");
      return;
    }

    setCreating(true);
    try {
      const payload = {
        title: title.trim() ? title.trim() : null,
        content: content.trim(),
      };

      await api<MemoryItem>(`/authors/1/memories`, token, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setTitle("");
      setContent("");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Falha ao criar memória.");
    } finally {
      setCreating(false);
    }
  }

  function logout() {
    onLogout();
    nav("/");
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#f6f7fb" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 28px 40px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <div>
            <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1.05 }}>Minhas Memórias</div>
            <div style={{ marginTop: 8, opacity: 0.75 }}>
              Demo v0.1 — fetch via <b>/api</b> (SDK desabilitado).
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              onClick={load}
              disabled={loading}
              style={{
                padding: "10px 16px",
                borderRadius: 12,
                border: "1px solid #d7dbe7",
                background: "white",
                fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Atualizando..." : "Atualizar"}
            </button>

            <button
  onClick={onLogout}
  className="btn btn-outline-danger"
>
  Sair
</button>

          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 18, marginTop: 18 }}>
          <div
            style={{
              background: "white",
              borderRadius: 18,
              boxShadow: "0 14px 30px rgba(20,20,40,.08)",
              padding: 18,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>Criar nova memória</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Título opcional, conteúdo obrigatório.</div>
              </div>

              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  background: "#eef2ff",
                  border: "1px solid #dfe7ff",
                  padding: "6px 10px",
                  borderRadius: 999,
                }}
              >
                {countLabel}
              </div>
            </div>

            <label style={{ display: "block", fontSize: 12, fontWeight: 800, opacity: 0.75, marginTop: 10 }}>
              Título
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Primeira memória de 2026"
              style={{
                width: "100%",
                marginTop: 6,
                padding: "12px 12px",
                borderRadius: 12,
                border: "1px solid #d7dbe7",
                outline: "none",
              }}
            />

            <label style={{ display: "block", fontSize: 12, fontWeight: 800, opacity: 0.75, marginTop: 14 }}>
              Conteúdo
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Escreva aqui..."
              rows={10}
              style={{
                width: "100%",
                marginTop: 6,
                padding: "12px 12px",
                borderRadius: 12,
                border: "1px solid #d7dbe7",
                outline: "none",
                resize: "vertical",
              }}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
              <button
                onClick={() => { setTitle(""); setContent(""); setError(null); }}
                style={{
                  padding: "10px 16px",
                  borderRadius: 12,
                  border: "1px solid #d7dbe7",
                  background: "white",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Limpar
              </button>

              <button
                onClick={create}
                disabled={creating}
                style={{
                  padding: "10px 16px",
                  borderRadius: 12,
                  border: "1px solid #0f172a",
                  background: "#0f172a",
                  color: "white",
                  fontWeight: 900,
                  cursor: creating ? "not-allowed" : "pointer",
                }}
              >
                {creating ? "Criando..." : "Criar memória"}
              </button>
            </div>

            {error && (
              <div style={{ marginTop: 12, color: "#c01515", fontWeight: 700 }}>
                {error}
              </div>
            )}

            <div style={{ marginTop: 22, fontSize: 12, opacity: 0.65 }}>
              HDUD • MVP v0.1 • 2026
            </div>
          </div>

          <div
            style={{
              background: "white",
              borderRadius: 18,
              boxShadow: "0 14px 30px rgba(20,20,40,.08)",
              padding: 18,
              display: "flex",
              flexDirection: "column",
              minHeight: 520,
            }}
          >
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>Histórico</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                Clique em um card para abrir detalhes e versões.
              </div>
            </div>

            <div style={{ overflow: "auto", paddingRight: 6 }}>
              {items.length === 0 && (
                <div style={{ marginTop: 12, opacity: 0.7 }}>Nenhuma memória encontrada.</div>
              )}

              {items.map((m) => (
                <div
                  key={m.memory_id}
                  onClick={() => nav(`/memories/${m.memory_id}`)}
                  style={{
                    border: "1px solid #eef0f6",
                    borderRadius: 14,
                    padding: 14,
                    marginBottom: 10,
                    cursor: "pointer",
                    background: "#fff",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontWeight: 900 }}>
                      {m.title?.trim() ? m.title : `(sem título) #${m.memory_id}`}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.7, whiteSpace: "nowrap" }}>
                      {formatDate(m.created_at)}
                    </div>
                  </div>

                  {m.content && (
                    <div style={{ marginTop: 6, opacity: 0.85 }}>
                      {m.content.length > 90 ? m.content.slice(0, 90) + "…" : m.content}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
