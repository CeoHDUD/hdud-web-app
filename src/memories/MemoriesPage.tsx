// C:\HDUD_DATA\hdud-web-app\src\memories\MemoriesPage.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

type MemoryListItem = {
  memory_id: number;
  author_id?: number;
  title: string | null;
  content: string;
  created_at: string;
  meta?: {
    can_edit?: boolean;
    current_version?: number;
  };
};

type MemoriesResponse = {
  author_id: number;
  memories: any[];
};

type TimelineResponse = {
  ok?: boolean;
  items?: any[];
};

const API_BASE = "/api";

// Mantém compat com as chaves que já apareceram nos seus testes/prints
function getTokenFromStorage(): string | null {
  return (
    localStorage.getItem("HDUD_TOKEN") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("token")
  );
}

function getAuthorIdFromStorage(): number | null {
  const raw =
    localStorage.getItem("HDUD_AUTHOR_ID") ||
    localStorage.getItem("author_id") ||
    localStorage.getItem("AUTHOR_ID");
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

async function api<T>(
  method: "GET" | "POST",
  path: string,
  token: string,
  body?: any
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const json = text
    ? (() => {
        try {
          return JSON.parse(text);
        } catch {
          return { raw: text };
        }
      })()
    : null;

  if (!res.ok) {
    const detail =
      json && (json.detail || json.error)
        ? json.detail || json.error
        : `HTTP ${res.status}`;
    const err: any = new Error(detail);
    err.status = res.status;
    err.payload = json;
    throw err;
  }

  return json as T;
}

function formatDateBR(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return iso;
  }
}

