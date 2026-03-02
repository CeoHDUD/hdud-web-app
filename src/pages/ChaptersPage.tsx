// C:\HDUD_DATA\hdud-web-app\src\pages\ChaptersPage.tsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import ChaptersListPage from "./ChaptersListPage";

/**
 * ChaptersPage (compat)
 * - Mantido para não quebrar imports legados.
 * - Fluxo dedicado real está em:
 *   /chapters        -> ChaptersListPage
 *   /chapters/:id    -> ChapterEditorPage
 */


/**
 * ChaptersPage (MVP) — API REAL (sem tocar em Memórias/Core)
 * - Persistência: HDUD-API-Node (banco) -> identity_chapter + identity_chapter_versions
 * - Lista à esquerda + editor à direita
 * - Ações: salvar / publicar / recarregar
 *
 * ✅ Deep-link da Timeline:
 * - Se existir sessionStorage.hdud_open_chapter_id, abre automaticamente esse capítulo ao entrar.
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
 *
 * ✅ UI vNext:
 * - Header/Topbar no estilo “Memórias”: título + CTA + busca + filtros + ordenação + ações.
 * - Card “Histórico” com lista e painel.
 */

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
  // capítulo atualmente aberto no painel direito (editor)
  const [openChapterId, setOpenChapterId] = useState<number | null>(null);

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
  const [showGuide, setShowGuide] = useState<boolean>(false);

  // ✅ Header controls “estilo Memórias”
  const [q, setQ] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("RECENT");

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

      if (seq !== listSeqRef.current) return;

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
          published_at: x.published_at != null ? String(x.published_at) : x.publishedAt != null ? String(x.publishedAt) : null,
        }))
        .filter((x) => Number.isFinite(x.chapter_id) && x.chapter_id > 0);

      setItems(normalized);

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

      // ✅ Não auto-abrir editor: por padrão o painel direito fica em placeholder.
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(chapterId: number) {
    if (needAuthGuard()) return;

    const seq = ++detailSeqRef.current;

    setLoading(true);
    setToast(null);

    try {
      const result = await tryMany<any>([
        () => apiRequest<any>(`/api/chapter/${chapterId}`, { method: "GET" }),
        () => apiRequest<any>(`/api/chapters/${chapterId}`, { method: "GET" }),
        () => apiRequest<any>(`/api/chapter/detail/${chapterId}`, { method: "GET" }),
        () => apiRequest<any>(`/api/chapters/detail/${chapterId}`, { method: "GET" }),
      ]);

      if (seq !== detailSeqRef.current) return;

      setApiInfo("DETAIL", result.usedPath || "—", result.attempts);

      if (!result.ok || !result.data) {
        const hint =
          result.status === 401 ? "401 (token expirado)." : result.status === 404 ? "404 (não encontrado)." : `HTTP ${result.status || "erro"}`;

        setToastAuto({ kind: "err", msg: `Falha ao abrir capítulo (${hint}).` });
        return;
      }

      const d = unwrapDetail(result.data);
      if (!d) {
        setToastAuto({ kind: "err", msg: "Resposta inválida ao abrir capítulo." });
        return;
      }

      setSelectedChapterId(chapterId);
      setOpenChapterId(chapterId);

      setTitle(String(d.title ?? ""));
      setDescription(String(d.description ?? ""));
      setBody(normText((d as any).body ?? (d as any).content ?? ""));

      const st = toStatus((d as any).status);
      setStatus(st);

      setCreatedAt(formatDateBR((d as any).created_at ?? (d as any).createdAt ?? null));
      setUpdatedAt(formatDateBR((d as any).updated_at ?? (d as any).updatedAt ?? null));
      setPublishedAt(formatDateBR((d as any).published_at ?? (d as any).publishedAt ?? null));

      const curVer =
        (d as any).current_version_id != null
          ? Number((d as any).current_version_id)
          : (d as any).currentVersionId != null
          ? Number((d as any).currentVersionId)
          : null;
      setVersionLabel(curVer ? `v${curVer}` : "v1");

      snapshotRef.current = normSnap({
        title: String(d.title ?? ""),
        description: String(d.description ?? ""),
        body: normText((d as any).body ?? (d as any).content ?? ""),
        status: st,
      });

      didFocusTitle.current = false;
      didFocusDesc.current = false;
    } finally {
      setLoading(false);
    }
  }

  async function createChapter(preset?: { title: string; description?: string | null }) {
    if (needAuthGuard()) return;
    if (!confirmIfDirty("Criar novo capítulo")) return;

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

  async function reloadSelected() {
    if (!openChapterId) return;
    if (!confirmIfDirty("Recarregar capítulo")) return;
    await loadDetail(openChapterId);
    setToastAuto({ kind: "ok", msg: "Capítulo recarregado." });
  }

  async function saveDraft() {
    if (needAuthGuard()) return;
    if (!openChapterId) return;

    setSaving(true);
    setToast(null);

    try {
      const payload = {
        title: safeTrimOrNull(title) ?? "",
        description: safeTrimOrNull(description),
        body: body ?? "",
        status: "DRAFT",
      };

      const result = await tryMany<any>([
        () =>
          apiRequest<any>(`/api/chapter/${openChapterId}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          }),
        () =>
          apiRequest<any>(`/api/chapters/${openChapterId}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          }),
      ]);

      setApiInfo("SAVE", result.usedPath || "—", result.attempts);

      if (!result.ok) {
        const hint =
          result.status === 401 ? "401 (token expirado)." : result.status === 404 ? "404 (rota não existe)." : `HTTP ${result.status || "erro"}`;
        setToastAuto({ kind: "err", msg: `Falha ao salvar (${hint}).` });
        return;
      }

      snapshotRef.current = normSnap({
        title: normTitle(title),
        description: normDesc(description),
        body: normText(body),
        status: "DRAFT",
      });

      setStatus("DRAFT");
      setToastAuto({ kind: "ok", msg: "Salvo (rascunho)." });
      await loadList();
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    if (needAuthGuard()) return;
    if (!openChapterId) return;

    setSaving(true);
    setToast(null);

    try {
      const payload = {
        title: safeTrimOrNull(title) ?? "",
        description: safeTrimOrNull(description),
        body: body ?? "",
        status: "PUBLIC",
      };

      const result = await tryMany<any>([
        () =>
          apiRequest<any>(`/api/chapter/${openChapterId}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          }),
        () =>
          apiRequest<any>(`/api/chapters/${openChapterId}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          }),
      ]);

      setApiInfo("PUBLISH", result.usedPath || "—", result.attempts);

      if (!result.ok) {
        const hint =
          result.status === 401 ? "401 (token expirado)." : result.status === 404 ? "404 (rota não existe)." : `HTTP ${result.status || "erro"}`;
        setToastAuto({ kind: "err", msg: `Falha ao publicar (${hint}).` });
        return;
      }

      setStatus("PUBLIC");

      snapshotRef.current = normSnap({
        title: normTitle(title),
        description: normDesc(description),
        body: normText(body),
        status: "PUBLIC",
      });

      setToastAuto({ kind: "ok", msg: "Publicado." });
      await loadList();
      await loadDetail(openChapterId);
    } finally {
      setSaving(false);
    }
  }

  function clearSelection() {
    if (!confirmIfDirty("Fechar editor")) return;

    setSelectedChapterId(null);
    setOpenChapterId(null);
    setTitle("");
    setDescription("");
    setBody("");
    setStatus("DRAFT");
    setVersionLabel("v1");
    setCreatedAt("—");
    setUpdatedAt("—");
    setPublishedAt("—");
    snapshotRef.current = null;
    didFocusTitle.current = false;
    didFocusDesc.current = false;
  }

  const filteredItems = useMemo(() => {
    const needle = q.trim().toLowerCase();

    let list = items.slice();

    if (statusFilter !== "ALL") {
      list = list.filter((c) => c.status === statusFilter);
    }

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

  const selectedTitlePreview = useMemo(() => {
    const found = items.find((x) => x.chapter_id === openChapterId);
    return found?.title?.trim() ? found.title : "capítulo";
  }, [items, openChapterId]);

  useEffect(() => {
    if (!canUseApi) {
      setToastAuto({ kind: "warn", msg: "Token ausente. Faça login para ver/editar capítulos." });
      return;
    }
    void loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUseApi]);

  const totalCount = items.length;
  const filteredCount = filteredItems.length;

  return (
    <div style={{ padding: 0, color: "var(--hdud-text)" }}>
      <div style={styles.pageWrap}>
        {/* =========================
            HEADER (estilo Memórias)
           ========================= */}
        <div className="hdud-card" style={styles.headerCard}>
          <div style={styles.headerTopRow}>
            <div>
              <div style={styles.h1}>Capítulos</div>
              <div style={styles.hSub}>
                Organize sua história em fases. Crie, refine e publique quando quiser. <b>Memórias/Timeline</b> continuam no core.
              </div>

              <div style={styles.metaLine}>
                <span style={styles.metaBadge}>author_id: {authorId ?? "—"}</span>
                <span style={styles.metaBadge}>{totalCount} item(ns)</span>
                {statusFilter !== "ALL" ? <span style={styles.metaBadge}>filtro: {statusFilter === "PUBLIC" ? "públicos" : "rascunhos"}</span> : null}
                {q.trim() ? <span style={styles.metaBadge}>busca: “{compactText(q.trim(), 18)}”</span> : null}
              </div>
            </div>

            <div style={styles.headerCTACol}>
              <button className="hdud-btn hdud-btn-primary" onClick={() => createChapter()} disabled={loading || saving} style={styles.ctaBtn}>
                + Criar capítulo
              </button>
            </div>
          </div>

          <div style={styles.headerControlsRow}>
            <input
              className="hdud-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar (título ou descrição)..."
              style={styles.searchInput}
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

            <div style={{ flex: 1 }} />

            <button className="hdud-btn" onClick={() => loadList()} disabled={loading || saving}>
              {loading ? "Atualizando..." : "Atualizar"}
            </button>

            <button className="hdud-btn" onClick={() => setShowDiag((v) => !v)} disabled={loading || saving}>
              {showDiag ? "Ocultar diagnóstico" : "Mostrar diagnóstico"}
            </button>
          </div>

          {toast && (
            <div
              style={{
                marginTop: 12,
                padding: 10,
                borderRadius: 10,
                border: "1px solid var(--hdud-border)",
                background:
                  toast.kind === "ok" ? "rgba(52, 199, 89, 0.10)" : toast.kind === "warn" ? "rgba(255, 204, 0, 0.10)" : "rgba(255, 59, 48, 0.10)",
              }}
            >
              <b style={{ textTransform: "uppercase", fontSize: 11, opacity: 0.8 }}>{toast.kind}</b> — {toast.msg}
            </div>
          )}

          {showDiag && (
            <div style={styles.diagBox}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>Diagnóstico</div>
              <div style={styles.diagLine}>token: {token ? "OK" : "—"}</div>
              <div style={styles.diagLine}>authorId (JWT): {authorId ?? "—"}</div>
              <div style={styles.diagLine}>API: {lastApiInfo || "—"}</div>
              <div style={styles.diagLine}>isDirty: {String(isDirty)}</div>
              <div style={styles.diagLine}>dirtyInfo: {dirtyInfo}</div>
            </div>
          )}
        </div>

        {/* =========================
            HISTÓRICO (estilo Memórias)
           ========================= */}
        <div className="hdud-card" style={{ marginTop: 18 }}>
          <div style={styles.historyHeader}>
            <div style={styles.historyTitle}>Histórico</div>
            <div style={styles.historyRight}>
              <span style={styles.historyPill}>{filteredCount} item(ns)</span>
            </div>
          </div>

          <div style={styles.historyBodyGrid}>
            {/* LEFT LIST */}
            <div style={styles.leftCol}>
              <div style={styles.leftList}>
                {filteredItems.map((c) => {
                  const isSel = c.chapter_id === selectedChapterId;
                  const statusLabel = c.status === "PUBLIC" ? "Público" : "Rascunho";

                  return (
                    <div
                      key={c.chapter_id}
                      style={{
                        ...styles.itemCard,
                        outline: isSel ? "2px solid rgba(0,0,0,0.12)" : "none",
                        background: isSel ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)",
                      }}
                      onClick={() => {
                        if (isSel) return;
                        // clique no card só seleciona (não abre editor)
                        if (openChapterId && isDirty && !confirmIfDirty("Selecionar capítulo (sem abrir editor)")) return;
                        setSelectedChapterId(c.chapter_id);
                      }}
                      role="button"
                    >
                      <div style={styles.itemTopRow}>
                        <div style={styles.itemTitle}>
                          {c.title || `Capítulo #${c.chapter_id}`}{" "}
                          <span style={{ opacity: 0.7, fontWeight: 800, fontSize: 12 }}>#{c.chapter_id}</span>
                        </div>

                        <span style={styles.statusPill}>{statusLabel}</span>
                      </div>

                      {c.description ? <div style={styles.itemDesc}>{compactText(String(c.description), 110)}</div> : null}

                      <div style={styles.itemMeta}>
                        <span>{formatDateBR(c.updated_at)}</span>
                        <span style={{ opacity: 0.6 }}>•</span>
                        <span>{c.status === "PUBLIC" ? "publicado" : "editável"}</span>
                      </div>

                      <div style={styles.itemActions}>
                        <button
                          className="hdud-btn"
                          style={{ padding: "6px 10px" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!confirmIfDirty("Abrir capítulo para editar")) return;
                            void loadDetail(c.chapter_id);
                          }}
                        >
                          Abrir
                        </button>
                      </div>
                    </div>
                  );
                })}

                {!filteredItems.length ? (
                  <div style={styles.emptyList}>
                    <div style={{ fontWeight: 900 }}>Nada encontrado</div>
                    <div style={{ opacity: 0.75, marginTop: 6 }}>Tente limpar filtros ou criar um capítulo novo.</div>
                  </div>
                ) : null}
              </div>
            </div>

            {/* RIGHT PANEL */}
            <div style={styles.rightCol}>
              {!openChapterId ? (
                <div style={styles.rightEmpty}>
                  <div style={styles.rightEmptyKicker}>Sua jornada começa aqui</div>
                  <div style={styles.rightEmptyTitle}>Escolha uma etapa</div>
                  <div style={styles.rightEmptyText}>
                    Clique em um capítulo à esquerda para editar — ou crie uma nova fase com <b>+ Criar capítulo</b>.
                    <br />
                    O editor só aparece quando existe um capítulo “em foco”. Isso deixa a tela limpa e com cara de produto.
                  </div>

                  <div style={styles.rightEmptyDivider} />

                  <div style={styles.rightEmptySectionTitle}>Sugestões rápidas</div>
                  <div style={styles.rightEmptyText}>Crie uma etapa com um clique (rascunho) para acelerar a demo:</div>

                  <div style={styles.quickRow}>
                    <button
                      className="hdud-btn"
                      onClick={() =>
                        createChapter({
                          title: "Infância",
                          description: "As primeiras cenas: casa, pessoas, rotina e o que ficou marcado.",
                        })
                      }
                      disabled={loading || saving}
                    >
                      + Infância
                    </button>

                    <button
                      className="hdud-btn"
                      onClick={() =>
                        createChapter({
                          title: "Adolescência",
                          description: "Amizades, viradas, descobertas, medos e o começo do “eu”.",
                        })
                      }
                      disabled={loading || saving}
                    >
                      + Adolescência
                    </button>

                    <button
                      className="hdud-btn"
                      onClick={() =>
                        createChapter({
                          title: "Vida adulta",
                          description: "Trabalho, escolhas, quedas e construções — o que você virou.",
                        })
                      }
                      disabled={loading || saving}
                    >
                      + Vida adulta
                    </button>

                    <button
                      className="hdud-btn"
                      onClick={() =>
                        createChapter({
                          title: "Agora",
                          description: "O presente: o que está acontecendo e para onde você quer ir.",
                        })
                      }
                      disabled={loading || saving}
                    >
                      + Agora
                    </button>
                  </div>

                  <div style={styles.rightEmptyDivider} />

                  <div style={styles.rightEmptySectionTitle}>Como escrever aqui</div>
                  <ul style={styles.quickList}>
                    <li>1–2 frases sobre o cenário (onde/como era a vida).</li>
                    <li>As pessoas centrais e por quê.</li>
                    <li>A virada: o antes e o depois.</li>
                  </ul>

                  <div style={styles.rightEmptyHint}>Dica: você pode criar como rascunho agora e publicar depois — sem pressa.</div>
                </div>
              ) : (
                <div style={styles.form}>
                  <div style={styles.formHeader}>
                    <div>
                      <div style={styles.formTitle}>REGISTRAR</div>
                      <div style={styles.formMeta}>
                        Criado: {createdAt} • Última atualização: {updatedAt} • Publicado: {publishedAt}
                      </div>
                    </div>

                    <div style={styles.formBadges}>
                      <span style={styles.badge}>ID {openChapterId ?? "—"}</span>
                      <span style={styles.badge}>{versionLabel}</span>
                      <span style={styles.badge}>{status === "PUBLIC" ? "Público" : "Rascunho"}</span>
                    </div>
                  </div>

                  <div style={styles.formActions}>
                    <button className="hdud-btn" onClick={reloadSelected} disabled={loading || saving}>
                      Recarregar
                    </button>

                    <button className="hdud-btn hdud-btn-primary" onClick={saveDraft} disabled={loading || saving || !openChapterId}>
                      {saving ? "Salvando..." : "Salvar"}
                    </button>

                    <button className="hdud-btn" onClick={publish} disabled={loading || saving || !openChapterId}>
                      Publicar
                    </button>

                    <button className="hdud-btn" onClick={clearSelection} disabled={loading || saving}>
                      Fechar
                    </button>
                  </div>

                  <label style={styles.label}>
                    <span style={styles.labelTop}>Título (livre)</span>
                    <input
                      className="hdud-input"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      onFocus={() => {
                        if (!didFocusTitle.current) {
                          didFocusTitle.current = true;
                          if (openChapterId && title === DEFAULT_NEW_TITLE) setTitle("");
                        }
                      }}
                      placeholder="Ex.: Minha chegada ao mundo"
                    />
                    <span style={styles.counter}>{title.trim().length} / 120</span>
                  </label>

                  <label style={styles.label}>
                    <span style={styles.labelTop}>Descrição curta (opcional)</span>
                    <textarea
                      className="hdud-input"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      onFocus={() => {
                        if (!didFocusDesc.current) {
                          didFocusDesc.current = true;
                          if (openChapterId && description === DEFAULT_NEW_DESCRIPTION) setDescription("");
                        }
                      }}
                      placeholder="Uma frase curta sobre essa fase"
                      style={{ minHeight: 70, resize: "vertical" }}
                    />
                    <span style={styles.counter}>{description.trim().length} / 220</span>
                  </label>

                  <label style={styles.label}>
                    <span style={styles.labelTop}>Texto do capítulo</span>
                    <textarea
                      className="hdud-input"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="Escreva com calma. Isso é o mapa da sua vida."
                      style={{ minHeight: 260, resize: "vertical", fontFamily: "inherit" }}
                    />
                    <span style={styles.counter}>{body.trim().length} caracteres</span>
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Guia (mantido) */}
        <div className="hdud-card" style={{ marginTop: 18 }}>
          <div style={styles.suggestHeader}>
            <div style={styles.suggestTitle}>
              Guia de escrita (opcional) — <b>{selectedTitlePreview}</b>
            </div>

            <button className="hdud-btn" onClick={() => setShowGuide((v) => !v)} title="Alternar guia de escrita">
              {showGuide ? "Ocultar" : "Mostrar"}
            </button>
          </div>

          {showGuide ? (
            <>
              <ul style={styles.suggestList}>
                <li>Qual cenário define essa fase (casa, cidade, rotina, clima, época)?</li>
                <li>Quem são as pessoas centrais aqui? O que elas significam para você?</li>
                <li>Qual foi a virada (o antes e o depois)?</li>
                <li>Gancho do seu texto: {body ? `${compactText(body, 48)}` : "(ainda vazio)"}</li>
              </ul>
              <div style={styles.suggestHint}>*isso é só guia premium de escrita (determinístico)*</div>
            </>
          ) : (
            <div style={styles.suggestCollapsed}>Três perguntas para destravar a escrita — aberto quando você quiser.</div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  pageWrap: { width: "100%", maxWidth: 1920, margin: "0 auto", padding: "18px 18px", boxSizing: "border-box" },

  headerCard: {},
  headerTopRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap" },
  headerCTACol: { display: "flex", alignItems: "flex-start", justifyContent: "flex-end" },
  ctaBtn: { paddingLeft: 14, paddingRight: 14 },

  h1: { fontSize: 44, fontWeight: 950, letterSpacing: -0.9, margin: 0, lineHeight: 1.05 },
  hSub: { opacity: 0.78, fontSize: 13, marginTop: 8, lineHeight: 1.35, maxWidth: 760 },

  metaLine: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 },
  metaBadge: {
    fontSize: 12,
    opacity: 0.85,
    border: "1px solid var(--hdud-border)",
    background: "var(--hdud-surface-2)",
    padding: "4px 10px",
    borderRadius: 999,
    fontWeight: 800,
  },

  headerControlsRow: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 14 },
  searchInput: { flex: "1 1 320px", minWidth: 220 },
  select: { width: 180, minWidth: 160 },

  diagBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    border: "1px solid var(--hdud-border)",
    background: "rgba(255,255,255,0.02)",
  },
  diagLine: { fontSize: 12, opacity: 0.78, marginTop: 6 },

  historyHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 12,
    borderBottom: "1px solid var(--hdud-border)",
    marginBottom: 12,
  },
  historyTitle: { fontWeight: 950, fontSize: 14 },
  historyRight: { display: "flex", alignItems: "center", gap: 10 },
  historyPill: {
    border: "1px solid var(--hdud-border)",
    background: "var(--hdud-surface-2)",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    opacity: 0.9,
    whiteSpace: "nowrap",
  },

  historyBodyGrid: { display: "grid", gridTemplateColumns: "360px 1fr", gap: 18, alignItems: "start" },
  leftCol: {},
  rightCol: {},

  leftList: { display: "flex", flexDirection: "column", gap: 10 },
  itemCard: {
    border: "1px solid var(--hdud-border)",
    borderRadius: 12,
    padding: 12,
    cursor: "pointer",
    userSelect: "none",
  },
  itemTopRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  itemTitle: { fontWeight: 950, fontSize: 13, letterSpacing: -0.2 },
  itemDesc: { marginTop: 8, fontSize: 12, opacity: 0.78, lineHeight: 1.35 },
  itemMeta: { marginTop: 10, fontSize: 11, opacity: 0.7, display: "flex", gap: 8, alignItems: "center" },
  itemActions: { marginTop: 10, display: "flex", justifyContent: "flex-end" },

  statusPill: {
    border: "1px solid var(--hdud-border)",
    background: "var(--hdud-surface-2)",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    opacity: 0.9,
    whiteSpace: "nowrap",
  },

  emptyList: {
    border: "1px dashed var(--hdud-border)",
    borderRadius: 12,
    padding: 14,
    background: "rgba(255,255,255,0.02)",
  },

  rightEmpty: {
    border: "1px dashed var(--hdud-border)",
    borderRadius: 12,
    padding: 16,
    background: "rgba(255,255,255,0.02)",
  },
  rightEmptyKicker: { fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase", opacity: 0.7, fontWeight: 900 },
  rightEmptyTitle: { fontSize: 18, fontWeight: 950, marginTop: 6 },
  rightEmptyText: { marginTop: 10, fontSize: 12, opacity: 0.78, lineHeight: 1.45, maxWidth: 680 },
  rightEmptyDivider: { marginTop: 14, marginBottom: 14, height: 1, background: "var(--hdud-border)", opacity: 0.7 },
  rightEmptySectionTitle: { fontSize: 12, fontWeight: 950, opacity: 0.9 },
  rightEmptyHint: { marginTop: 10, fontSize: 12, opacity: 0.75 },

  quickRow: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 },
  quickList: { marginTop: 8, marginBottom: 0, paddingLeft: 18, fontSize: 12, opacity: 0.78, lineHeight: 1.5 },

  form: { border: "1px solid var(--hdud-border)", borderRadius: 12, padding: 14, background: "rgba(255,255,255,0.02)" },
  formHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" },
  formTitle: { fontWeight: 950, fontSize: 14 },
  formMeta: { fontSize: 12, opacity: 0.75, marginTop: 4 },
  formBadges: { display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" },
  badge: {
    border: "1px solid var(--hdud-border)",
    background: "var(--hdud-surface-2)",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    opacity: 0.9,
  },
  formActions: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12, marginBottom: 10 },

  label: { display: "block", marginTop: 10 },
  labelTop: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, fontWeight: 900, opacity: 0.9, marginBottom: 6 },
  counter: { display: "block", fontSize: 11, opacity: 0.7, marginTop: 6 },

  suggestHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" },
  suggestTitle: { fontWeight: 950, fontSize: 13, opacity: 0.95 },
  suggestList: { marginTop: 10, marginBottom: 0, paddingLeft: 18, fontSize: 12, opacity: 0.78, lineHeight: 1.6 },
  suggestHint: { marginTop: 8, fontSize: 11, opacity: 0.6 },
  suggestCollapsed: { marginTop: 10, fontSize: 12, opacity: 0.75 },
};