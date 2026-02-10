// C:\HDUD_DATA\hdud-web-app\src\pages\ChaptersPage.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * ChaptersPage (MVP) — API REAL (sem tocar em Memórias/Core)
 * - Persistência: HDUD-API-Node (banco) -> identity_chapter + identity_chapter_versions
 * - Lista à esquerda + editor à direita
 * - Ações: salvar / publicar / despublicar / recarregar
 *
 * ✅ Ajuste (Home mental = Capítulos):
 * - Home mental: Capítulos são o “mapa” (fases/estrutura). Ação principal: entrar/editar um capítulo.
 * - Memórias/Core NÃO entram aqui (somente camada narrativa do capítulo).
 * - UI mais “lugar / livro”, menos “dashboard”.
 *
 * ✅ Deep-link da Timeline:
 * - Se existir sessionStorage.hdud_open_chapter_id, abre automaticamente esse capítulo ao entrar.
 *
 * ✅ FIX importante:
 * - Não “congelar” token/author_id no mount. Se o token for renovado/trocado, a tela precisa acompanhar.
 *
 * ✅ FECHAMENTO “chave de ouro”:
 * (1) Dirty Guard: evita perder texto em demo (prompt ao trocar de capítulo / sair / recarregar).
 * (3) 401 redirect: token expirado -> limpa token + manda para /login com retorno.
 *
 * ✅ FIX (dirty fantasma / corrida):
 * - Request-id guard: ignora respostas velhas (loadList/loadDetail concorrentes).
 * - isDirty = false durante loading/saving (evita prompt durante sincronização).
 *
 * ✅ FIX (dirty fantasma por normalização):
 * - Normaliza CRLF/LF + trailing spaces + newline final antes de comparar snapshot.
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
const DEFAULT_NEW_DESCRIPTION = "Uma frase curta: sobre o que é essa fase da sua vida?";

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
  if (Array.isArray((data as any).chapters)) return (data as any).chapters as ApiChapterListItem[];
  if (Array.isArray((data as any).items)) return (data as any).items as ApiChapterListItem[];
  if ((data as any).data && Array.isArray((data as any).data.chapters)) return (data as any).data.chapters as ApiChapterListItem[];
  if ((data as any).data && Array.isArray((data as any).data.items)) return (data as any).data.items as ApiChapterListItem[];
  return null;
}

