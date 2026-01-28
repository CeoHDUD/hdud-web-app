import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * ChaptersPage (MVP) — API REAL (sem tocar em Memórias/Core)
 * - Persistência: HDUD-API-Node (banco) -> identity_chapter + identity_chapter_versions
 * - Lista à esquerda + editor à direita
 * - Ações: salvar / publicar / despublicar / recarregar
 *
 * ✅ Ajuste vNext.2 (Trilhos):
 * - Mantém UI/UX congelada; só melhora a camada de chamada da API.
 * - Diagnóstico: mostra qual endpoint foi tentado/usado e status (para matar 404 no escuro).
 * - Fallback: tenta múltiplas rotas comuns (compat) antes de desistir.
 */

type ChapterStatus = "DRAFT" | "PUBLIC";

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

type ApiChapterDetail = {
  chapter_id: number;
  author_id: number;
  title: string;
  description: string | null;
  status: ChapterStatus;
  current_version_id: number | null;
  created_at: string;
  updated_at: string;
  published_at?: string | null;
  body?: string; // compat legado
};

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

const DEFAULT_NEW_TITLE = "Novo capítulo";
const DEFAULT_NEW_DESCRIPTION =
  "Resumo curto para a lista (o que o leitor vai sentir/entender).";

function safeTrimOrNull(v: any): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function toStatus(v: any): ChapterStatus {
  return v === "PUBLIC" ? "PUBLIC" : "DRAFT";
}

function unwrapList(data: any): ApiChapterListItem[] | null {
  if (!data) return null;
  if (Array.isArray(data)) return data as ApiChapterListItem[];
  if (Array.isArray(data.chapters)) return data.chapters as ApiChapterListItem[];
  if (Array.isArray(data.items)) return data.items as ApiChapterListItem[];
  if (data.data && Array.isArray(data.data.chapters)) return data.data.chapters as ApiChapterListItem[];
  if (data.data && Array.isArray(data.data.items)) return data.data.items as ApiChapterListItem[];
  return null;
}

function unwrapDetail(data: any): ApiChapterDetail | null {
  if (!data) return null;
  if (data.chapter) return data.chapter as ApiChapterDetail; // shape { chapter, current_version }
  if (data.data && data.data.chapter) return data.data.chapter as ApiChapterDetail;
  return data as ApiChapterDetail;
}

type ToastKind = "ok" | "warn" | "err";
type Toast = { kind: ToastKind; msg: string };

function getToken(): string | null {
  return (
    localStorage.getItem("HDUD_TOKEN") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("hdud_access_token")
  );
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

// tenta várias rotas (compat/proxy). primeira que der ok vira a escolhida.
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
    } catch {
      // ignora e tenta a próxima
    }
  }

  return { ...last, attempts };
}

function formatAttempts(attempts: Array<{ path: string; status: number; ok: boolean }>) {
  if (!attempts.length) return "";
  const short = attempts
    .slice(0, 4)
    .map((a, idx) => `${idx + 1}) ${a.path} → ${a.status || "erro"}`)
    .join(" | ");
  return attempts.length > 4 ? `${short} | …` : short;
}

