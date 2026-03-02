// C:\HDUD_DATA\hdud-web-app\src\pages\ChaptersListPage.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

type ChapterStatus = "DRAFT" | "PUBLIC";
type StatusFilter = "ALL" | "DRAFT" | "PUBLIC";
type SortKey = "RECENT" | "OLD";

type ApiChapterListItem = {
  chapter_id: number;
  author_id: number;
  title: string;
  description: string | null;
  status: ChapterStatus;
  current_version_id: number | null;
  created_at: string;
  updated_at: string;
  published_at?: string | null;
};

function getToken(): string | null {
  return (
    localStorage.getItem("HDUD_TOKEN") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("hdud_access_token")
  );
}

function clearTokenEverywhere() {
  try {
    ["HDUD_TOKEN", "access_token", "token", "hdud_access_token"].forEach((k) => localStorage.removeItem(k));
  } catch {}
}

function parseJwtPayload(token: string): any | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(b64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function redirectToLogin(reason?: string) {
  try {
    sessionStorage.setItem("hdud_after_login_path", window.location.pathname + window.location.search + window.location.hash);
    if (reason) sessionStorage.setItem("hdud_login_reason", reason);
  } catch {}
  try {
    window.location.assign("/login");
  } catch {
    window.location.href = "/login";
  }
}

async function apiRequest<T>(
  path: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; data: T | null; usedPath: string }> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as any),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const resp = await fetch(path, { ...init, headers });
  let data: any = null;
  try {
    data = await resp.json();
  } catch {
    data = null;
  }

  if (resp.status === 401) {
    clearTokenEverywhere();
    redirectToLogin("expired");
  }

  return { ok: resp.ok, status: resp.status, data, usedPath: path };
}

type TryResult<T> = {
  ok: boolean;
  status: number;
  data: T | null;
  usedIndex: number;
  usedPath: string;
  attempts: Array<{ path: string; status: number; ok: boolean }>;
};

async function tryMany<T>(
  calls: Array<() => Promise<{ ok: boolean; status: number; data: T | null; usedPath: string }>>
): Promise<TryResult<T>> {
  const attempts: Array<{ path: string; status: number; ok: boolean }> = [];
  let last: any = { ok: false, status: 0, data: null, usedIndex: -1, usedPath: "" };

  for (let i = 0; i < calls.length; i++) {
    try {
      const r = await calls[i]();
      attempts.push({ path: r.usedPath, status: r.status, ok: r.ok });
      last = { ...r, usedIndex: i };
      if (r.ok) return { ...last, attempts };
      if (r.status === 401) return { ...last, attempts };
    } catch {
      // ignore
    }
  }

  return { ...last, attempts };
}

function unwrapList(data: any): ApiChapterListItem[] | null {
  if (!data) return null;
  if (Array.isArray(data)) return data as ApiChapterListItem[];
  if (Array.isArray((data as any).chapters)) return (data as any).chapters as ApiChapterListItem[];
  if (Array.isArray((data as any).items)) return (data as any).items as ApiChapterListItem[];
  if ((data as any).data && Array.isArray((data as any).data.chapters)) return (data as any).data.chapters as ApiChapterListItem[];
  if ((data as any).data && Array.isArray((data as any).data.items)) return (data as any).data.items as ApiChapterListItem[];
  return null;
}

function toStatus(v: any): ChapterStatus {
  return v === "PUBLIC" ? "PUBLIC" : "DRAFT";
}

function safeTrimOrNull(v: any): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function compactText(v: string, max = 120) {
  const s = (v ?? "").toString().replace(/\s+/g, " ").trim();
  if (!s) return "";
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function formatDateBR(v?: string | null) {
  if (!v) return "—";
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("pt-BR");
  } catch {
    return "—";
  }
}

