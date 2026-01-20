// C:\HDUD_DATA\hdud-web-app\src\memories\MemoriesPage.tsx

import { useEffect, useMemo, useRef, useState } from "react";
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
  onLogout: () => void; // mantido por compatibilidade, mesmo sem botão aqui
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
        try {
          return JSON.parse(text);
        } catch {
          return null;
        }
      })()
    : null;

  if (!res.ok) {
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

function normalizeTitleForCompare(s: string) {
  return String(s ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export default function MemoriesPage({ token }: Props) {
  const nav = useNavigate();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const errorTimerRef = useRef<number | null>(null);

  const [items, setItems] = useState<MemoryItem[]>([]);

  const countLabel = useMemo(() => `${items.length} item(ns)`, [items.length]);

  // ✅ Tokens de tema com fallback
  const t = useMemo(() => {
    return {
      pageBg: "var(--hdud-bg, #f6f7fb)",
      surface: "var(--hdud-surface, #ffffff)",
      surface2: "var(--hdud-surface-2, #fafafa)",
      text: "var(--hdud-text, #0f172a)",
      text2: "var(--hdud-text-2, rgba(15, 23, 42, 0.75))",
      border: "var(--hdud-border, #d7dbe7)",
      borderSoft: "var(--hdud-border-soft, #eef0f6)",
      accentBg: "var(--hdud-accent-bg, #eef2ff)",
      accentBorder: "var(--hdud-accent-border, #dfe7ff)",
      errBg: "var(--hdud-err-bg, #fff5f5)",
      errBorder: "var(--hdud-err-border, #f3bcbc)",
      errText: "var(--hdud-err-text, #a31212)",
      btnPrimaryBg: "var(--hdud-btn-primary-bg, #0f172a)",
      btnPrimaryText: "var(--hdud-btn-primary-text, #ffffff)",
      shadow: "var(--hdud-shadow, 0 14px 30px rgba(20,20,40,.08))",
    };
  }, []);

  function setErrorWithAutoHide(msg: string) {
    setError(msg);
    if (errorTimerRef.current) window.clearTimeout(errorTimerRef.current);
    errorTimerRef.current = window.setTimeout(() => setError(null), 6000);
  }

  function closeError() {
    if (errorTimerRef.current) window.clearTimeout(errorTimerRef.current);
    errorTimerRef.current = null;
    setError(null);
  }

  async function load() {
    closeError();
    setLoading(true);
    try {
      const data = await api<ListResponse>(`/authors/1/memories`, token);
      setItems(Array.isArray(data?.memories) ? data.memories : []);
    } catch (e: any) {
      setItems([]);
      setErrorWithAutoHide(e?.message ?? "Falha ao carregar histórico.");
    } finally {
      setLoading(false);
    }
  }

  async function create() {
    closeError();

    const contentTrim = content.trim();
    if (!contentTrim) {
      setErrorWithAutoHide("Conteúdo é obrigatório.");
      return;
    }

    // ✅ Bloqueio de título duplicado (frontend-only)
    const titleTrim = title.trim();
    if (titleTrim) {
      const wanted = normalizeTitleForCompare(titleTrim);
      const exists = items.some((m) => {
        const current = normalizeTitleForCompare(m.title ?? "");
        return current && current === wanted && !m.is_deleted;
      });

      if (exists) {
        setErrorWithAutoHide("Já existe uma memória com esse título.");
        return;
      }
    }

    setCreating(true);
    try {
      const payload = {
        title: titleTrim ? titleTrim : null,
        content: contentTrim,
      };

      await api<MemoryItem>(`/authors/1/memories`, token, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setTitle("");
      setContent("");
      await load();
    } catch (e: any) {
      setErrorWithAutoHide(e?.message ?? "Falha ao criar memória.");
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    load();
    return () => {
      if (errorTimerRef.current) window.clearTimeout(errorTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: t.pageBg, color: t.text }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 28px 40px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
          }}
        >
          <div>
            <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1.05 }}>
              Minhas Memórias
            </div>
            <div style={{ marginTop: 8, color: t.text2 }}>
              Demo v0.1 — fetch via <b>/api</b> (SDK desabilitado).
            </div>
          </div>

          {/* ✅ Removido botão "Sair" daqui (fica só no Topbar) */}
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              onClick={load}
              disabled={loading}
              style={{
                padding: "10px 16px",
                borderRadius: 12,
                border: `1px solid ${t.border}`,
                background: t.surface,
                color: t.text,
                fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Atualizando..." : "Atualizar"}
            </button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1.2fr",
            gap: 18,
            marginTop: 18,
          }}
        >
          <div
            style={{
              background: t.surface,
              borderRadius: 18,
              boxShadow: t.shadow,
              padding: 18,
              border: `1px solid ${t.borderSoft}`,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>Criar nova memória</div>
                <div style={{ fontSize: 12, color: t.text2 }}>
                  Título opcional, conteúdo obrigatório.
                </div>
              </div>

              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  background: t.accentBg,
                  border: `1px solid ${t.accentBorder}`,
                  padding: "6px 10px",
                  borderRadius: 999,
                  color: t.text,
                }}
              >
                {countLabel}
              </div>
            </div>

            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 800,
                color: t.text2,
                marginTop: 10,
              }}
            >
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
                border: `1px solid ${t.border}`,
                outline: "none",
                background: t.surface,
                color: t.text,
              }}
            />

            <label
              style={{
                display: "block",
                fontSize: 12,
                fontWeight: 800,
                color: t.text2,
                marginTop: 14,
              }}
            >
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
                border: `1px solid ${t.border}`,
                outline: "none",
                resize: "vertical",
                background: t.surface,
                color: t.text,
              }}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
              <button
                onClick={() => {
                  setTitle("");
                  setContent("");
                  closeError();
                }}
                style={{
                  padding: "10px 16px",
                  borderRadius: 12,
                  border: `1px solid ${t.border}`,
                  background: t.surface,
                  color: t.text,
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
                  border: `1px solid ${t.btnPrimaryBg}`,
                  background: t.btnPrimaryBg,
                  color: t.btnPrimaryText,
                  fontWeight: 900,
                  cursor: creating ? "not-allowed" : "pointer",
                }}
              >
                {creating ? "Criando..." : "Criar memória"}
              </button>
            </div>

            {error && (
              <div
                style={{
                  marginTop: 14,
                  padding: 12,
                  borderRadius: 12,
                  border: `1px solid ${t.errBorder}`,
                  background: t.errBg,
                  color: t.errText,
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 12,
                  fontWeight: 800,
                }}
                role="alert"
                aria-live="polite"
              >
                <div style={{ lineHeight: 1.35 }}>
                  <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 4 }}>
                    Atenção
                  </div>
                  <div style={{ fontSize: 14 }}>{error}</div>
                </div>

                <button
                  type="button"
                  onClick={closeError}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: `1px solid ${t.errBorder}`,
                    background: t.surface,
                    color: t.errText,
                    fontWeight: 900,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                  aria-label="Fechar mensagem"
                >
                  Fechar
                </button>
              </div>
            )}

            <div style={{ marginTop: 22, fontSize: 12, color: t.text2 }}>
              HDUD • MVP v0.1 • 2026
            </div>
          </div>

          <div
            style={{
              background: t.surface,
              borderRadius: 18,
              boxShadow: t.shadow,
              padding: 18,
              display: "flex",
              flexDirection: "column",
              minHeight: 520,
              border: `1px solid ${t.borderSoft}`,
            }}
          >
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>Histórico</div>
              <div style={{ fontSize: 12, color: t.text2 }}>
                Clique em um card para abrir detalhes e versões.
              </div>
            </div>

            <div style={{ overflow: "auto", paddingRight: 6 }}>
              {items.length === 0 && (
                <div style={{ marginTop: 12, color: t.text2 }}>
                  Nenhuma memória encontrada.
                </div>
              )}

              {items.map((m) => (
                <div
                  key={m.memory_id}
                  onClick={() => nav(`/memories/${m.memory_id}`)}
                  style={{
                    border: `1px solid ${t.borderSoft}`,
                    borderRadius: 14,
                    padding: 14,
                    marginBottom: 10,
                    cursor: "pointer",
                    background: t.surface,
                    color: t.text,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontWeight: 900 }}>
                      {m.title?.trim() ? m.title : `(sem título) #${m.memory_id}`}
                    </div>
                    <div style={{ fontSize: 12, color: t.text2, whiteSpace: "nowrap" }}>
                      {formatDate(m.created_at)}
                    </div>
                  </div>

                  {m.content && (
                    <div style={{ marginTop: 6, color: "var(--hdud-text-3, rgba(15, 23, 42, 0.85))" }}>
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