// Mantido (pode ser útil em outras telas; aqui preferimos clamp por linhas)
function clip(text: string, max: number) {
  const t = (text || "").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function coerceNumber(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeFromLegacy(raw: any): MemoryListItem | null {
  const id = coerceNumber(raw?.memory_id) ?? coerceNumber(raw?.id);
  if (!id) return null;

  return {
    memory_id: id,
    author_id: coerceNumber(raw?.author_id) ?? undefined,
    title: raw?.title === null || raw?.title === undefined ? null : String(raw?.title),
    content: String(raw?.content ?? ""),
    created_at: String(raw?.created_at ?? new Date().toISOString()),
    meta: raw?.meta
      ? {
          can_edit: typeof raw.meta.can_edit === "boolean" ? raw.meta.can_edit : undefined,
          current_version:
            coerceNumber(raw.meta.current_version) ??
            coerceNumber(raw?.version_number) ??
            undefined,
        }
      : {
          current_version: coerceNumber(raw?.version_number) ?? undefined,
        },
  };
}

/**
 * Timeline item (seu curl confirmou):
 * item.raw.memory_id, item.raw.content, item.raw.created_at, item.raw.meta...
 * Além disso, item.source === "memories" quando for memória.
 */
function normalizeFromTimelineItem(item: any): MemoryListItem | null {
  const raw = item?.raw ?? null;
  if (!raw) return null;

  const id = coerceNumber(raw?.memory_id) ?? null;
  if (!id) return null;

  const created =
    raw?.created_at ||
    item?.at ||
    item?.timestamp ||
    new Date().toISOString();

  const metaRaw = raw?.meta ?? null;

  return {
    memory_id: id,
    author_id: coerceNumber(raw?.author_id) ?? undefined,
    title: raw?.title === null || raw?.title === undefined ? null : String(raw?.title),
    content: String(raw?.content ?? ""),
    created_at: String(created),
    meta: {
      can_edit: typeof metaRaw?.can_edit === "boolean" ? metaRaw.can_edit : undefined,
      current_version: coerceNumber(metaRaw?.current_version) ?? undefined,
    },
  };
}

function sortNewestFirst(list: MemoryListItem[]) {
  list.sort((a, b) => {
    const da = new Date(a.created_at).getTime();
    const db = new Date(b.created_at).getTime();
    if (!Number.isFinite(da) || !Number.isFinite(db)) return 0;
    return db - da;
  });
}

export default function MemoriesPage(props: {
  token?: string | null;
  onLogout?: () => void;
}) {
  const navigate = useNavigate();

  // Fonte de verdade: token em storage (porque o App pode passar prop velha)
  const token = useMemo(() => props.token || getTokenFromStorage(), [props.token]);

  const [authorId, setAuthorId] = useState<number | null>(() => getAuthorIdFromStorage());
  const [items, setItems] = useState<MemoryListItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [creating, setCreating] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const hardLogout = useCallback(() => {
    localStorage.removeItem("HDUD_TOKEN");
    localStorage.removeItem("access_token");
    localStorage.removeItem("token");
    localStorage.removeItem("HDUD_AUTHOR_ID");
    localStorage.removeItem("author_id");
    if (props.onLogout) props.onLogout();
    navigate("/login");
  }, [navigate, props]);

  useEffect(() => {
    // Revalida authorId em runtime (caso storage mude)
    const aid = getAuthorIdFromStorage();
    setAuthorId(aid);
  }, []);

  const load = useCallback(async () => {
    setError(null);

    if (!token) {
      setError("Sessão expirada. Faça login novamente.");
      hardLogout();
      return;
    }

    setLoading(true);

    try {
      // 1) Preferencial: /timeline
      let list: MemoryListItem[] = [];

      try {
        const data = await api<TimelineResponse>("GET", `/timeline`, token);
        const all = Array.isArray(data?.items) ? data!.items! : [];

        // Só memórias (não misturar chapters na tela de Memórias)
        const memoriesOnly = all.filter((it: any) => it?.source === "memories");

        list = memoriesOnly
          .map((it: any) => normalizeFromTimelineItem(it))
          .filter(Boolean) as MemoryListItem[];
      } catch (eTimeline: any) {
        // só ignora e tenta legado
        list = [];
      }

      // 2) Fallback inteligente: se timeline veio vazio, tenta legado
      if (list.length === 0) {
        if (!authorId || !Number.isFinite(authorId)) {
          setError("author_id ausente. Faça login novamente.");
          hardLogout();
          return;
        }

        const legacy = await api<MemoriesResponse>("GET", `/authors/${authorId}/memories`, token);
        const rawList = Array.isArray(legacy?.memories) ? legacy.memories : [];
        list = rawList
          .map((m: any) => normalizeFromLegacy(m))
          .filter(Boolean) as MemoryListItem[];
      }

      sortNewestFirst(list);
      setItems(list);
    } catch (e: any) {
      if (e?.status === 401) {
        setError("Sessão expirada. Faça login novamente.");
        hardLogout();
      } else {
        setError(e?.message || "Falha ao carregar memórias.");
      }
    } finally {
      setLoading(false);
    }
  }, [authorId, hardLogout, token]);

  useEffect(() => {
    // Carrega na entrada quando tiver token (timeline não depende de authorId)
    if (token) load();
  }, [token, load]);

  async function create() {
    setError(null);

    if (!token) {
      setError("Sessão expirada. Faça login novamente.");
      hardLogout();
      return;
    }

    if (!authorId || !Number.isFinite(authorId)) {
      setError("author_id ausente. Faça login novamente.");
      hardLogout();
      return;
    }

    if (!content.trim()) {
      setError("Conteúdo é obrigatório.");
      return;
    }

    setCreating(true);
    try {
      // Mantido (legado confirmado): POST /authors/:id/memories
      await api("POST", `/authors/${authorId}/memories`, token, {
        author_id: authorId,
        title: title.trim() ? title.trim() : null,
        content: content,
      });

      setTitle("");
      setContent("");
      await load();
    } catch (e: any) {
      if (e?.status === 401) {
        setError("Sessão expirada. Faça login novamente.");
        hardLogout();
      } else {
        setError(e?.message || "Falha ao criar memória.");
      }
    } finally {
      setCreating(false);
    }
  }

  const countLabel = useMemo(() => `${items.length} item(ns)`, [items.length]);

  // =========================
  // UI — padrão dark premium
  // (somente estética)
  // =========================
  const ui = useMemo(() => {
    const page: React.CSSProperties = {
      padding: 24,
      color: "inherit",
    };

    const container: React.CSSProperties = {
      maxWidth: 1040,
      margin: "0 auto",
    };

    const breadcrumb: React.CSSProperties = {
      fontSize: 12,
      opacity: 0.75,
      marginBottom: 8,
      letterSpacing: 0.2,
    };

    const h1: React.CSSProperties = {
      fontSize: 44,
      fontWeight: 900,
      letterSpacing: -0.6,
      margin: "0 0 6px 0",
    };

    const subtitle: React.CSSProperties = {
      opacity: 0.7,
      marginTop: 0,
      fontSize: 14,
      lineHeight: 1.35,
    };

    const grid: React.CSSProperties = {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 16,
      alignItems: "start",
      marginTop: 18,
    };

    const card: React.CSSProperties = {
      borderRadius: 16,
      padding: 16,
      border: "1px solid rgba(255,255,255,0.08)",
      background: "rgba(17, 24, 39, 0.55)",
      boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
      backdropFilter: "blur(8px)",
    };

    const cardHeaderRow: React.CSSProperties = {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 12,
    };

    const cardTitle: React.CSSProperties = {
      fontSize: 18,
      fontWeight: 800,
      marginBottom: 2,
    };

    const cardDesc: React.CSSProperties = {
      opacity: 0.7,
      marginTop: 4,
      fontSize: 13,
      lineHeight: 1.35,
    };

    const pill: React.CSSProperties = {
      border: "1px solid rgba(255,255,255,0.14)",
      padding: "4px 10px",
      borderRadius: 999,
      fontSize: 12,
      opacity: 0.9,
      whiteSpace: "nowrap",
      background: "rgba(255,255,255,0.04)",
    };

    const label: React.CSSProperties = {
      fontSize: 12,
      fontWeight: 700,
      opacity: 0.85,
      marginBottom: 6,
    };

    const input: React.CSSProperties = {
      width: "100%",
      borderRadius: 12,
      padding: "10px 12px",
      border: "1px solid rgba(255,255,255,0.14)",
      outline: "none",
      background: "rgba(0,0,0,0.22)",
      color: "inherit",
    };

    const textarea: React.CSSProperties = {
      width: "100%",
      borderRadius: 12,
      padding: "10px 12px",
      border: "1px solid rgba(255,255,255,0.14)",
      outline: "none",
      resize: "vertical",
      background: "rgba(0,0,0,0.22)",
      color: "inherit",
    };

    const softButton: React.CSSProperties = {
      borderRadius: 999,
      padding: "8px 14px",
      border: "1px solid rgba(255,255,255,0.16)",
      background: "rgba(255,255,255,0.06)",
      color: "inherit",
      cursor: "pointer",
      fontWeight: 700,
    };

    const primaryButton: React.CSSProperties = {
      borderRadius: 999,
      padding: "8px 14px",
      border: "1px solid rgba(255,255,255,0.18)",
      background: "rgba(255,255,255,0.92)",
      color: "#0b1020",
      cursor: "pointer",
      fontWeight: 800,
    };

    const dangerBox: React.CSSProperties = {
      marginTop: 12,
      padding: 10,
      borderRadius: 12,
      border: "1px solid rgba(239,68,68,0.35)",
      background: "rgba(239,68,68,0.10)",
      color: "rgba(255,255,255,0.92)",
      fontSize: 13,
      whiteSpace: "pre-wrap",
    };

    const listWrap: React.CSSProperties = {
      marginTop: 12,
      display: "flex",
      flexDirection: "column",
      gap: 10,
    };

    const listItem: React.CSSProperties = {
      borderRadius: 14,
      padding: 12,
      border: "1px solid rgba(255,255,255,0.10)",
      background: "rgba(0,0,0,0.22)",
      cursor: "pointer",
    };

    // ✅ Preview compacto por linhas (2–3), sem “textão” na listagem
    const previewClamp: React.CSSProperties = {
      marginTop: 8,
      opacity: 0.88,
      fontSize: 13,
      lineHeight: 1.4,
      overflow: "hidden",
      display: "-webkit-box",
      WebkitBoxOrient: "vertical" as any,
      WebkitLineClamp: 3 as any,
      // fallback suave se o clamp não aplicar
      maxHeight: 13 * 1.4 * 3 + 2,
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
    };

    const footerHint: React.CSSProperties = {
      marginTop: 16,
      opacity: 0.65,
      fontSize: 12,
    };

    const splitRow: React.CSSProperties = {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 14,
      gap: 12,
      flexWrap: "wrap",
    };

    const rightActions: React.CSSProperties = {
      display: "flex",
      gap: 10,
      flexWrap: "wrap",
      justifyContent: "flex-end",
    };

    return {
      page,
      container,
      breadcrumb,
      h1,
      subtitle,
      grid,
      card,
      cardHeaderRow,
      cardTitle,
      cardDesc,
      pill,
      label,
      input,
      textarea,
      softButton,
      primaryButton,
      dangerBox,
      listWrap,
      listItem,
      previewClamp,
      footerHint,
      splitRow,
      rightActions,
    };
  }, []);

  return (
    <div style={ui.page}>
      <div style={ui.container}>
        <div style={ui.breadcrumb}>Memórias • AppShell mínimo (vNext)</div>

        <div style={{ marginBottom: 10 }}>
          <h1 style={ui.h1}>Minhas Memórias</h1>
          <div style={ui.subtitle}>
            Demo v0.1 — listagem preferencial via <code>/api/timeline</code> (fonte: <code>source=memories</code>).
          </div>
        </div>

        <div style={ui.grid as any}>
          {/* Criar */}
          <div style={ui.card}>
            <div style={ui.cardHeaderRow}>
              <div>
                <div style={ui.cardTitle}>Criar nova memória</div>
                <div style={ui.cardDesc}>Título opcional, conteúdo obrigatório.</div>
              </div>

              <div style={ui.pill}>{countLabel}</div>
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={ui.label}>Título</div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: Primeira memória de 2026"
                style={ui.input}
              />
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={ui.label}>Conteúdo</div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Escreva aqui..."
                rows={8}
                style={ui.textarea}
              />
            </div>

            {error && (
              <div style={ui.dangerBox}>
                <b>Erro:</b> {error}
              </div>
            )}

            <div style={ui.splitRow}>
              <button
                onClick={load}
                disabled={loading}
                style={{
                  ...ui.softButton,
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? "Atualizando..." : "Atualizar"}
              </button>

              <div style={ui.rightActions}>
                <button
                  onClick={() => {
                    setTitle("");
                    setContent("");
                    setError(null);
                  }}
                  style={ui.softButton}
                >
                  Limpar
                </button>

                <button
                  onClick={create}
                  disabled={creating}
                  style={{
                    ...ui.primaryButton,
                    cursor: creating ? "not-allowed" : "pointer",
                    opacity: creating ? 0.75 : 1,
                  }}
                >
                  {creating ? "Criando..." : "Criar memória"}
                </button>
              </div>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
              Author: {authorId ?? "—"} &nbsp;&nbsp;•&nbsp;&nbsp; HDUD • MVP v0.1 • 2026
            </div>
          </div>

          {/* Histórico */}
          <div style={{ ...ui.card, minHeight: 260 }}>
            <div style={ui.cardHeaderRow}>
              <div>
                <div style={ui.cardTitle}>Histórico</div>
                <div style={ui.cardDesc}>
                  Clique em um card para abrir detalhes e versões.
                  <div style={{ marginTop: 6, opacity: 0.75 }}>
                    UI usa <code>meta.can_edit</code> e <code>meta.current_version</code>.
                  </div>
                </div>
              </div>

              <button
                onClick={load}
                disabled={loading}
                style={{
                  ...ui.softButton,
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? "Atualizando..." : "Atualizar"}
              </button>
            </div>

            <div style={ui.listWrap as any}>
              {!loading && items.length === 0 && (
                <div style={{ padding: 12, opacity: 0.75, fontSize: 13 }}>
                  Nenhuma memória encontrada.
                </div>
              )}

              {items.map((m) => {
                const v = m.meta?.current_version ?? 1;
                const canEdit = m.meta?.can_edit;
                const header = m.title?.trim() ? m.title : `Memória #${m.memory_id}`;
                const full = (m.content || "").trim();

                return (
                  <div
                    key={m.memory_id}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/memories/${m.memory_id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") navigate(`/memories/${m.memory_id}`);
                    }}
                    style={ui.listItem}
                    title="Abrir detalhes"
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontWeight: 900 }}>
                        {header}
                        <span style={{ marginLeft: 10, opacity: 0.7, fontWeight: 700, fontSize: 12 }}>
                          #{m.memory_id} • v{v}
                          {typeof canEdit === "boolean" && (
                            <span style={{ marginLeft: 8, opacity: 0.85 }}>
                              • {canEdit ? "editável" : "somente leitura"}
                            </span>
                          )}
                        </span>
                      </div>
                      <div style={{ opacity: 0.75, fontSize: 12, whiteSpace: "nowrap" }}>
                        {formatDateBR(m.created_at)}
                      </div>
                    </div>

                    <div style={ui.previewClamp} title={full || ""}>
                      {full || <span style={{ opacity: 0.65 }}>(sem conteúdo)</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div style={ui.footerHint}>
          Dica: se aparecer <b>jwt expired</b>, faça logout/login para renovar o token.
        </div>
      </div>
    </div>
  );
}