// Deep-link helper
function consumeOpenChapterHint(): number | null {
  try {
    const v = sessionStorage.getItem("hdud_open_chapter_id");
    if (!v) return null;
    sessionStorage.removeItem("hdud_open_chapter_id");
    const n = Number(String(v).trim());
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

type ToastKind = "ok" | "warn" | "err";
type Toast = { kind: ToastKind; msg: string };

const DEFAULT_NEW_TITLE = "Novo capítulo";
const DEFAULT_NEW_DESCRIPTION = "Uma frase curta: sobre o que é essa fase da sua vida?";

export default function ChaptersListPage() {
  const navigate = useNavigate();
  const token = getToken();
  const canUseApi = !!token;

  const jwt = useMemo(() => (token ? parseJwtPayload(token) : null), [token]);
  const authorId = useMemo(() => {
    const a = jwt?.author_id ?? jwt?.authorId ?? jwt?.sub_author_id ?? null;
    const n = Number(a);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [jwt]);

  const [items, setItems] = useState<ApiChapterListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<any>(null);

  const [q, setQ] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("RECENT");

  const listSeqRef = useRef(0);
  const pendingOpenChapterIdRef = useRef<number | null>(consumeOpenChapterHint());

  function setToastAuto(t: Toast | null, ms = 3200) {
    setToast(t);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    if (t) toastTimer.current = setTimeout(() => setToast(null), ms);
  }

  function needAuthGuard(): boolean {
    const t = getToken();
    if (!t) {
      setToastAuto({ kind: "warn", msg: "Token ausente. Faça login para ver/editar capítulos." });
      return true;
    }
    const j = parseJwtPayload(t);
    const a = j?.author_id ?? j?.authorId ?? j?.sub_author_id ?? null;
    const n = Number(a);
    if (!(Number.isFinite(n) && n > 0)) {
      setToastAuto({ kind: "warn", msg: "Não consegui identificar author_id no token. Refaça login." });
      return true;
    }
    return false;
  }

  async function loadList() {
    if (needAuthGuard()) return;

    const seq = ++listSeqRef.current;
    setLoading(true);
    setToast(null);

    try {
      const result = await tryMany<any>([
        () => apiRequest<any>("/api/chapters", { method: "GET" }),
        () => apiRequest<any>("/api/chapter", { method: "GET" }),
        () => apiRequest<any>("/api/chapters/list", { method: "GET" }),
        () => apiRequest<any>("/api/chapter/list", { method: "GET" }),
        () => apiRequest<any>(`/api/authors/${authorId}/chapters`, { method: "GET" }),
        () => apiRequest<any>(`/api/author/${authorId}/chapters`, { method: "GET" }),
      ]);

      if (seq !== listSeqRef.current) return;

      const list = unwrapList(result.data);
      if (!result.ok || !list) {
        const hint =
          result.status === 401
            ? "401 (token expirado). Faça login novamente."
            : result.status === 404
            ? "404 (rota não existe no backend)."
            : `HTTP ${result.status || "erro"}`;
        setToastAuto({ kind: "err", msg: `Falha ao carregar capítulos (${hint}).` });
        return;
      }

      const normalized = list
        .map((x: any) => ({
          chapter_id: Number(x.chapter_id ?? x.id ?? x.chapterId),
          author_id: Number(x.author_id ?? x.authorId ?? authorId),
          title: String(x.title ?? ""),
          description: x.description != null ? String(x.description) : null,
          status: toStatus(x.status),
          current_version_id:
            x.current_version_id != null
              ? Number(x.current_version_id)
              : x.currentVersionId != null
              ? Number(x.currentVersionId)
              : null,
          created_at: String(x.created_at ?? x.createdAt ?? ""),
          updated_at: String(x.updated_at ?? x.updatedAt ?? ""),
          published_at: x.published_at != null ? String(x.published_at) : x.publishedAt != null ? String(x.publishedAt) : null,
        }))
        .filter((x) => Number.isFinite(x.chapter_id) && x.chapter_id > 0);

      setItems(normalized);

      // ✅ Deep-link: Timeline -> abre direto editor dedicado
      const pending = pendingOpenChapterIdRef.current;
      if (pending && normalized.some((c) => c.chapter_id === pending)) {
        pendingOpenChapterIdRef.current = null;
        navigate(`/chapters/${pending}`);
        return;
      }
      pendingOpenChapterIdRef.current = null;
    } finally {
      setLoading(false);
    }
  }

  async function createChapter(preset?: { title: string; description?: string | null }) {
    if (needAuthGuard()) return;

    setSaving(true);
    setToast(null);

    try {
      const payload = {
        title: preset?.title ?? DEFAULT_NEW_TITLE,
        description: preset?.description ?? DEFAULT_NEW_DESCRIPTION,
        body: "",
        status: "DRAFT",
      };

      const result = await tryMany<any>([
        () => apiRequest<any>("/api/chapters", { method: "POST", body: JSON.stringify(payload) }),
        () => apiRequest<any>("/api/chapter", { method: "POST", body: JSON.stringify(payload) }),
        () => apiRequest<any>(`/api/authors/${authorId}/chapters`, { method: "POST", body: JSON.stringify(payload) }),
        () => apiRequest<any>(`/api/author/${authorId}/chapters`, { method: "POST", body: JSON.stringify(payload) }),
      ]);

      if (!result.ok) {
        const hint =
          result.status === 401
            ? "401 (token expirado). Faça login novamente."
            : result.status === 404
            ? "404 (rota de criação não existe no backend)."
            : `HTTP ${result.status || "erro"}`;
        setToastAuto({ kind: "err", msg: `Erro ao criar capítulo (${hint}).` });
        return;
      }

      const createdId =
        (result.data as any)?.chapter_id ??
        (result.data as any)?.id ??
        (result.data as any)?.chapter?.chapter_id ??
        (result.data as any)?.data?.chapter_id ??
        null;

      const cid = Number(createdId);
      await loadList();

      if (Number.isFinite(cid) && cid > 0) {
        // ✅ fluxo dedicado: criar -> abrir direto no editor dedicado
        navigate(`/chapters/${cid}`);
      } else {
        setToastAuto({ kind: "ok", msg: "Capítulo criado." });
      }
    } finally {
      setSaving(false);
    }
  }

  const filteredItems = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = items.slice();

    if (statusFilter !== "ALL") list = list.filter((c) => c.status === statusFilter);

    if (needle) {
      list = list.filter((c) => {
        const t = String(c.title ?? "").toLowerCase();
        const d = String(c.description ?? "").toLowerCase();
        return t.includes(needle) || d.includes(needle);
      });
    }

    list.sort((a, b) => {
      const da = new Date(a.updated_at || a.created_at || 0).getTime();
      const db = new Date(b.updated_at || b.created_at || 0).getTime();
      return sortKey === "RECENT" ? db - da : da - db;
    });

    return list;
  }, [items, q, statusFilter, sortKey]);

  useEffect(() => {
    if (!canUseApi) {
      setToastAuto({ kind: "warn", msg: "Token ausente. Faça login para ver/editar capítulos." });
      return;
    }
    void loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUseApi]);

  return (
    <div style={styles.page}>
      <div style={styles.wrap}>
        <div style={styles.headerRow}>
          <div>
            <div style={styles.h1}>Capítulos</div>
            <div style={styles.hSub}>Um espaço limpo para organizar fases da sua história. Abra um capítulo para escrever em tela cheia.</div>
          </div>

          <div style={styles.headerActions}>
            <button className="hdud-btn hdud-btn-primary" onClick={() => createChapter()} disabled={loading || saving}>
              Novo Capítulo
            </button>
          </div>
        </div>

        <div style={styles.controls}>
          <input
            className="hdud-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar capítulos..."
            style={{ flex: "1 1 360px", minWidth: 220 }}
          />

          <select className="hdud-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} style={styles.select}>
            <option value="ALL">Status: Todos</option>
            <option value="DRAFT">Status: Rascunhos</option>
            <option value="PUBLIC">Status: Públicos</option>
          </select>

          <select className="hdud-input" value={sortKey} onChange={(e) => setSortKey(e.target.value as any)} style={styles.select}>
            <option value="RECENT">Mais recentes</option>
            <option value="OLD">Mais antigos</option>
          </select>

          <button className="hdud-btn" onClick={() => loadList()} disabled={loading || saving}>
            {loading ? "Atualizando..." : "Atualizar"}
          </button>
        </div>

        {toast ? (
          <div
            style={{
              marginTop: 12,
              padding: 10,
              borderRadius: 12,
              border: "1px solid var(--hdud-border)",
              background:
                toast.kind === "ok" ? "rgba(52, 199, 89, 0.10)" : toast.kind === "warn" ? "rgba(255, 204, 0, 0.10)" : "rgba(255, 59, 48, 0.10)",
            }}
          >
            <b style={{ textTransform: "uppercase", fontSize: 11, opacity: 0.8 }}>{toast.kind}</b> — {toast.msg}
          </div>
        ) : null}

        <div style={styles.list}>
          {filteredItems.map((c) => {
            const statusLabel = c.status === "PUBLIC" ? "Público" : "Rascunho";
            return (
              <div
                key={c.chapter_id}
                style={styles.card}
                onClick={() => navigate(`/chapters/${c.chapter_id}`)}
                role="button"
                title="Abrir capítulo"
              >
                <div style={styles.cardTop}>
                  <div style={styles.cardTitle}>{c.title || `Capítulo #${c.chapter_id}`}</div>
                  <div style={styles.pill}>{statusLabel}</div>
                </div>

                {c.description ? <div style={styles.cardDesc}>{compactText(String(c.description), 150)}</div> : null}

                <div style={styles.cardMeta}>
                  <span>Atualizado: {formatDateBR(c.updated_at)}</span>
                </div>
              </div>
            );
          })}

          {!filteredItems.length ? (
            <div style={styles.empty}>
              <div style={{ fontWeight: 950 }}>Nenhum capítulo encontrado</div>
              <div style={{ opacity: 0.75, marginTop: 6 }}>Crie um novo capítulo para começar.</div>
              <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button className="hdud-btn" onClick={() => createChapter({ title: "Infância", description: "As primeiras cenas: casa, pessoas, rotina e o que ficou marcado." })} disabled={loading || saving}>
                  + Infância
                </button>
                <button className="hdud-btn" onClick={() => createChapter({ title: "Adolescência", description: "Descobertas, amizades, conflitos e viradas." })} disabled={loading || saving}>
                  + Adolescência
                </button>
                <button className="hdud-btn" onClick={() => createChapter({ title: "Agora", description: "O presente: o que está acontecendo e para onde você quer ir." })} disabled={loading || saving}>
                  + Agora
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { width: "100%", color: "var(--hdud-text)" },
  wrap: { width: "100%", maxWidth: 1920, margin: "0 auto", padding: "18px 18px", boxSizing: "border-box" },

  headerRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap" },
  headerActions: { display: "flex", alignItems: "flex-start", justifyContent: "flex-end" },

  h1: { fontSize: 44, fontWeight: 950, letterSpacing: -0.9, margin: 0, lineHeight: 1.05 },
  hSub: { opacity: 0.78, fontSize: 13, marginTop: 8, lineHeight: 1.35, maxWidth: 860 },

  controls: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 14 },
  select: { width: 190, minWidth: 160 },

  list: { marginTop: 16, display: "flex", flexDirection: "column", gap: 12 },
  card: {
    border: "1px solid var(--hdud-border)",
    borderRadius: 14,
    padding: 14,
    background: "rgba(255,255,255,0.02)",
    cursor: "pointer",
    userSelect: "none",
  },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  cardTitle: { fontWeight: 950, fontSize: 14, letterSpacing: -0.2 },
  pill: {
    border: "1px solid var(--hdud-border)",
    background: "var(--hdud-surface-2)",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    opacity: 0.9,
    whiteSpace: "nowrap",
  },
  cardDesc: { marginTop: 8, fontSize: 12, opacity: 0.78, lineHeight: 1.45, maxWidth: 1100 },
  cardMeta: { marginTop: 10, fontSize: 11, opacity: 0.68 },

  empty: {
    border: "1px dashed var(--hdud-border)",
    borderRadius: 14,
    padding: 16,
    background: "rgba(255,255,255,0.02)",
  },
};