function unwrapDetail(data: any): ApiChapterDetail | null {
  if (!data) return null;
  if ((data as any).chapter) return (data as any).chapter as ApiChapterDetail; // shape { chapter, current_version }
  if ((data as any).data && (data as any).data.chapter) return (data as any).data.chapter as ApiChapterDetail;
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
    sessionStorage.setItem(
      "hdud_after_login_path",
      window.location.pathname + window.location.search + window.location.hash
    );
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

  // ✅ 401 redirect (demo-proof)
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
      if (r.status === 401) return { ...last, attempts };
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

function compactText(v: string, max = 120) {
  const s = (v ?? "").toString().replace(/\s+/g, " ").trim();
  if (!s) return "";
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

// =======================
// Deep-link helper
// =======================
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

type Snapshot = { title: string; description: string; body: string; status: ChapterStatus };

// =======================
// Normalização (evita dirty fantasma)
// =======================
function normText(v: any): string {
  const s = String(v ?? "");
  const noBom = s.replace(/^\uFEFF/, "");
  const lf = noBom.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const trimLineEnds = lf.replace(/[ \t]+$/gm, "");
  const trimEndNewlines = trimLineEnds.replace(/\n+$/g, "\n"); // no máximo 1 newline final
  return trimEndNewlines;
}
function normTitle(v: any): string {
  return String(v ?? "");
}
function normDesc(v: any): string {
  return String(v ?? "");
}
function normSnap(s: Snapshot): Snapshot {
  return {
    title: normTitle(s.title),
    description: normDesc(s.description),
    body: normText(s.body),
    status: s.status,
  };
}

// diagnóstico do dirty
function diffDirty(current: Snapshot, snap: Snapshot) {
  const diffs: string[] = [];
  if (current.title !== snap.title) diffs.push(`title (${current.title.length} vs ${snap.title.length})`);
  if (current.description !== snap.description) diffs.push(`description (${current.description.length} vs ${snap.description.length})`);
  if (current.status !== snap.status) diffs.push(`status (${current.status} vs ${snap.status})`);

  if (current.body !== snap.body) {
    const a = current.body;
    const b = snap.body;
    const min = Math.min(a.length, b.length);
    let i = 0;
    for (; i < min; i++) {
      if (a.charCodeAt(i) !== b.charCodeAt(i)) break;
    }
    const tailA = a.slice(Math.max(0, a.length - 20)).replace(/\n/g, "\\n").replace(/\r/g, "\\r");
    const tailB = b.slice(Math.max(0, b.length - 20)).replace(/\n/g, "\\n").replace(/\r/g, "\\r");
    diffs.push(`body (len ${a.length} vs ${b.length}, firstDiffAt ${i}, tail "${tailA}" vs "${tailB}")`);
  }

  return diffs;
}

export default function ChaptersPage() {
  // ✅ token/authorId NÃO congelados: acompanham login/renovação
  const token = getToken();
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

  // diagnóstico leve
  const [lastApiInfo, setLastApiInfo] = useState<string>("");
  const [showDiag, setShowDiag] = useState<boolean>(false);

  const [q, setQ] = useState<string>("");

  const didFocusTitle = useRef(false);
  const didFocusDesc = useRef(false);

  const pendingOpenChapterIdRef = useRef<number | null>(consumeOpenChapterHint());

  // ✅ request-id guard (mata corrida)
  const listSeqRef = useRef(0);
  const detailSeqRef = useRef(0);

  // =======================
  // Dirty Guard
  // =======================
  const snapshotRef = useRef<Snapshot | null>(null);

  const isDirty = useMemo(() => {
    // 🔥 regra de ouro: durante loading/saving não tem prompt
    if (loading || saving) return false;

    const snap = snapshotRef.current;
    if (!snap) return false;

    const a: Snapshot = {
      title: normTitle(title),
      description: normDesc(description),
      body: normText(body),
      status: status as ChapterStatus,
    };
    const b = normSnap(snap);

    return a.title !== b.title || a.description !== b.description || a.body !== b.body || a.status !== b.status;
  }, [title, description, body, status, loading, saving]);

  const dirtyInfo = useMemo(() => {
    const snap = snapshotRef.current;
    if (!snap) return "snapshot: null";
    const cur: Snapshot = {
      title: normTitle(title),
      description: normDesc(description),
      body: normText(body),
      status: status as ChapterStatus,
    };
    const b = normSnap(snap);
    const diffs = diffDirty(cur, b);
    return diffs.length ? diffs.join(" | ") : "OK (no diffs)";
  }, [title, description, body, status]);

  function confirmIfDirty(actionLabel: string): boolean {
    if (!isDirty) return true;
    try {
      return window.confirm(
        `Você tem alterações não salvas.\n\nAção: ${actionLabel}\n\nSe continuar, você pode perder o que digitou.\n\nContinuar mesmo assim?`
      );
    } catch {
      return true;
    }
  }

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      (e as any).returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    try {
      const onStorage = (e: StorageEvent) => {
        if (!e) return;
        if (e.storageArea !== sessionStorage) return;
        if (e.key !== "hdud_open_chapter_id") return;
        const n = Number(String(e.newValue ?? "").trim());
        if (Number.isFinite(n) && n > 0) {
          pendingOpenChapterIdRef.current = n;
          void loadList();
        }
      };
      window.addEventListener("storage", onStorage as any);
      return () => window.removeEventListener("storage", onStorage as any);
    } catch {
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      if (seq !== listSeqRef.current) return; // ✅ resposta velha

      setApiInfo("LIST", result.usedPath || "—", result.attempts);

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
          published_at:
            x.published_at != null ? String(x.published_at) : x.publishedAt != null ? String(x.publishedAt) : null,
        }))
        .filter((x) => Number.isFinite(x.chapter_id) && x.chapter_id > 0);

      setItems(normalized);

      // ✅ prioridade: deep-link da Timeline
      const pending = pendingOpenChapterIdRef.current;
      if (pending) {
        const exists = normalized.some((c) => c.chapter_id === pending);
        if (exists) {
          if (!confirmIfDirty("Abrir capítulo vindo da Timeline")) {
            setToastAuto({
              kind: "warn",
              msg: "Você está com alterações não salvas. Salve antes de abrir outro capítulo.",
            });
            pendingOpenChapterIdRef.current = null;
            return;
          }
          pendingOpenChapterIdRef.current = null;
          await loadDetail(pending);
          try {
            window.scrollTo({ top: 0, behavior: "smooth" });
          } catch {}
          return;
        } else {
          pendingOpenChapterIdRef.current = null;
        }
      }

      // seleção inicial (só se nada selecionado)
      if (!selectedChapterId && normalized.length > 0) {
        void loadDetail(normalized[0].chapter_id);
      }
    } finally {
      if (seq === listSeqRef.current) setLoading(false);
    }
  }

  async function loadDetail(chapterId: number) {
    if (needAuthGuard()) return;

    const seq = ++detailSeqRef.current;

    setLoading(true);
    setToast(null);

    try {
      const result = await tryMany<any>([
        () => apiRequest<any>(`/api/chapters/${chapterId}`, { method: "GET" }),
        () => apiRequest<any>(`/api/chapter/${chapterId}`, { method: "GET" }),
        () => apiRequest<any>(`/api/authors/${authorId}/chapters/${chapterId}`, { method: "GET" }),
        () => apiRequest<any>(`/api/author/${authorId}/chapters/${chapterId}`, { method: "GET" }),
      ]);

      if (seq !== detailSeqRef.current) return; // ✅ resposta velha

      setApiInfo("DETAIL", result.usedPath || "—", result.attempts);

      const d = unwrapDetail(result.data);

      if (!result.ok || !d) {
        const hint =
          result.status === 401
            ? "401 (token expirado). Faça login novamente."
            : result.status === 404
            ? "404 (rota não existe / id não encontrado)."
            : `HTTP ${result.status || "erro"}`;

        setToastAuto({ kind: "err", msg: `Falha ao abrir capítulo (${hint}).` });
        return;
      }

      const nextId = Number(d.chapter_id);
      const nextTitle = String(d.title ?? "");
      const nextDesc = String(d.description ?? "");
      const nextStatus = toStatus(d.status);

      const v =
        d.current_version_id && Number.isFinite(Number(d.current_version_id)) ? `v${Number(d.current_version_id)}` : "v1";

      const fromCurrent = (result.data as any)?.current_version?.body;
      const flat = typeof (d as any).body === "string" ? (d as any).body : null;
      const nextBody = typeof fromCurrent === "string" ? fromCurrent : flat !== null ? flat : "";

      // aplica state
      setSelectedChapterId(nextId);
      setTitle(nextTitle);
      setDescription(nextDesc);
      setStatus(nextStatus);
      setVersionLabel(v);
      setCreatedAt(formatDateBR(d.created_at));
      setUpdatedAt(formatDateBR(d.updated_at));
      setPublishedAt(d.published_at ? formatDateBR(d.published_at) : "—");
      setBody(nextBody);

      didFocusTitle.current = false;
      didFocusDesc.current = false;

      // ✅ snapshot SEMPRE derivado dos mesmos valores aplicados acima
      snapshotRef.current = normSnap({ title: nextTitle, description: nextDesc, body: nextBody, status: nextStatus });
    } finally {
      if (seq === detailSeqRef.current) setLoading(false);
    }
  }

  async function createChapter() {
    if (needAuthGuard()) return;
    if (!confirmIfDirty("Criar novo capítulo")) return;

    setSaving(true);
    setToast(null);

    try {
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
    } finally {
      setSaving(false);
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

    try {
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

      setApiInfo("SAVE", result.usedPath || "—", result.attempts);

      if (!result.ok) {
        const hint =
          result.status === 401
            ? "401 (token expirado). Faça login novamente."
            : result.status === 404
            ? "404 (rota de update não existe no backend)."
            : `HTTP ${result.status || "erro"}`;

        setToastAuto({ kind: "err", msg: `Falha ao salvar (${hint}).` });
        return;
      }

      // ✅ snapshot imediato do que está na tela (normalizado)
      snapshotRef.current = normSnap({
        title: t,
        description: String(description ?? ""),
        body: String(body ?? ""),
        status,
      });

      setToastAuto({ kind: "ok", msg: "Salvo." });

      // resync (sem gerar dirty)
      await loadList();
      await loadDetail(selectedChapterId);
    } finally {
      setSaving(false);
    }
  }

  async function publishChapter() {
    if (!selectedChapterId) return;
    if (needAuthGuard()) return;

    if (isDirty) {
      setToastAuto({ kind: "warn", msg: "Você tem alterações não salvas. Salve antes de publicar." });
      return;
    }

    setSaving(true);
    setToast(null);

    try {
      const result = await tryMany<any>([
        () => apiRequest<any>(`/api/chapters/${selectedChapterId}/publish`, { method: "POST" }),
        () => apiRequest<any>(`/api/chapter/${selectedChapterId}/publish`, { method: "POST" }),
        () => apiRequest<any>(`/api/chapters/${selectedChapterId}/publicar`, { method: "POST" }),
        () => apiRequest<any>(`/api/chapter/${selectedChapterId}/publicar`, { method: "POST" }),
        () =>
          apiRequest<any>(`/api/authors/${authorId}/chapters/${selectedChapterId}/publish`, {
            method: "POST",
          }),
        () =>
          apiRequest<any>(`/api/author/${authorId}/chapters/${selectedChapterId}/publish`, {
            method: "POST",
          }),
      ]);

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
    } finally {
      setSaving(false);
    }
  }

  async function unpublishChapter() {
    if (!selectedChapterId) return;
    if (needAuthGuard()) return;

    if (isDirty) {
      setToastAuto({ kind: "warn", msg: "Você tem alterações não salvas. Salve antes de despublicar." });
      return;
    }

    setSaving(true);
    setToast(null);

    try {
      const result = await tryMany<any>([
        () => apiRequest<any>(`/api/chapters/${selectedChapterId}/unpublish`, { method: "POST" }),
        () => apiRequest<any>(`/api/chapter/${selectedChapterId}/unpublish`, { method: "POST" }),
        () => apiRequest<any>(`/api/chapters/${selectedChapterId}/despublicar`, { method: "POST" }),
        () => apiRequest<any>(`/api/chapter/${selectedChapterId}/despublicar`, { method: "POST" }),
        () =>
          apiRequest<any>(`/api/authors/${authorId}/chapters/${selectedChapterId}/unpublish`, {
            method: "POST",
          }),
        () =>
          apiRequest<any>(`/api/author/${authorId}/chapters/${selectedChapterId}/unpublish`, {
            method: "POST",
          }),
      ]);

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
    } finally {
      setSaving(false);
    }
  }

  const headerCount = items.length;

  const filteredItems = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((c) => {
      const t = (c.title ?? "").toLowerCase();
      const d = (c.description ?? "").toLowerCase();
      return t.includes(needle) || d.includes(needle);
    });
  }, [items, q]);

  // ✅ monta uma vez: loadList quando token+authorId estiverem ok
  const bootedRef = useRef(false);
  useEffect(() => {
    if (bootedRef.current) return;
    if (!token || !authorId) return;
    bootedRef.current = true;
    void loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, authorId]);

  const selectedTitlePreview = title?.trim() ? title.trim() : selectedChapterId ? "Capítulo" : "—";

  const badgeToneClass = (s: ChapterStatus) => (s === "PUBLIC" ? "badge-public" : "badge-draft");

  return (
    <div className="hdud-page">
      <div className="hdud-container" style={{ margin: "0 auto" }}>
        {/* Header (padrão HDUD) */}
        <div className="hdud-card">
          <div className="hdud-pagehead">
            <div style={{ minWidth: 0 }}>
              <h1 className="hdud-pagehead-title">Sua jornada</h1>
              <p className="hdud-pagehead-subtitle">
                Aqui você organiza sua história em <b>capítulos</b> (fases). Entre em um capítulo, escreva, refine e publique quando quiser.{" "}
                <span style={{ opacity: 0.85 }}>Memórias/Timeline continuam no core — fora desta tela.</span>
              </p>
            </div>

            <div className="hdud-actions">
              <div style={styles.pill}>jornada • capítulos = fases • escrita com calma</div>

              <button
                className="hdud-btn"
                onClick={() => {
                  if (loading || saving) return;
                  if (!confirmIfDirty("Atualizar lista")) return;
                  void loadList();
                }}
                disabled={loading || saving}
                title="Recarrega lista e, se necessário, seleciona o primeiro"
              >
                Atualizar
              </button>

              <button
                className="hdud-btn hdud-btn-primary"
                onClick={createChapter}
                disabled={saving}
                title="Cria um capítulo rascunho no banco"
              >
                + Novo capítulo
              </button>
            </div>
          </div>

          {/* Meta + diagnóstico */}
          <div style={styles.headerMeta}>
            <div style={styles.metaRow}>
              <span style={styles.smallMuted}>
                {authorId ? `author_id: ${authorId}` : "author_id: —"} • {headerCount} capítulo(s)
                {isDirty ? (
                  <span style={styles.dirtyDot} title="Alterações não salvas">
                    {" "}
                    • ● não salvo
                  </span>
                ) : null}
              </span>

              <button
                type="button"
                className="hdud-btn"
                style={styles.diagBtn}
                onClick={() => setShowDiag((v) => !v)}
                title="Mostrar/ocultar diagnóstico de rotas (sem tocar API)"
              >
                {showDiag ? "Ocultar diagnóstico" : "Mostrar diagnóstico"}
              </button>
            </div>

            {showDiag && (
              <div style={styles.diagBox}>
                <div style={styles.diagLine}>
                  <b>API</b>: {lastApiInfo || "—"}
                </div>
                <div style={styles.diagLine}>
                  <b>DIRTY</b>: {dirtyInfo}
                </div>
                <div style={styles.diagHint}>*diagnóstico local (rota que funcionou + tentativas). Não altera API.*</div>
              </div>
            )}
          </div>

          {/* Toast padronizado */}
          {toast && (
            <div
              className={[
                "hdud-alert",
                toast.kind === "ok"
                  ? "hdud-alert-success"
                  : toast.kind === "warn"
                  ? "hdud-alert-warn"
                  : "hdud-alert-danger",
              ].join(" ")}
              style={{ marginTop: 10 }}
            >
              {toast.msg}
            </div>
          )}

          {!canUseApi ? (
            <div className="hdud-alert hdud-alert-warn" style={{ marginTop: 12 }}>
              Token ausente. Faça login para ver/editar capítulos.
            </div>
          ) : null}
        </div>

        {/* Grid principal */}
        <div style={styles.grid}>
          {/* left: list */}
          <div className="hdud-card">
            <div style={styles.listHeader}>
              <div>
                <div style={styles.cardTitle}>Etapas da sua jornada</div>
                <div style={styles.cardMeta}>Fases/estruturas da sua história</div>
              </div>
              <div style={styles.cardMetaRight}>
                <div style={styles.cardMeta}>{items.length} item(ns)</div>
              </div>
            </div>

            <div style={styles.searchRow}>
              <input
                className="hdud-input"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por título ou descrição…"
                aria-label="Buscar capítulos"
              />
              {q.trim() ? (
                <button className="hdud-btn" onClick={() => setQ("")} title="Limpar busca">
                  Limpar
                </button>
              ) : null}
            </div>

            {items.length === 0 ? (
              <div style={styles.emptyBox}>
                <div style={styles.emptyTitle}>Sua casa ainda está vazia.</div>
                <div style={styles.emptyText}>
                  Crie seu primeiro <b>capítulo</b> (uma fase da sua vida). Depois, você entra nele e escreve com calma — sem pressa.
                </div>
                <button className="hdud-btn hdud-btn-primary" style={{ marginTop: 10 }} onClick={createChapter} disabled={saving}>
                  + Criar meu primeiro capítulo
                </button>
              </div>
            ) : filteredItems.length === 0 ? (
              <div style={styles.emptyBox}>
                Nenhum capítulo encontrado para <b>{q.trim()}</b>.
              </div>
            ) : (
              <div style={styles.listWrap}>
                {filteredItems.map((c) => {
                  const isSelected = c.chapter_id === selectedChapterId;
                  const badgeClass = badgeToneClass(c.status);

                  return (
                    <button
                      key={c.chapter_id}
                      style={{ ...styles.itemBtn, ...(isSelected ? styles.itemBtnActive : {}) }}
                      onClick={() => {
                        if (loading || saving) return;
                        if (c.chapter_id !== selectedChapterId) {
                          if (!confirmIfDirty("Trocar de capítulo")) return;
                        }
                        void loadDetail(c.chapter_id);
                      }}
                      title="Abrir capítulo"
                    >
                      <div style={styles.itemTop}>
                        <div style={styles.itemTitle}>
                          <b>{c.title || "Sem título"}</b>
                          <span style={styles.itemId}>#{c.chapter_id}</span>
                        </div>

                        <span
                          style={{
                            ...styles.badge,
                            ...(c.status === "PUBLIC" ? styles.badgePublic : styles.badgeDraft),
                          }}
                          className={badgeClass}
                        >
                          {c.status === "PUBLIC" ? "Público" : "Rascunho"}
                        </span>
                      </div>

                      <div style={styles.itemDesc}>{c.description || "—"}</div>

                      <div style={styles.itemMeta}>
                        Atualizado: {formatDateBR(c.updated_at)} • Criado: {formatDateBR(c.created_at)}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* right: editor */}
          <div className="hdud-card" style={{ minHeight: 420 }}>
            <div style={styles.editorHeader}>
              <div>
                <div style={styles.cardTitle}>Escrevendo</div>
                <div style={styles.cardMeta}>
                  Criado: {createdAt} • Última atualização: {updatedAt} • Publicado: {publishedAt}
                </div>
              </div>

              <div style={styles.editorBadges}>
                <span style={styles.badgeSoft}>ID {selectedChapterId ?? "—"}</span>
                <span style={styles.badgeSoft}>{versionLabel}</span>
                <span
                  style={{
                    ...styles.badge,
                    ...(status === "PUBLIC" ? styles.badgePublic : styles.badgeDraft),
                  }}
                >
                  {status === "PUBLIC" ? "Público" : "Rascunho"}
                </span>
              </div>

              <div style={styles.editorActions}>
                <button
                  className="hdud-btn"
                  onClick={() => {
                    if (!selectedChapterId) return;
                    if (!confirmIfDirty("Recarregar capítulo (perde mudanças locais)")) return;
                    void loadDetail(selectedChapterId);
                  }}
                  disabled={loading || saving || !selectedChapterId}
                >
                  Recarregar
                </button>

                <button
                  className="hdud-btn hdud-btn-primary"
                  onClick={saveChapter}
                  disabled={saving || loading || !selectedChapterId}
                >
                  Salvar
                </button>

                {status === "PUBLIC" ? (
                  <button className="hdud-btn" onClick={unpublishChapter} disabled={saving || loading || !selectedChapterId}>
                    Despublicar
                  </button>
                ) : (
                  <button className="hdud-btn" onClick={publishChapter} disabled={saving || loading || !selectedChapterId}>
                    Publicar
                  </button>
                )}
              </div>
            </div>

            {!selectedChapterId ? (
              <div style={styles.rightEmpty}>
                <div style={styles.rightEmptyTitle}>Escolha uma etapa</div>
                <div style={styles.rightEmptyText}>
                  À esquerda, selecione um capítulo (uma fase). Aqui você escreve e refina o texto do capítulo, sem pressão.
                </div>
              </div>
            ) : (
              <div style={styles.form}>
                <label style={styles.label}>
                  <span style={styles.labelTop}>Título (livre)</span>
                  <input
                    className="hdud-input"
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
                  <span style={styles.labelTop}>Descrição (uma frase)</span>
                  <input
                    className="hdud-input"
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
                    className="hdud-textarea"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Escreva aqui…"
                    style={{ minHeight: 220 }}
                  />
                  <span style={styles.counter}>{(body || "").length} caracteres</span>
                </label>

                <div style={styles.noteMuted}>
                  Nota: esta tela é “camada narrativa” determinística. Integração com IA/geração entra depois, sem mexer no core.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Guia (mantém premium) */}
        <div className="hdud-card" style={{ marginTop: 18 }}>
          <div style={styles.suggestTitle}>
            Guia de escrita (opcional) — <b>{selectedTitlePreview}</b>
          </div>
          <ul style={styles.suggestList}>
            <li>Qual cenário define essa fase (casa, cidade, rotina, clima, época)?</li>
            <li>Quem são as pessoas centrais aqui? O que elas significam para você?</li>
            <li>Qual foi a virada (o antes e o depois)?</li>
            <li>Gancho do seu texto: {body ? `${compactText(body, 48)}` : "(ainda vazio)"}</li>
          </ul>
          <div style={styles.suggestHint}>*isso é só guia premium de escrita (determinístico)*</div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  grid: { display: "grid", gridTemplateColumns: "360px 1fr", gap: 18, alignItems: "start", marginTop: 18 },

  pill: {
    background: "var(--hdud-surface-2)",
    border: "1px solid var(--hdud-border)",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    opacity: 0.9,
    fontWeight: 900,
  },

  headerMeta: { marginTop: 10 },
  metaRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" },
  smallMuted: { fontSize: 12, opacity: 0.7 },
  dirtyDot: { fontSize: 12, fontWeight: 900, opacity: 0.85 },

  diagBtn: { borderRadius: 999, padding: "6px 10px", fontSize: 12, fontWeight: 900, opacity: 0.8 },
  diagBox: {
    marginTop: 10,
    border: "1px dashed var(--hdud-border)",
    background: "var(--hdud-surface-2)",
    borderRadius: 12,
    padding: 10,
  },
  diagLine: { fontSize: 12, opacity: 0.85 },
  diagHint: { marginTop: 6, fontSize: 11, opacity: 0.6 },

  listHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },
  cardTitle: { fontWeight: 950, fontSize: 14 },
  cardMeta: { fontSize: 12, opacity: 0.7, marginTop: 3 },
  cardMetaRight: { display: "flex", alignItems: "center", gap: 10 },

  searchRow: { display: "flex", gap: 8, marginBottom: 10, alignItems: "center" },

  emptyBox: {
    border: "1px dashed var(--hdud-border)",
    borderRadius: 12,
    padding: 14,
    opacity: 0.95,
    fontSize: 13,
    lineHeight: 1.35,
    background: "rgba(255,255,255,0.02)",
  },
  emptyTitle: { fontWeight: 950, marginBottom: 6, fontSize: 13 },
  emptyText: { opacity: 0.85 },

  listWrap: { display: "flex", flexDirection: "column", gap: 10 },

  itemBtn: {
    border: "1px solid var(--hdud-border)",
    background: "var(--hdud-surface-2)",
    color: "var(--hdud-text)",
    borderRadius: 12,
    padding: 12,
    cursor: "pointer",
    textAlign: "left",
    transition: "transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease",
  },
  itemBtnActive: { outline: "2px solid var(--hdud-accent-border)" },

  itemTop: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 },
  itemTitle: { fontSize: 13, fontWeight: 950, display: "flex", alignItems: "center", gap: 8 },
  itemId: { fontSize: 11, opacity: 0.65, fontWeight: 900 },
  itemDesc: { marginTop: 6, fontSize: 12, opacity: 0.78, lineHeight: 1.3 },
  itemMeta: { marginTop: 8, fontSize: 11, opacity: 0.65 },

  badge: {
    fontSize: 11,
    fontWeight: 950,
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid var(--hdud-border)",
    color: "var(--hdud-text)",
    whiteSpace: "nowrap",
  },
  badgeDraft: { background: "rgba(255,180,0,0.15)" },
  badgePublic: { background: "rgba(0,200,120,0.15)" },

  badgeSoft: {
    fontSize: 11,
    fontWeight: 950,
    padding: "4px 8px",
    borderRadius: 999,
    background: "var(--hdud-surface-2)",
    border: "1px solid var(--hdud-border)",
    color: "var(--hdud-text)",
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

  rightEmpty: {
    border: "1px dashed var(--hdud-border)",
    borderRadius: 12,
    padding: 18,
    opacity: 0.95,
    background: "rgba(255,255,255,0.02)",
  },
  rightEmptyTitle: { fontWeight: 950, marginBottom: 6, fontSize: 13 },
  rightEmptyText: { fontSize: 12, opacity: 0.78, lineHeight: 1.35 },

  form: { marginTop: 10, display: "flex", flexDirection: "column", gap: 12 },
  label: { display: "flex", flexDirection: "column", gap: 6 },
  labelTop: { fontSize: 12, fontWeight: 950, opacity: 0.85 },
  counter: { fontSize: 11, opacity: 0.65 },

  noteMuted: { fontSize: 11, opacity: 0.62, marginTop: 2 },

  suggestTitle: { fontSize: 13, fontWeight: 950, marginBottom: 8 },
  suggestList: { margin: 0, paddingLeft: 18, fontSize: 12, opacity: 0.85, lineHeight: 1.35 },
  suggestHint: { marginTop: 8, fontSize: 11, opacity: 0.62 },
};
