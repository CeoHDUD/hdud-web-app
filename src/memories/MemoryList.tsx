import { useEffect, useState } from "react";
import { authorsApi } from "../sdk/hdud";

type Memory = {
  memoryId: number;
  title: string;
  content: string;
  createdAt?: string;
  versionNumber?: number;
  isDeleted?: boolean;
};

export default function MemoryList({
  authorId,
  refresh,
}: {
  authorId: number;
  refresh: number;
}) {
  const [items, setItems] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const token = localStorage.getItem("access_token");
        if (!token) throw new Error("Token não encontrado. Faça login novamente.");

        const aId = Number(authorId);
        if (!aId || Number.isNaN(aId)) throw new Error("authorId inválido.");

        const api = authorsApi(token);

        // SDK wrapper (igual ao POST): objeto com authorId
        const res: any = await api.authorsAuthorIdMemoriesGet({ authorId: aId });

        const list = Array.isArray(res) ? res : (res?.items ?? []);
        if (alive) setItems(list);
      } catch (e: any) {
        try {
          const status = e?.response?.status;
          const text = e?.response ? await e.response.text() : null;
          if (alive) setError(`HTTP ${status ?? "?"} — ${text ?? e?.message}`);
        } catch {
          if (alive) setError(e?.message ?? "Erro ao listar memórias.");
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [authorId, refresh]);

  return (
    <div style={{ marginTop: 24 }}>
      <h3>Memórias</h3>

      {loading && <div style={{ opacity: 0.8 }}>Carregando...</div>}
      {error && <div style={{ color: "red", marginTop: 8 }}>{error}</div>}

      {!loading && !error && items.length === 0 && (
        <div style={{ opacity: 0.8 }}>Nenhuma memória encontrada.</div>
      )}

      <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
        {items.map((m) => (
          <div
            key={m.memoryId ?? (m as any).memory_id}
            style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}
          >
            <div style={{ fontWeight: 800 }}>
              {m.title ?? (m as any).title}
            </div>
            <div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>
              {m.content ?? (m as any).content}
            </div>
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
              id: {m.memoryId ?? (m as any).memory_id} · v
              {m.versionNumber ?? (m as any).version_number ?? "?"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