export default function ChaptersPage() {
  const token = useMemo(() => getToken(), []);
  const canUseApi = !!token;

  const jwt = useMemo(() => (token ? parseJwtPayload(token) : null), [token]);
  const authorId = useMemo(() => {
    const a = jwt?.author_id ?? jwt?.authorId ?? jwt?.sub_author_id ?? null;
    const n = Number(a);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [jwt]);

  const [items, setItems] = useState<ApiChapterListItem[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState<number | null>(null);

  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [body, setBody] = useState<string>("");

  const [status, setStatus] = useState<ChapterStatus>("DRAFT");
  const [versionLabel, setVersionLabel] = useState<string>("v1");

  const [createdAt, setCreatedAt] = useState<string>("—");
  const [updatedAt, setUpdatedAt] = useState<string>("—");
  const [publishedAt, setPublishedAt] = useState<string>("—");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<any>(null);

  // diagnóstico leve (sem mexer no core): mostra qual rota funcionou / falhou
  const [lastApiInfo, setLastApiInfo] = useState<string>("");

  // ✅ controle: só limpa template no 1º foco (evita “não limpa quando digito”)
  const didFocusTitle = useRef(false);
  const didFocusDesc = useRef(false);

  function setToastAuto(t: Toast | null, ms = 3500) {
    setToast(t);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    if (t) toastTimer.current = setTimeout(() => setToast(null), ms);
  }

  function setApiInfo(label: string, usedPath: string, attempts: Array<{ path: string; status: number; ok: boolean }>) {
    const a = formatAttempts(attempts);
    setLastApiInfo(`${label}: ${usedPath}${a ? ` | tentativas: ${a}` : ""}`);
  }

  function needAuthGuard(): boolean {
    if (!canUseApi) {
      setToastAuto({ kind: "warn", msg: "Token ausente. Faça login para ver/editar capítulos." });
      return true;
    }
    if (!authorId) {
      setToastAuto({ kind: "warn", msg: "Não consegui identificar author_id no token. Refaça login." });
      return true;
    }
    return false;
  }

  async function loadList() {
    if (needAuthGuard()) return;

    setLoading(true);
    setToast(null);

    // Compat: não sabemos qual rota ficou no backend (404 na tela).
    // Então tentamos rotas comuns de “chapters” + rota por author.
    const result = await tryMany<any>([
      () => apiRequest<any>("/api/chapters", { method: "GET" }),
      () => apiRequest<any>("/api/chapter", { method: "GET" }),
      () => apiRequest<any>("/api/chapters/list", { method: "GET" }),
      () => apiRequest<any>("/api/chapter/list", { method: "GET" }),
      () => apiRequest<any>(`/api/authors/${authorId}/chapters`, { method: "GET" }),
      () => apiRequest<any>(`/api/author/${authorId}/chapters`, { method: "GET" }),
    ]);

    setLoading(false);
    setApiInfo("LIST", result.usedPath || "—", result.attempts);

    const list = unwrapList(result.data);

    if (!result.ok || !list) {
      const hint =
        result.status === 401
          ? "401 (token expirado). Faça login novamente."
          : result.status === 404
          ? "404 (rota não existe no backend)."
          : `HTTP ${result.status || "erro"}`;

      setToastAuto({
        kind: "err",
        msg: `Falha ao carregar lista de capítulos (${hint}).`,
      });
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

    if (!selectedChapterId && normalized.length > 0) {
      void loadDetail(normalized[0].chapter_id);
    }
  }

  async function loadDetail(chapterId: number) {
    if (needAuthGuard()) return;

    setLoading(true);
    setToast(null);

    const result = await tryMany<any>([
      () => apiRequest<any>(`/api/chapters/${chapterId}`, { method: "GET" }),
      () => apiRequest<any>(`/api/chapter/${chapterId}`, { method: "GET" }),
      () => apiRequest<any>(`/api/authors/${authorId}/chapters/${chapterId}`, { method: "GET" }),
      () => apiRequest<any>(`/api/author/${authorId}/chapters/${chapterId}`, { method: "GET" }),
    ]);

    setLoading(false);
    setApiInfo("DETAIL", result.usedPath || "—", result.attempts);

    const d = unwrapDetail(result.data);

    if (!result.ok || !d) {
      const hint =
        result.status === 401
          ? "401 (token expirado). Faça login novamente."
          : result.status === 404
          ? "404 (rota não existe / id não encontrado)."
          : `HTTP ${result.status || "erro"}`;

      setToastAuto({ kind: "err", msg: `Falha ao carregar capítulo (${hint}).` });
      return;
    }

    setSelectedChapterId(Number(d.chapter_id));
    setTitle(String(d.title ?? ""));
    setDescription(String(d.description ?? ""));
    setStatus(toStatus(d.status));

    const v =
      d.current_version_id && Number.isFinite(Number(d.current_version_id))
        ? `v${Number(d.current_version_id)}`
        : "v1";
    setVersionLabel(v);

    setCreatedAt(formatDateBR(d.created_at));
    setUpdatedAt(formatDateBR(d.updated_at));
    setPublishedAt(d.published_at ? formatDateBR(d.published_at) : "—");

    const fromCurrent = (result.data as any)?.current_version?.body;
    const flat = typeof d.body === "string" ? d.body : null;

    if (typeof fromCurrent === "string") setBody(fromCurrent);
    else if (flat !== null) setBody(flat);
    else setBody("");

    // ✅ importante: ao trocar de capítulo, “reseta” a lógica do template
    didFocusTitle.current = false;
    didFocusDesc.current = false;
  }

  async function createChapter() {
    if (needAuthGuard()) return;

    setSaving(true);
    setToast(null);

    const payload = {
      title: DEFAULT_NEW_TITLE,
      description: DEFAULT_NEW_DESCRIPTION,
      body: "",
      status: "DRAFT",
    };

    const result = await tryMany<any>([
      () => apiRequest<any>("/api/chapters", { method: "POST", body: JSON.stringify(payload) }),
      () => apiRequest<any>("/api/chapter", { method: "POST", body: JSON.stringify(payload) }),
      () => apiRequest<any>(`/api/authors/${authorId}/chapters`, { method: "POST", body: JSON.stringify(payload) }),
      () => apiRequest<any>(`/api/author/${authorId}/chapters`, { method: "POST", body: JSON.stringify(payload) }),
    ]);

    setSaving(false);
    setApiInfo("CREATE", result.usedPath || "—", result.attempts);

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

    setToastAuto({ kind: "ok", msg: "Capítulo criado (rascunho)." });

    await loadList();

    const createdId =
      (result.data as any)?.chapter_id ??
      (result.data as any)?.id ??
      (result.data as any)?.chapter?.chapter_id ??
      (result.data as any)?.data?.chapter_id ??
      null;

    const cid = Number(createdId);
    if (Number.isFinite(cid) && cid > 0) {
      await loadDetail(cid);
    }
  }

  async function saveChapter() {
    if (!selectedChapterId) return;
    if (needAuthGuard()) return;

    const t = String(title ?? "").trim();
    if (!t) {
      setToastAuto({ kind: "warn", msg: "Título é obrigatório." });
      return;
    }

    setSaving(true);
    setToast(null);

    const payload = {
      title: t,
      description: safeTrimOrNull(description),
      body: String(body ?? ""),
    };

    const result = await tryMany<any>([
      () => apiRequest<any>(`/api/chapters/${selectedChapterId}`, { method: "PUT", body: JSON.stringify(payload) }),
      () => apiRequest<any>(`/api/chapter/${selectedChapterId}`, { method: "PUT", body: JSON.stringify(payload) }),
      () =>
        apiRequest<any>(`/api/authors/${authorId}/chapters/${selectedChapterId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        }),
      () =>
        apiRequest<any>(`/api/author/${authorId}/chapters/${selectedChapterId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        }),
    ]);

    setSaving(false);
    setApiInfo("SAVE", result.usedPath || "—", result.attempts);

    if (!result.ok) {
      const hint =
        result.status === 401
          ? "401 (token expirado). Faça login novamente."
          : result.status === 404
          ? "404 (rota de update não existe no backend)."
          : `HTTP ${result.status || "erro"}`;

      setToastAuto({ kind: "err", msg: `Falha ao salvar capítulo (${hint}).` });
      return;
    }

    setToastAuto({ kind: "ok", msg: "Salvo." });

    await loadList();
    await loadDetail(selectedChapterId);
  }

  async function publishChapter() {
    if (!selectedChapterId) return;
    if (needAuthGuard()) return;

    setSaving(true);
    setToast(null);

    const result = await tryMany<any>([
      () => apiRequest<any>(`/api/chapters/${selectedChapterId}/publish`, { method: "POST" }),
      () => apiRequest<any>(`/api/chapter/${selectedChapterId}/publish`, { method: "POST" }),
      () => apiRequest<any>(`/api/chapters/${selectedChapterId}/publicar`, { method: "POST" }), // compat PT
      () => apiRequest<any>(`/api/chapter/${selectedChapterId}/publicar`, { method: "POST" }), // compat PT
      () =>
        apiRequest<any>(`/api/authors/${authorId}/chapters/${selectedChapterId}/publish`, {
          method: "POST",
        }),
      () =>
        apiRequest<any>(`/api/author/${authorId}/chapters/${selectedChapterId}/publish`, {
          method: "POST",
        }),
    ]);

    setSaving(false);
    setApiInfo("PUBLISH", result.usedPath || "—", result.attempts);

    if (!result.ok) {
      const hint =
        result.status === 401
          ? "401 (token expirado). Faça login novamente."
          : result.status === 404
          ? "404 (rota de publish não existe no backend)."
          : `HTTP ${result.status || "erro"}`;

      setToastAuto({ kind: "err", msg: `Falha ao publicar (${hint}).` });
      return;
    }

    setToastAuto({ kind: "ok", msg: "Publicado." });

    await loadList();
    await loadDetail(selectedChapterId);
  }

  async function unpublishChapter() {
    if (!selectedChapterId) return;
    if (needAuthGuard()) return;

    setSaving(true);
    setToast(null);

    const result = await tryMany<any>([
      () => apiRequest<any>(`/api/chapters/${selectedChapterId}/unpublish`, { method: "POST" }),
      () => apiRequest<any>(`/api/chapter/${selectedChapterId}/unpublish`, { method: "POST" }),
      () => apiRequest<any>(`/api/chapters/${selectedChapterId}/despublicar`, { method: "POST" }), // compat PT
      () => apiRequest<any>(`/api/chapter/${selectedChapterId}/despublicar`, { method: "POST" }), // compat PT
      () =>
        apiRequest<any>(`/api/authors/${authorId}/chapters/${selectedChapterId}/unpublish`, {
          method: "POST",
        }),
      () =>
        apiRequest<any>(`/api/author/${authorId}/chapters/${selectedChapterId}/unpublish`, {
          method: "POST",
        }),
    ]);

    setSaving(false);
    setApiInfo("UNPUBLISH", result.usedPath || "—", result.attempts);

    if (!result.ok) {
      const hint =
        result.status === 401
          ? "401 (token expirado). Faça login novamente."
          : result.status === 404
          ? "404 (rota de unpublish não existe no backend)."
          : `HTTP ${result.status || "erro"}`;

      setToastAuto({ kind: "err", msg: `Falha ao despublicar (${hint}).` });
      return;
    }

    setToastAuto({ kind: "ok", msg: "Despublicado." });

    await loadList();
    await loadDetail(selectedChapterId);
  }

  const headerCount = items.length;
  const statusBadgeStyle = status === "PUBLIC" ? styles.badgePublic : styles.badgeDraft;

  useEffect(() => {
    void loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={styles.page}>
      <div style={styles.headerCard}>
        <div style={styles.headerRow}>
          <div>
            <div style={styles.h1}>Capítulos</div>
            <div style={styles.sub}>
              Rascunhos, versões, publicação e continuidade — mantendo o core intacto.
            </div>
          </div>

          <div style={styles.headerActions}>
            <div style={styles.pill}>camada narrativa • API real • sem tocar em Memórias/Core</div>
            <button
              style={{ ...styles.btn, ...(loading ? styles.btnDisabled : {}) }}
              onClick={loadList}
              disabled={loading}
              title="Recarrega lista e, se necessário, seleciona o primeiro"
            >
              Atualizar
            </button>
            <button
              style={{ ...styles.btnPrimary, ...(saving ? styles.btnDisabled : {}) }}
              onClick={createChapter}
              disabled={saving}
              title="Cria um capítulo rascunho no banco"
            >
              + Novo capítulo
            </button>
          </div>
        </div>

        <div style={styles.headerMeta}>
          <span style={styles.smallMuted}>
            {authorId ? `author_id: ${authorId}` : "author_id: —"} • {headerCount} capítulo(s)
            {lastApiInfo ? ` • API: ${lastApiInfo}` : ""}
          </span>
        </div>

        {toast && (
          <div
            style={{
              ...styles.toast,
              ...(toast.kind === "ok"
                ? styles.toastOk
                : toast.kind === "warn"
                ? styles.toastWarn
                : styles.toastErr),
            }}
          >
            {toast.msg}
          </div>
        )}
      </div>

      <div style={styles.grid}>
        {/* left: list */}
        <div style={styles.listCard}>
          <div style={styles.listHeader}>
            <div style={styles.cardTitle}>Seus capítulos</div>
            <div style={styles.cardMeta}>{items.length} item(ns)</div>
          </div>

          {items.length === 0 ? (
            <div style={styles.emptyBox}>
              Nenhum capítulo ainda. Clique em <b>+ Novo capítulo</b>.
            </div>
          ) : (
            <div style={styles.listWrap}>
              {items.map((c) => {
                const isSelected = c.chapter_id === selectedChapterId;
                const badgeStyle = c.status === "PUBLIC" ? styles.badgePublic : styles.badgeDraft;

                return (
                  <button
                    key={c.chapter_id}
                    style={{ ...styles.itemBtn, ...(isSelected ? styles.itemBtnActive : {}) }}
                    onClick={() => loadDetail(c.chapter_id)}
                  >
                    <div style={styles.itemTop}>
                      <div style={styles.itemTitle}>
                        Capítulo {c.chapter_id} — <b>{c.title || "Sem título"}</b>
                      </div>
                      <span style={{ ...styles.badge, ...badgeStyle }}>
                        {c.status === "PUBLIC" ? "Público" : "Rascunho"}
                      </span>
                    </div>
                    <div style={styles.itemDesc}>{c.description || "—"}</div>
                    <div style={styles.itemMeta}>Atualizado: {formatDateBR(c.updated_at)}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* right: editor */}
        <div style={styles.editorCard}>
          <div style={styles.editorHeader}>
            <div>
              <div style={styles.cardTitle}>Editando</div>
              <div style={styles.cardMeta}>
                Criado: {createdAt} • Última atualização: {updatedAt} • Publicado: {publishedAt}
              </div>
            </div>

            <div style={styles.editorBadges}>
              <span style={styles.badgeSoft}>Capítulo {selectedChapterId ?? "—"}</span>
              <span style={styles.badgeSoft}>{versionLabel}</span>
              <span style={{ ...styles.badge, ...statusBadgeStyle }}>
                {status === "PUBLIC" ? "Público" : "Rascunho"}
              </span>
            </div>

            <div style={styles.editorActions}>
              <button
                style={{ ...styles.btn, ...(loading || !selectedChapterId ? styles.btnDisabled : {}) }}
                onClick={() => selectedChapterId && loadDetail(selectedChapterId)}
                disabled={loading || !selectedChapterId}
              >
                Recarregar
              </button>

              <button
                style={{ ...styles.btnPrimary, ...(saving || !selectedChapterId ? styles.btnDisabled : {}) }}
                onClick={saveChapter}
                disabled={saving || !selectedChapterId}
              >
                Salvar
              </button>

              {status === "PUBLIC" ? (
                <button
                  style={{ ...styles.btn, ...(saving || !selectedChapterId ? styles.btnDisabled : {}) }}
                  onClick={unpublishChapter}
                  disabled={saving || !selectedChapterId}
                >
                  Despublicar
                </button>
              ) : (
                <button
                  style={{ ...styles.btn, ...(saving || !selectedChapterId ? styles.btnDisabled : {}) }}
                  onClick={publishChapter}
                  disabled={saving || !selectedChapterId}
                >
                  Publicar
                </button>
              )}
            </div>
          </div>

          <div style={styles.form}>
            <label style={styles.label}>
              <span style={styles.labelTop}>Título (livre — sem forçar “Capítulo X”)</span>
              <input
                style={styles.input}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onFocus={() => {
                  if (!didFocusTitle.current) {
                    didFocusTitle.current = true;
                    if (selectedChapterId && title === DEFAULT_NEW_TITLE) setTitle("");
                  }
                }}
                placeholder="Ex.: Minha chegada ao mundo"
              />
              <span style={styles.counter}>{title.trim().length}/200</span>
            </label>

            <label style={styles.label}>
              <span style={styles.labelTop}>Descrição (curta)</span>
              <input
                style={styles.input}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onFocus={() => {
                  if (!didFocusDesc.current) {
                    didFocusDesc.current = true;
                    if (selectedChapterId && description === DEFAULT_NEW_DESCRIPTION) setDescription("");
                  }
                }}
                placeholder={DEFAULT_NEW_DESCRIPTION}
              />
              <span style={styles.counter}>{description.trim().length}/400</span>
            </label>

            <label style={styles.label}>
              <span style={styles.labelTop}>Texto do capítulo</span>
              <textarea
                style={styles.textarea}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Escreva aqui…"
              />
              <span style={styles.counter}>{(body || "").length} caracteres</span>
            </label>

            {!selectedChapterId && (
              <div style={styles.note}>
                Dica: clique em <b>+ Novo capítulo</b> para criar no banco e editar com id real.
              </div>
            )}

            <div style={styles.noteMuted}>
              Nota: este módulo é “camada narrativa” determinística. Integração com IA/geração entra depois, sem mexer no core.
            </div>
          </div>
        </div>
      </div>

      <div style={styles.suggestCard}>
        <div style={styles.suggestTitle}>
          Próximo capítulo sugerido: <b>Capítulo {headerCount + 1}</b> — Infância (primeiras memórias)
        </div>
        <ul style={styles.suggestList}>
          <li>Qual foi a primeira casa / bairro que você lembra?</li>
          <li>Quem eram as pessoas mais presentes (pais, avós, vizinhos)?</li>
          <li>Qual era um ritual da sua família (almoço, domingo, religião, música)?</li>
          <li>Gancho do que você escreveu: {body ? `${body.slice(0, 40)}…` : "(ainda vazio)"}</li>
        </ul>
        <div style={styles.suggestHint}>*isso é só guia premium de escrita (determinístico)*</div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: 18, color: "var(--hdud-text)" },

  headerCard: {
    background: "var(--hdud-card)",
    borderRadius: 14,
    padding: 18,
    boxShadow: "var(--hdud-shadow)",
    marginBottom: 18,
    border: "1px solid var(--hdud-border)",
  },
  headerRow: { display: "flex", gap: 12, alignItems: "flex-start", justifyContent: "space-between" },
  h1: { fontSize: 34, fontWeight: 800, letterSpacing: -0.5, marginBottom: 4 },
  sub: { opacity: 0.75, fontSize: 13 },
  headerActions: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  pill: {
    background: "var(--hdud-surface-2)",
    border: "1px solid var(--hdud-border)",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    opacity: 0.9,
  },
  btn: {
    border: "1px solid var(--hdud-border)",
    background: "var(--hdud-surface-2)",
    color: "var(--hdud-text)",
    padding: "8px 12px",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 700,
  },
  btnPrimary: {
    border: "1px solid var(--hdud-border)",
    background: "var(--hdud-primary-bg)",
    color: "var(--hdud-primary-text)",
    padding: "8px 12px",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 800,
  },
  btnDisabled: { opacity: 0.55, cursor: "not-allowed" },
  headerMeta: { marginTop: 8 },
  smallMuted: { fontSize: 12, opacity: 0.7 },

  toast: { marginTop: 10, padding: 10, borderRadius: 10, fontWeight: 700, fontSize: 13 },
  toastOk: { background: "rgba(0,200,120,0.15)", border: "1px solid rgba(0,200,120,0.25)" },
  toastWarn: { background: "rgba(255,180,0,0.15)", border: "1px solid rgba(255,180,0,0.25)" },
  toastErr: { background: "rgba(255,0,80,0.12)", border: "1px solid rgba(255,0,80,0.22)" },

  grid: { display: "grid", gridTemplateColumns: "360px 1fr", gap: 18, alignItems: "start" },

  listCard: {
    background: "var(--hdud-card)",
    borderRadius: 14,
    padding: 14,
    boxShadow: "var(--hdud-shadow)",
    border: "1px solid var(--hdud-border)",
  },
  listHeader: { display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 },
  cardTitle: { fontWeight: 900, fontSize: 14 },
  cardMeta: { fontSize: 12, opacity: 0.7 },

  emptyBox: {
    border: "1px dashed var(--hdud-border)",
    borderRadius: 12,
    padding: 14,
    opacity: 0.9,
    fontSize: 13,
  },
  listWrap: { display: "flex", flexDirection: "column", gap: 10 },

  itemBtn: {
    border: "1px solid var(--hdud-border)",
    background: "var(--hdud-surface-2)",
    color: "var(--hdud-text)",
    borderRadius: 12,
    padding: 12,
    cursor: "pointer",
    textAlign: "left",
  },
  itemBtnActive: { outline: "2px solid var(--hdud-accent-border)" },
  itemTop: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 },
  itemTitle: { fontSize: 13, fontWeight: 800 },
  itemDesc: { marginTop: 6, fontSize: 12, opacity: 0.78 },
  itemMeta: { marginTop: 8, fontSize: 11, opacity: 0.65 },

  badge: {
    fontSize: 11,
    fontWeight: 900,
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid var(--hdud-border)",
    color: "var(--hdud-text)",
  },
  badgeDraft: { background: "rgba(255,180,0,0.15)" },
  badgePublic: { background: "rgba(0,200,120,0.15)" },
  badgeSoft: {
    fontSize: 11,
    fontWeight: 900,
    padding: "4px 8px",
    borderRadius: 999,
    background: "var(--hdud-surface-2)",
    border: "1px solid var(--hdud-border)",
    color: "var(--hdud-text)",
  },

  editorCard: {
    background: "var(--hdud-card)",
    borderRadius: 14,
    padding: 14,
    boxShadow: "var(--hdud-shadow)",
    border: "1px solid var(--hdud-border)",
  },
  editorHeader: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 10,
    alignItems: "start",
    marginBottom: 12,
  },
  editorBadges: { display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" },
  editorActions: { display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" },

  form: { marginTop: 10, display: "flex", flexDirection: "column", gap: 12 },
  label: { display: "flex", flexDirection: "column", gap: 6 },
  labelTop: { fontSize: 12, fontWeight: 900, opacity: 0.85 },

  input: {
    border: "1px solid var(--hdud-border)",
    background: "var(--hdud-surface-2)",
    color: "var(--hdud-text)",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 13,
    outline: "none",
  },
  textarea: {
    border: "1px solid var(--hdud-border)",
    background: "var(--hdud-surface-2)",
    color: "var(--hdud-text)",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 13,
    outline: "none",
    minHeight: 180,
    resize: "vertical",
  },
  counter: { fontSize: 11, opacity: 0.65 },

  note: {
    background: "var(--hdud-surface-2)",
    border: "1px solid var(--hdud-border)",
    borderRadius: 10,
    padding: 10,
    fontSize: 12,
    opacity: 0.9,
  },
  noteMuted: { fontSize: 11, opacity: 0.62, marginTop: 2 },

  suggestCard: {
    marginTop: 18,
    background: "var(--hdud-card)",
    borderRadius: 14,
    padding: 14,
    boxShadow: "var(--hdud-shadow)",
    border: "1px solid var(--hdud-border)",
  },
  suggestTitle: { fontSize: 13, fontWeight: 900, marginBottom: 8 },
  suggestList: { margin: 0, paddingLeft: 18, fontSize: 12, opacity: 0.85 },
  suggestHint: { marginTop: 8, fontSize: 11, opacity: 0.62 },
};
