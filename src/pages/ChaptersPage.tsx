// C:\HDUD_DATA\hdud-web-app\src\pages\ChaptersPage.tsx

import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * ChaptersPage (MVP) — API REAL
 * + Move A: Capítulos agrupam Memórias (identity_memory_chapter)
 *
 * ✅ Novo bloco no editor:
 * - "Memórias deste capítulo" (listar / vincular / remover)
 * - Picker com busca (reusa /api/memories alias do backend)
 */

type ChapterStatus = "DRAFT" | "PUBLIC";
type StatusFilter = "ALL" | "DRAFT" | "PUBLIC";
type SortKey = "RECENT" | "OLD" | "TITLE";

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
  body?: string;
  content?: string | null;
};

// ✅ Memórias (para bloco de vínculo)
type ChapterMemoryItem = {
  memory_id: number;
  author_id?: number;
  title?: string | null;
  content?: string | null;
  created_at?: string;
  version_number?: number | null;
  phase_id?: number | null;
  life_phase?: string | null;
  phase_name?: string | null;
};

type ApiChapterMemoriesResponse = {
  chapter_id: number;
  items: ChapterMemoryItem[];
};

type ApiMemoriesAliasResponse = {
  author_id: number;
  memories: any[];
};

function formatDateBR(v?: string | null) {
  if (!v) return "—";
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return "—";
  }
}

function formatDateBRShort(v?: string | null) {
  if (!v) return "—";
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(d);
  } catch {
    return "—";
  }
}

function safeTrimOrNull(v: any): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function greetingPTBR(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Bom dia";
  if (h >= 12 && h < 18) return "Boa tarde";
  return "Boa noite";
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function daysAgoLabel(fromIso: string): string {
  try {
    const d = new Date(fromIso);
    const now = new Date();
    if (Number.isNaN(d.getTime())) return "há algum tempo";
    if (isSameDay(d, now)) return "hoje";
    const diffMs = now.getTime() - d.getTime();
    const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    if (days <= 0) return "hoje";
    if (days === 1) return "há 1 dia";
    return `há ${days} dias`;
  } catch {
    return "há algum tempo";
  }
}

function toStatus(v: any): ChapterStatus {
  return v === "PUBLIC" ? "PUBLIC" : "DRAFT";
}

function unwrapList(data: any): ApiChapterListItem[] | null {
  if (!data) return null;
  if (Array.isArray(data)) return data as ApiChapterListItem[];
  if (Array.isArray((data as any).items)) return (data as any).items as ApiChapterListItem[];
  if (Array.isArray((data as any).chapters)) return (data as any).chapters as ApiChapterListItem[];
  if ((data as any).data && Array.isArray((data as any).data.items)) return (data as any).data.items as ApiChapterListItem[];
  if ((data as any).data && Array.isArray((data as any).data.chapters)) return (data as any).data.chapters as ApiChapterListItem[];
  return null;
}

function unwrapDetail(data: any): any | null {
  if (!data) return null;

  const chapter =
    (data as any).chapter ??
    (data as any).data?.chapter ??
    (data as any).item ??
    (data as any).data?.item ??
    data;

  const cur =
    (data as any).current_version ??
    (data as any).currentVersion ??
    (data as any).data?.current_version ??
    (data as any).data?.currentVersion ??
    null;

  if (chapter && cur) {
    const merged = { ...(chapter as any) };
    const content = cur.content ?? cur.body ?? cur.text ?? cur.chapter_body ?? cur.chapterBody ?? null;
    if (content != null) {
      merged.body = content;
      merged.content = content;
    }
    if (cur.version_id != null && merged.current_version_id == null) merged.current_version_id = cur.version_id;
    if (cur.id != null && merged.current_version_id == null) merged.current_version_id = cur.id;
    return merged;
  }

  return chapter ?? null;
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
      // tenta próxima
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

function normText(v: any): string {
  const s = String(v ?? "");
  const noBom = s.replace(/^\uFEFF/, "");
  const lf = noBom.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const trimLineEnds = lf.replace(/[ \t]+$/gm, "");
  const trimEndNewlines = trimLineEnds.replace(/\n+$/g, "\n");
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

const DEFAULT_NEW_TITLE = "Novo capítulo";
const DEFAULT_NEW_DESCRIPTION = "Uma frase curta: sobre o que é essa fase da sua vida?";

function safeText(v: any, max = 240) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

export default function ChaptersPage() {
  const token = getToken();
  const canUseApi = !!token;

  const jwt = useMemo(() => (token ? parseJwtPayload(token) : null), [token]);
  const authorId = useMemo(() => {
    const a = jwt?.author_id ?? jwt?.authorId ?? jwt?.sub_author_id ?? null;
    const n = Number(a);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [jwt]);

  const [mode, setMode] = useState<"list" | "edit">("list");

  const [items, setItems] = useState<ApiChapterListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [q, setQ] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("RECENT");

  const [hoverId, setHoverId] = useState<number | null>(null);

  const [selectedChapterId, setSelectedChapterId] = useState<number | null>(null);
  const [openChapterId, setOpenChapterId] = useState<number | null>(null);

  const [isNewUnsaved, setIsNewUnsaved] = useState<boolean>(false);

  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [body, setBody] = useState<string>("");
  const [status, setStatus] = useState<ChapterStatus>("DRAFT");

  const [versionLabel, setVersionLabel] = useState<string>("v1");
  const [createdAt, setCreatedAt] = useState<string>("—");
  const [updatedAt, setUpdatedAt] = useState<string>("—");
  const [publishedAt, setPublishedAt] = useState<string>("—");

  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<any>(null);

  const [lastApiInfo, setLastApiInfo] = useState<string>("");
  const [showDiag, setShowDiag] = useState<boolean>(false);

  const didFocusTitle = useRef(false);
  const didFocusDesc = useRef(false);

  const pendingOpenChapterIdRef = useRef<number | null>(consumeOpenChapterHint());

  const listSeqRef = useRef(0);
  const detailSeqRef = useRef(0);

  const snapshotRef = useRef<Snapshot | null>(null);

  // ==============================
  // ✅ Move A: vínculo de memórias
  // ==============================
  const [chapterMemories, setChapterMemories] = useState<ChapterMemoryItem[]>([]);
  const [loadingMemories, setLoadingMemories] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQ, setPickerQ] = useState("");
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerItems, setPickerItems] = useState<ChapterMemoryItem[]>([]);

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
    try {
      const ev = new CustomEvent("hdud:dirty", {
        detail: {
          dirty: !!isDirty,
          message: "Você tem alterações não salvas no capítulo. Deseja sair sem salvar?",
          source: "chapters",
        },
      });
      window.dispatchEvent(ev);
    } catch {}
  }, [isDirty]);

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

  function goEditMode() {
    setMode("edit");
    try {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {}
  }

  function goListMode() {
    if (!confirmIfDirty("Voltar para lista")) return;
    setMode("list");
    setOpenChapterId(null);
    setIsNewUnsaved(false);
    snapshotRef.current = null;
    setTitle("");
    setDescription("");
    setBody("");
    setStatus("DRAFT");
    setVersionLabel("v1");
    setCreatedAt("—");
    setUpdatedAt("—");
    setPublishedAt("—");
    didFocusTitle.current = false;
    didFocusDesc.current = false;

    // Move A cleanup
    setChapterMemories([]);
    setPickerOpen(false);
    setPickerQ("");
    setPickerItems([]);
  }

  function openLocalNewDraft(preset?: { title: string; description?: string | null }) {
    if (!confirmIfDirty("Criar novo capítulo")) return;

    setSelectedChapterId(null);
    setOpenChapterId(null);
    setIsNewUnsaved(true);

    setTitle(preset?.title ?? DEFAULT_NEW_TITLE);
    setDescription(String(preset?.description ?? DEFAULT_NEW_DESCRIPTION));
    setBody("");
    setStatus("DRAFT");
    setVersionLabel("v1");
    setCreatedAt("—");
    setUpdatedAt("—");
    setPublishedAt("—");

    snapshotRef.current = normSnap({
      title: preset?.title ?? DEFAULT_NEW_TITLE,
      description: String(preset?.description ?? DEFAULT_NEW_DESCRIPTION),
      body: "",
      status: "DRAFT",
    });

    didFocusTitle.current = false;
    didFocusDesc.current = false;

    // Move A: novo ainda não tem vínculos
    setChapterMemories([]);
    setPickerOpen(false);
    setPickerQ("");
    setPickerItems([]);

    goEditMode();
  }

  async function loadList() {
    if (needAuthGuard()) return;

    const seq = ++listSeqRef.current;
    setLoading(true);
    setToast(null);

    try {
      const result = await tryMany<any>([
        () => apiRequest<any>("/api/chapters", { method: "GET" }),
        () => apiRequest<any>("/api/chapters/list", { method: "GET" }),
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
            setToastAuto({ kind: "warn", msg: "Você está com alterações não salvas. Salve antes de abrir outro capítulo." });
            pendingOpenChapterIdRef.current = null;
            return;
          }
          pendingOpenChapterIdRef.current = null;
          await loadDetail(pending);
          return;
        } else {
          pendingOpenChapterIdRef.current = null;
        }
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadChapterMemories(chapterId: number) {
    if (!chapterId || !Number.isFinite(chapterId)) return;
    setLoadingMemories(true);
    try {
      const result = await tryMany<ApiChapterMemoriesResponse | any>([
        () => apiRequest<any>(`/api/chapters/${chapterId}/memories`, { method: "GET" }),
      ]);

      setApiInfo("CHAPTER_MEMORIES", result.usedPath || "—", result.attempts);

      if (!result.ok || !result.data) {
        // não quebra o editor — só avisa
        setToastAuto({ kind: "warn", msg: "Não consegui carregar as memórias vinculadas deste capítulo." }, 3200);
        setChapterMemories([]);
        return;
      }

      const items = Array.isArray((result.data as any).items) ? (result.data as any).items : [];
      const normalized: ChapterMemoryItem[] = items
        .map((m: any) => ({
          memory_id: Number(m.memory_id ?? m.id),
          author_id: m.author_id != null ? Number(m.author_id) : undefined,
          title: m.title ?? null,
          content: m.content ?? null,
          created_at: m.created_at ?? null,
          version_number: m.version_number != null ? Number(m.version_number) : null,
          phase_id: m.phase_id != null ? Number(m.phase_id) : null,
          life_phase: m.life_phase ?? null,
          phase_name: m.phase_name ?? null,
        }))
        .filter((x) => Number.isFinite(x.memory_id) && x.memory_id > 0);

      setChapterMemories(normalized);
    } finally {
      setLoadingMemories(false);
    }
  }

  async function loadDetail(chapterId: number) {
    if (needAuthGuard()) return;

    const seq = ++detailSeqRef.current;
    setLoading(true);
    setToast(null);

    try {
      const result = await tryMany<ApiChapterDetail | any>([
        () => apiRequest<any>(`/api/chapters/${chapterId}`, { method: "GET" }),
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
      setIsNewUnsaved(false);

      setTitle(String((d as any).title ?? ""));
      setDescription(String((d as any).description ?? ""));

      const resolvedBody =
        (d as any).body ??
        (d as any).content ??
        (d as any).text ??
        (d as any).chapter_body ??
        (d as any).chapterBody ??
        "";

      setBody(normText(resolvedBody));

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
        title: String((d as any).title ?? ""),
        description: String((d as any).description ?? ""),
        body: normText(resolvedBody),
        status: st,
      });

      didFocusTitle.current = false;
      didFocusDesc.current = false;

      // ✅ Move A: carrega memórias vinculadas
      await loadChapterMemories(chapterId);

      goEditMode();
    } finally {
      setLoading(false);
    }
  }

  async function createOnServer(payload: { title: string; description: string | null; body: string; status: ChapterStatus }) {
    if (needAuthGuard()) return null;

    const postPayload: any = {
      title: payload.title,
      description: payload.description,
      status: payload.status,
      body: payload.body ?? "",
    };

    const result = await tryMany<any>([
      () => apiRequest<any>("/api/chapters", { method: "POST", body: JSON.stringify(postPayload) }),
      () => apiRequest<any>(`/api/authors/${authorId}/chapters`, { method: "POST", body: JSON.stringify(postPayload) }),
      () => apiRequest<any>(`/api/author/${authorId}/chapters`, { method: "POST", body: JSON.stringify(postPayload) }),
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
      return null;
    }

    const createdId =
      (result.data as any)?.chapter_id ??
      (result.data as any)?.id ??
      (result.data as any)?.chapter?.chapter_id ??
      (result.data as any)?.data?.chapter_id ??
      null;

    const cid = Number(createdId);
    return Number.isFinite(cid) && cid > 0 ? cid : null;
  }

  async function reloadSelected() {
    if (!openChapterId) return;
    if (!confirmIfDirty("Recarregar capítulo")) return;
    await loadDetail(openChapterId);
    setToastAuto({ kind: "ok", msg: "Capítulo recarregado." });
  }

  async function saveExistingViaPut(chapterId: number, targetStatusAfterSave?: ChapterStatus) {
    const payload: any = {
      title: safeTrimOrNull(title) ?? "",
      description: safeTrimOrNull(description),
      body: body ?? "",
    };

    const result = await tryMany<any>([
      () => apiRequest<any>(`/api/chapters/${chapterId}`, { method: "PUT", body: JSON.stringify(payload) }),
    ]);

    setApiInfo("SAVE", result.usedPath || "—", result.attempts);

    if (!result.ok) {
      const hint =
        result.status === 401 ? "401 (token expirado)." : result.status === 404 ? "404 (rota não existe)." : `HTTP ${result.status || "erro"}`;
      setToastAuto({ kind: "err", msg: `Falha ao salvar (${hint}).` });
      return false;
    }

    snapshotRef.current = normSnap({
      title: normTitle(title),
      description: normDesc(description),
      body: normText(body),
      status: targetStatusAfterSave ?? status,
    });

    setToastAuto({ kind: "ok", msg: "Salvo." });
    return true;
  }

  async function saveDraft() {
    if (needAuthGuard()) return;

    if (isNewUnsaved) {
      setSaving(true);
      setToast(null);
      try {
        const payload = {
          title: safeTrimOrNull(title) ?? "",
          description: safeTrimOrNull(description),
          body: body ?? "",
          status: "DRAFT" as ChapterStatus,
        };

        const cid = await createOnServer(payload);
        if (!cid) return;

        setToastAuto({ kind: "ok", msg: "Capítulo salvo (criado)." });

        setIsNewUnsaved(false);
        setOpenChapterId(cid);
        setSelectedChapterId(cid);

        snapshotRef.current = normSnap({
          title: normTitle(title),
          description: normDesc(description),
          body: normText(body),
          status: "DRAFT",
        });

        await loadList();
        await loadDetail(cid);
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!openChapterId) return;

    setSaving(true);
    setToast(null);
    try {
      const ok = await saveExistingViaPut(openChapterId, status);
      if (!ok) return;

      await loadList();
      await loadDetail(openChapterId);
    } finally {
      setSaving(false);
    }
  }

  async function publishExisting(chapterId: number) {
    const result = await tryMany<any>([
      () => apiRequest<any>(`/api/chapters/${chapterId}/publish`, { method: "POST" }),
    ]);

    setApiInfo("PUBLISH", result.usedPath || "—", result.attempts);

    if (!result.ok) {
      const hint =
        result.status === 401 ? "401 (token expirado)." : result.status === 404 ? "404 (rota não existe)." : `HTTP ${result.status || "erro"}`;
      setToastAuto({ kind: "err", msg: `Falha ao publicar (${hint}).` });
      return false;
    }

    setStatus("PUBLIC");

    snapshotRef.current = normSnap({
      title: normTitle(title),
      description: normDesc(description),
      body: normText(body),
      status: "PUBLIC",
    });

    setToastAuto({ kind: "ok", msg: "Publicado." });
    return true;
  }

  async function unpublishExisting(chapterId: number) {
    const result = await tryMany<any>([
      () => apiRequest<any>(`/api/chapters/${chapterId}/unpublish`, { method: "POST" }),
    ]);

    setApiInfo("UNPUBLISH", result.usedPath || "—", result.attempts);

    if (!result.ok) {
      const hint =
        result.status === 401 ? "401 (token expirado)." : result.status === 404 ? "404 (rota não existe)." : `HTTP ${result.status || "erro"}`;
      setToastAuto({ kind: "err", msg: `Falha ao despublicar (${hint}).` });
      return false;
    }

    setStatus("DRAFT");

    snapshotRef.current = normSnap({
      title: normTitle(title),
      description: normDesc(description),
      body: normText(body),
      status: "DRAFT",
    });

    setToastAuto({ kind: "ok", msg: "Despublicado (voltou para rascunho)." });
    return true;
  }

  async function publish() {
    if (needAuthGuard()) return;

    if (!isNewUnsaved && status === "PUBLIC" && !isDirty) {
      setToastAuto({ kind: "warn", msg: "Este capítulo já está publicado." });
      return;
    }

    if (isNewUnsaved) {
      setSaving(true);
      setToast(null);
      try {
        const payload = {
          title: safeTrimOrNull(title) ?? "",
          description: safeTrimOrNull(description),
          body: body ?? "",
          status: "PUBLIC" as ChapterStatus,
        };

        const cid = await createOnServer(payload);
        if (!cid) return;

        setToastAuto({ kind: "ok", msg: "Publicado." });

        setIsNewUnsaved(false);
        setOpenChapterId(cid);
        setSelectedChapterId(cid);

        setStatus("PUBLIC");
        snapshotRef.current = normSnap({
          title: normTitle(title),
          description: normDesc(description),
          body: normText(body),
          status: "PUBLIC",
        });

        await loadList();
        await loadDetail(cid);
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!openChapterId) return;

    setSaving(true);
    setToast(null);
    try {
      if (isDirty) {
        const okSave = await saveExistingViaPut(openChapterId, "PUBLIC");
        if (!okSave) return;
      }

      const okPub = await publishExisting(openChapterId);
      if (!okPub) return;

      await loadList();
      await loadDetail(openChapterId);
    } finally {
      setSaving(false);
    }
  }

  async function unpublish() {
    if (status !== "PUBLIC") {
      setToastAuto({ kind: "warn", msg: "Este capítulo já está em rascunho." });
      return;
    }
    if (isNewUnsaved || !openChapterId) {
      setToastAuto({ kind: "warn", msg: "Este capítulo ainda não existe no banco." });
      return;
    }

    setSaving(true);
    setToast(null);
    try {
      const ok = await unpublishExisting(openChapterId);
      if (!ok) return;

      await loadList();
      await loadDetail(openChapterId);
    } finally {
      setSaving(false);
    }
  }

  // ============================
  // ✅ Move A: picker + link/unlink
  // ============================
  async function openPicker() {
    if (isNewUnsaved || !openChapterId) {
      setToastAuto({ kind: "warn", msg: "Salve/crie o capítulo primeiro para vincular memórias." });
      return;
    }

    setPickerOpen(true);
    setPickerQ("");
    setPickerLoading(true);

    try {
      // Usa o alias /api/memories (backend já tem)
      const result = await tryMany<ApiMemoriesAliasResponse | any>([
        () => apiRequest<any>(`/api/memories`, { method: "GET" }),
      ]);

      setApiInfo("PICKER_MEMORIES", result.usedPath || "—", result.attempts);

      if (!result.ok || !result.data) {
        setToastAuto({ kind: "warn", msg: "Não consegui carregar o inventário de memórias." });
        setPickerItems([]);
        return;
      }

      const rawList = Array.isArray((result.data as any).memories) ? (result.data as any).memories : [];
      const normalized: ChapterMemoryItem[] = rawList
        .map((m: any) => ({
          memory_id: Number(m.memory_id ?? m.id),
          title: m.title ?? null,
          content: m.content ?? null,
          created_at: m.created_at ?? null,
          life_phase: m.life_phase ?? m?.meta?.life_phase ?? null,
          phase_name: m.phase_name ?? m?.meta?.phase_name ?? null,
        }))
        .filter((x) => Number.isFinite(x.memory_id) && x.memory_id > 0);

      setPickerItems(normalized);
    } finally {
      setPickerLoading(false);
    }
  }

  async function linkMemory(memoryId: number) {
    if (!openChapterId) return;
    setSaving(true);
    try {
      const result = await tryMany<any>([
        () => apiRequest<any>(`/api/chapters/${openChapterId}/memories/${memoryId}`, { method: "POST" }),
      ]);

      setApiInfo("LINK_MEMORY", result.usedPath || "—", result.attempts);

      if (!result.ok) {
        setToastAuto({ kind: "err", msg: "Falha ao vincular memória ao capítulo." });
        return;
      }

      setToastAuto({ kind: "ok", msg: "Memória vinculada." });
      await loadChapterMemories(openChapterId);
    } finally {
      setSaving(false);
    }
  }

  async function unlinkMemory(memoryId: number) {
    if (!openChapterId) return;
    setSaving(true);
    try {
      const result = await tryMany<any>([
        () => apiRequest<any>(`/api/chapters/${openChapterId}/memories/${memoryId}`, { method: "DELETE" }),
      ]);

      setApiInfo("UNLINK_MEMORY", result.usedPath || "—", result.attempts);

      if (!result.ok) {
        setToastAuto({ kind: "err", msg: "Falha ao remover vínculo da memória." });
        return;
      }

      setToastAuto({ kind: "ok", msg: "Vínculo removido." });
      await loadChapterMemories(openChapterId);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!canUseApi) {
      setToastAuto({ kind: "warn", msg: "Token ausente. Faça login para ver/editar capítulos." });
      return;
    }
    void loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUseApi]);

  const viewItems = useMemo(() => {
    let list = items.slice();

    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter((c) => {
        const t = String(c.title ?? "").toLowerCase();
        const d = String(c.description ?? "").toLowerCase();
        return t.includes(needle) || d.includes(needle) || String(c.chapter_id).includes(needle);
      });
    }

    if (statusFilter !== "ALL") list = list.filter((c) => c.status === statusFilter);

    if (sortKey === "TITLE") {
      list.sort((a, b) => String(a.title ?? "").localeCompare(String(b.title ?? ""), "pt-BR", { sensitivity: "base" }));
    } else {
      list.sort((a, b) => {
        const da = new Date(a.updated_at || a.created_at || 0).getTime();
        const db = new Date(b.updated_at || b.created_at || 0).getTime();
        return sortKey === "RECENT" ? db - da : da - db;
      });
    }

    return list;
  }, [items, q, statusFilter, sortKey]);

  const countLabel = useMemo(() => {
    const filtered = q.trim().length > 0 || statusFilter !== "ALL" || sortKey !== "RECENT";
    return filtered ? `${viewItems.length}/${items.length} capítulo(s)` : `${items.length} capítulo(s)`;
  }, [items.length, viewItems.length, q, statusFilter, sortKey]);

  const latestChapter = useMemo(() => {
    if (items.length === 0) return null;
    const sorted = items
      .slice()
      .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime());
    return sorted[0] ?? null;
  }, [items]);

  const pulseLabel = useMemo(() => {
    if (!latestChapter) return "Seu mapa ainda está vazio — comece com o primeiro capítulo.";
    const at = latestChapter.updated_at || latestChapter.created_at;
    return `Último capítulo ${daysAgoLabel(at)}.`;
  }, [latestChapter]);

  const moment = useMemo(() => {
    const sorted = viewItems
      .slice()
      .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime());

    const destaque = sorted[0] ?? null;

    let revisitar: ApiChapterListItem | null = null;
    if (sorted.length >= 2) {
      const oldest = viewItems.slice().sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      const pool = oldest.slice(0, Math.min(6, oldest.length));
      revisitar = pool[Math.floor(Math.random() * pool.length)] ?? null;
    }

    return { destaque, revisitar };
  }, [viewItems]);

  const microcopy = useMemo(() => {
    const parts: string[] = [];
    const needle = q.trim();
    if (needle) parts.push(`busca: “${needle}”`);
    if (statusFilter !== "ALL") parts.push(statusFilter === "PUBLIC" ? "status: públicos" : "status: rascunhos");
    if (sortKey === "OLD") parts.push("ordem: mais antigos");
    if (sortKey === "TITLE") parts.push("ordem: por título");

    if (parts.length === 0) return "Um mapa vivo da sua vida — fases que organizam e dão sentido às memórias.";
    return `Mostrando ${parts.join(" • ")}.`;
  }, [q, statusFilter, sortKey]);

  const selectedTitlePreview = useMemo(() => {
    const found = items.find((x) => x.chapter_id === (openChapterId ?? selectedChapterId ?? -1));
    return found?.title?.trim() ? found.title : "capítulo";
  }, [items, openChapterId, selectedChapterId]);

  const pickerViewItems = useMemo(() => {
    const needle = pickerQ.trim().toLowerCase();
    if (!needle) return pickerItems;

    return pickerItems.filter((m) => {
      const t = String(m.title ?? "").toLowerCase();
      const c = String(m.content ?? "").toLowerCase();
      return t.includes(needle) || c.includes(needle) || String(m.memory_id).includes(needle);
    });
  }, [pickerItems, pickerQ]);

  const linkedIds = useMemo(() => new Set(chapterMemories.map((m) => m.memory_id)), [chapterMemories]);

  const ui = useMemo(() => {
    const page: React.CSSProperties = { padding: 0, color: "var(--hdud-text)" };

    const container: React.CSSProperties = {
      width: "100%",
      maxWidth: 1920,
      margin: "0 auto",
      padding: "18px clamp(16px, 2.2vw, 36px)",
      boxSizing: "border-box",
      position: "relative",
    };

    const headerCard: React.CSSProperties = {
      background: "var(--hdud-card)",
      borderRadius: 16,
      padding: 18,
      boxShadow: "var(--hdud-shadow)",
      marginBottom: 14,
      border: "1px solid var(--hdud-border)",
      position: "relative",
      overflow: "hidden",
    };

    const headerGlow: React.CSSProperties = {
      position: "absolute",
      inset: -60,
      background: "radial-gradient(closest-side, rgba(0,0,0,0.06), transparent 60%)",
      pointerEvents: "none",
      opacity: 0.55,
      filter: "blur(2px)",
      transform: "translate3d(0,0,0)",
    };

    const h1Row: React.CSSProperties = {
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: 12,
      flexWrap: "wrap",
      position: "relative",
      zIndex: 1,
    };

    const h1: React.CSSProperties = {
      fontSize: 40,
      fontWeight: 950,
      letterSpacing: -0.7,
      margin: 0,
      lineHeight: 1.0,
    };

    const subtitle: React.CSSProperties = {
      marginTop: 8,
      opacity: 0.82,
      fontWeight: 750,
      position: "relative",
      zIndex: 1,
    };

    const toolbarRow: React.CSSProperties = {
      display: "flex",
      gap: 10,
      alignItems: "center",
      flexWrap: "wrap",
      marginTop: 14,
      position: "relative",
      zIndex: 1,
    };

    const spacer: React.CSSProperties = { flex: "1 1 auto" };

    const card: React.CSSProperties = {
      background: "var(--hdud-card)",
      borderRadius: 16,
      padding: 14,
      boxShadow: "var(--hdud-shadow)",
      border: "1px solid var(--hdud-border)",
      marginBottom: 14,
    };

    const cardTitle: React.CSSProperties = {
      fontSize: 13,
      fontWeight: 950,
      marginBottom: 10,
      letterSpacing: 0.2,
      opacity: 0.9,
      textTransform: "uppercase",
    };

    const label: React.CSSProperties = {
      fontSize: 12,
      fontWeight: 900,
      opacity: 0.85,
      marginBottom: 6,
    };

    const input: React.CSSProperties = {
      width: "100%",
      padding: "10px 12px",
      borderRadius: 12,
      border: "1px solid var(--hdud-border)",
      background: "var(--hdud-surface)",
      color: "var(--hdud-text)",
      outline: "none",
    };

    const textarea: React.CSSProperties = {
      width: "100%",
      minHeight: 140,
      padding: "10px 12px",
      borderRadius: 12,
      border: "1px solid var(--hdud-border)",
      background: "var(--hdud-surface)",
      color: "var(--hdud-text)",
      outline: "none",
      resize: "vertical",
      fontFamily: "inherit",
      lineHeight: 1.35,
    };

    const select: React.CSSProperties = {
      padding: "9px 12px",
      borderRadius: 12,
      border: "1px solid var(--hdud-border)",
      background: "var(--hdud-surface)",
      color: "var(--hdud-text)",
      outline: "none",
      fontWeight: 800,
    };

    const btn: React.CSSProperties = {
      padding: "9px 14px",
      borderRadius: 12,
      border: "1px solid var(--hdud-border)",
      background: "var(--hdud-surface)",
      color: "var(--hdud-text)",
      cursor: "pointer",
      fontWeight: 900,
      whiteSpace: "nowrap",
      boxShadow: "var(--hdud-shadow-soft)",
      transition: "transform 140ms ease, box-shadow 140ms ease, opacity 140ms ease",
      opacity: 1,
    };

    const btnDisabled: React.CSSProperties = {
      opacity: 0.55,
      cursor: "not-allowed",
    };

    const btnPrimary: React.CSSProperties = {
      ...btn,
      background: "var(--hdud-primary)",
      borderColor: "var(--hdud-primary)",
      color: "var(--hdud-primary-contrast)",
    };

    const btnGhost: React.CSSProperties = { ...btn, background: "transparent" };

    const pill: React.CSSProperties = {
      border: "1px solid var(--hdud-border)",
      padding: "5px 10px",
      borderRadius: 999,
      fontSize: 12,
      opacity: 0.9,
      whiteSpace: "nowrap",
      background: "var(--hdud-surface-2)",
      fontWeight: 900,
    };

    const grid2: React.CSSProperties = {
      display: "grid",
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      gap: 10,
    };

    const momentCard: React.CSSProperties = {
      border: "1px solid var(--hdud-border)",
      background: "var(--hdud-surface)",
      borderRadius: 14,
      padding: 14,
      boxShadow: "var(--hdud-shadow-soft)",
      cursor: "pointer",
      transition: "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
      position: "relative",
    };

    const momentTitle: React.CSSProperties = { fontWeight: 950, margin: 0, fontSize: 14, letterSpacing: -0.2 };

    const momentMeta: React.CSSProperties = {
      marginTop: 6,
      opacity: 0.78,
      fontSize: 12,
      fontWeight: 800,
      lineHeight: 1.25,
      display: "-webkit-box",
      WebkitLineClamp: 2,
      WebkitBoxOrient: "vertical",
      overflow: "hidden",
    };

    const listWrap: React.CSSProperties = { display: "grid", gap: 10, marginTop: 10 };

    const row: React.CSSProperties = {
      border: "1px solid var(--hdud-border)",
      background: "var(--hdud-surface)",
      borderRadius: 14,
      padding: 12,
      cursor: "pointer",
      boxShadow: "var(--hdud-shadow-soft)",
      transition: "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
      transform: "translate3d(0,0,0)",
      userSelect: "none",
      position: "relative",
      outline: "none",
    };

    const rowHover: React.CSSProperties = {
      transform: "translate3d(0,-2px,0)",
      boxShadow: "var(--hdud-shadow)",
      borderColor: "rgba(0,0,0,0.12)",
    };

    const rowSelected: React.CSSProperties = {
      borderColor: "rgba(0,0,0,0.18)",
      boxShadow: "0 0 0 3px rgba(0,0,0,0.06), var(--hdud-shadow)",
      background: "linear-gradient(180deg, rgba(0,0,0,0.015), rgba(0,0,0,0.0))",
    };

    const selectedBar: React.CSSProperties = {
      position: "absolute",
      left: 0,
      top: 10,
      bottom: 10,
      width: 4,
      borderRadius: 999,
      background: "var(--hdud-primary)",
      opacity: 0.9,
      boxShadow: "0 6px 18px rgba(0,0,0,0.10)",
    };

    const rowTop: React.CSSProperties = {
      display: "flex",
      justifyContent: "space-between",
      gap: 12,
      alignItems: "baseline",
    };

    const rowTitle: React.CSSProperties = { fontWeight: 950, fontSize: 14, margin: 0, letterSpacing: -0.2 };

    const rowMeta: React.CSSProperties = { opacity: 0.75, fontSize: 12, whiteSpace: "nowrap", fontWeight: 800 };

    const rowSub: React.CSSProperties = {
      opacity: 0.82,
      fontSize: 12,
      marginTop: 8,
      lineHeight: 1.35,
      display: "-webkit-box",
      WebkitLineClamp: 2,
      WebkitBoxOrient: "vertical",
      overflow: "hidden",
    };

    const empty: React.CSSProperties = {
      border: "1px dashed var(--hdud-border)",
      background: "var(--hdud-surface)",
      borderRadius: 14,
      padding: 16,
      opacity: 0.9,
    };

    const emptyTitle: React.CSSProperties = { margin: 0, fontWeight: 950, letterSpacing: -0.2 };

    const emptyText: React.CSSProperties = { marginTop: 6, opacity: 0.82, fontWeight: 750, lineHeight: 1.35 };

    // ✅ modal simples (picker)
    const overlay: React.CSSProperties = {
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.45)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
      zIndex: 999,
    };

    const modal: React.CSSProperties = {
      width: "min(920px, 96vw)",
      maxHeight: "min(78vh, 720px)",
      overflow: "hidden",
      borderRadius: 16,
      border: "1px solid var(--hdud-border)",
      background: "var(--hdud-card)",
      boxShadow: "var(--hdud-shadow)",
      display: "flex",
      flexDirection: "column",
    };

    const modalHead: React.CSSProperties = {
      padding: 14,
      borderBottom: "1px solid var(--hdud-border)",
      display: "flex",
      gap: 10,
      alignItems: "center",
      justifyContent: "space-between",
    };

    const modalBody: React.CSSProperties = {
      padding: 14,
      overflow: "auto",
    };

    return {
      page,
      container,
      headerCard,
      headerGlow,
      h1Row,
      h1,
      subtitle,
      toolbarRow,
      spacer,
      card,
      cardTitle,
      label,
      input,
      textarea,
      select,
      btn,
      btnPrimary,
      btnGhost,
      btnDisabled,
      pill,
      grid2,
      momentCard,
      momentTitle,
      momentMeta,
      listWrap,
      row,
      rowHover,
      rowSelected,
      selectedBar,
      rowTop,
      rowTitle,
      rowMeta,
      rowSub,
      empty,
      emptyTitle,
      emptyText,
      overlay,
      modal,
      modalHead,
      modalBody,
    };
  }, []);

  const headerFilters = (
    <div style={ui.toolbarRow}>
      <button type="button" style={ui.btnPrimary} onClick={() => openLocalNewDraft()} disabled={loading || saving} title="Criar um novo capítulo (rascunho local)">
        + Criar capítulo
      </button>

      <div style={ui.spacer} />

      <input style={{ ...ui.input, width: 280 }} placeholder="Buscar (título, descrição ou #ID)…" value={q} onChange={(e) => setQ(e.target.value)} />

      <select style={ui.select} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
        <option value="ALL">Status: Todos</option>
        <option value="DRAFT">Status: Rascunhos</option>
        <option value="PUBLIC">Status: Públicos</option>
      </select>

      <select style={ui.select} value={sortKey} onChange={(e) => setSortKey(e.target.value as any)}>
        <option value="RECENT">Mais recentes</option>
        <option value="OLD">Mais antigos</option>
        <option value="TITLE">Título</option>
      </select>

      <button type="button" style={ui.btn} onClick={() => loadList()} disabled={loading || saving}>
        {loading ? "Atualizando…" : "Atualizar"}
      </button>

      <button type="button" style={showDiag ? ui.btnPrimary : ui.btn} onClick={() => setShowDiag((v) => !v)} disabled={loading || saving}>
        Diagnóstico
      </button>
    </div>
  );

  const momentBlock = (
    <div style={ui.card}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <div style={ui.cardTitle}>Momento</div>
        <div style={{ opacity: 0.75, fontSize: 12, fontWeight: 900 }}>{latestChapter ? `Pulso: ${pulseLabel}` : "Pulso: em silêncio"}</div>
      </div>

      <div style={ui.grid2}>
        {moment.destaque ? (
          <div
            style={ui.momentCard}
            onClick={() => {
              if (!confirmIfDirty("Abrir capítulo (em destaque)")) return;
              setSelectedChapterId(moment.destaque!.chapter_id);
              void loadDetail(moment.destaque!.chapter_id);
            }}
            onMouseEnter={() => setHoverId(moment.destaque!.chapter_id)}
            onMouseLeave={() => setHoverId((v) => (v === moment.destaque!.chapter_id ? null : v))}
            title="Abrir capítulo"
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ opacity: 0.8, fontSize: 12, fontWeight: 900 }}>Em destaque</div>
                <p style={ui.momentTitle}>{moment.destaque.title?.trim() ? moment.destaque.title : `Capítulo #${moment.destaque.chapter_id}`}</p>
              </div>
              <div style={{ opacity: 0.7, fontSize: 12, fontWeight: 900, whiteSpace: "nowrap" }}>
                {formatDateBRShort(moment.destaque.updated_at || moment.destaque.created_at)}
              </div>
            </div>
            <div style={ui.momentMeta}>{moment.destaque.description ? moment.destaque.description : "Abra e descreva a fase com 1–2 frases."}</div>
          </div>
        ) : (
          <div style={ui.empty}>
            <p style={ui.emptyTitle}>Seu mapa começa aqui.</p>
            <div style={ui.emptyText}>Crie o primeiro capítulo e dê estrutura às suas memórias.</div>
          </div>
        )}

        {moment.revisitar ? (
          <div
            style={ui.momentCard}
            onClick={() => {
              if (!confirmIfDirty("Abrir capítulo (revisitar)")) return;
              setSelectedChapterId(moment.revisitar!.chapter_id);
              void loadDetail(moment.revisitar!.chapter_id);
            }}
            onMouseEnter={() => setHoverId(moment.revisitar!.chapter_id)}
            onMouseLeave={() => setHoverId((v) => (v === moment.revisitar!.chapter_id ? null : v))}
            title="Abrir capítulo"
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ opacity: 0.8, fontSize: 12, fontWeight: 900 }}>Revisitar</div>
                <p style={ui.momentTitle}>{moment.revisitar.title?.trim() ? moment.revisitar.title : `Capítulo #${moment.revisitar.chapter_id}`}</p>
              </div>
              <div style={{ opacity: 0.7, fontSize: 12, fontWeight: 900, whiteSpace: "nowrap" }}>{formatDateBRShort(moment.revisitar.created_at)}</div>
            </div>
            <div style={ui.momentMeta}>{moment.revisitar.description ? moment.revisitar.description : "Volte aqui e refine — capítulos ficam melhores com revisita."}</div>
          </div>
        ) : (
          <div style={ui.empty}>
            <p style={ui.emptyTitle}>Sem revisitas ainda.</p>
            <div style={ui.emptyText}>Quando você tiver mais capítulos, eu trago um antigo de forma orgânica.</div>
          </div>
        )}
      </div>
    </div>
  );

  const publishDisabledBecauseAlreadyPublic = !isNewUnsaved && status === "PUBLIC" && !isDirty;
  const canUnpublish = !isNewUnsaved && !!openChapterId && status === "PUBLIC";

  const publishBtnLabel =
    isNewUnsaved ? "Publicar" : status === "PUBLIC" ? (isDirty ? "Atualizar publicação" : "Publicado") : "Publicar";

  const editorMemoriesBlock = (
    <div style={ui.card}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={ui.cardTitle}>Memórias deste capítulo</div>
          <div style={{ opacity: 0.75, fontSize: 12, fontWeight: 800 }}>
            {isNewUnsaved || !openChapterId
              ? "Salve/crie o capítulo para começar a vincular memórias."
              : "Vínculos rápidos (sem mexer no core de versionamento)."}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={ui.pill}>{loadingMemories ? "carregando…" : `${chapterMemories.length} vínculo(s)`}</div>
          <button
            type="button"
            style={isNewUnsaved || !openChapterId ? { ...ui.btn, ...ui.btnDisabled } : ui.btnPrimary}
            disabled={saving || loading || isNewUnsaved || !openChapterId}
            onClick={openPicker}
            title={isNewUnsaved ? "Crie o capítulo primeiro" : "Vincular uma memória existente"}
          >
            + Vincular memória
          </button>
          <button
            type="button"
            style={isNewUnsaved || !openChapterId ? { ...ui.btn, ...ui.btnDisabled } : ui.btn}
            disabled={saving || loading || isNewUnsaved || !openChapterId}
            onClick={() => openChapterId && loadChapterMemories(openChapterId)}
          >
            Atualizar
          </button>
        </div>
      </div>

      {isNewUnsaved || !openChapterId ? (
        <div style={{ marginTop: 12, opacity: 0.78, fontSize: 12, fontWeight: 800 }}>
          Dica: **Capítulo é o mapa**, Memória é o evento. Salve o capítulo e depois comece a pendurar memórias nele.
        </div>
      ) : loadingMemories ? (
        <div style={{ marginTop: 12, opacity: 0.85, fontWeight: 900 }}>Carregando vínculos…</div>
      ) : chapterMemories.length === 0 ? (
        <div style={{ marginTop: 12, ...ui.empty }}>
          <p style={ui.emptyTitle}>Nenhuma memória vinculada ainda.</p>
          <div style={ui.emptyText}>Clique em “Vincular memória” e comece a construir a narrativa desse capítulo.</div>
        </div>
      ) : (
        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          {chapterMemories.map((m) => {
            const titleText = (m.title && String(m.title).trim()) || `Memória #${m.memory_id}`;
            const when = formatDateBR(m.created_at || null);
            const phaseLabel = (m.phase_name || m.life_phase || "").toString().trim();
            return (
              <div
                key={m.memory_id}
                style={{
                  border: "1px solid var(--hdud-border)",
                  background: "var(--hdud-surface)",
                  borderRadius: 14,
                  padding: 12,
                  boxShadow: "var(--hdud-shadow-soft)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
                    <div style={{ fontWeight: 950, letterSpacing: -0.2 }}>{titleText}</div>
                    <div style={{ opacity: 0.72, fontSize: 12, fontWeight: 900 }}>
                      #{m.memory_id}
                      {m.version_number != null ? ` • v${m.version_number}` : ""}
                      {phaseLabel ? ` • ${phaseLabel}` : ""}
                    </div>
                  </div>
                  <div style={{ opacity: 0.72, fontSize: 12, fontWeight: 900, whiteSpace: "nowrap" }}>{when}</div>
                </div>

                <div style={{ marginTop: 8, opacity: 0.82, fontSize: 12, lineHeight: 1.35, fontWeight: 750 }}>
                  {safeText(m.content, 240)}
                </div>

                <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button
                    type="button"
                    style={ui.btn}
                    onClick={() => unlinkMemory(m.memory_id)}
                    disabled={saving || loading}
                    title="Remover vínculo desta memória"
                  >
                    Remover vínculo
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const editorCard = (
    <div style={ui.card}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={ui.cardTitle}>Editor do capítulo</div>
          <div style={{ opacity: 0.75, fontSize: 12, fontWeight: 800 }}>
            {isNewUnsaved ? "Rascunho local — só cria no banco ao Salvar/Publicar." : "Alterações geram versão e preservam histórico."}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={ui.pill}>{isNewUnsaved ? "SEM ID" : `ID ${openChapterId ?? "—"}`}</div>
          <div style={ui.pill}>{versionLabel}</div>
          <div style={ui.pill}>{status === "PUBLIC" ? "Público" : "Rascunho"}</div>
        </div>
      </div>

      <div style={{ marginTop: 10, opacity: 0.75, fontSize: 12, fontWeight: 800 }}>
        Criado: {createdAt} • Última atualização: {updatedAt} • Publicado: {publishedAt}
      </div>

      {toast ? (
        <div
          style={{
            marginTop: 12,
            padding: 10,
            borderRadius: 12,
            border: "1px solid var(--hdud-border)",
            background:
              toast.kind === "ok"
                ? "rgba(52, 199, 89, 0.10)"
                : toast.kind === "warn"
                ? "rgba(255, 204, 0, 0.10)"
                : "rgba(255, 59, 48, 0.10)",
          }}
        >
          <b style={{ textTransform: "uppercase", fontSize: 11, opacity: 0.8 }}>{toast.kind}</b> — {toast.msg}
        </div>
      ) : null}

      {showDiag ? (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid var(--hdud-border)", background: "rgba(255,255,255,0.02)" }}>
          <div style={{ fontWeight: 950, marginBottom: 6 }}>Diagnóstico</div>
          <div style={{ fontSize: 12, opacity: 0.78, marginTop: 6 }}>token: {token ? "OK" : "—"}</div>
          <div style={{ fontSize: 12, opacity: 0.78, marginTop: 6 }}>authorId (JWT): {authorId ?? "—"}</div>
          <div style={{ fontSize: 12, opacity: 0.78, marginTop: 6 }}>API: {lastApiInfo || "—"}</div>
          <div style={{ fontSize: 12, opacity: 0.78, marginTop: 6 }}>isDirty: {String(isDirty)}</div>
          <div style={{ fontSize: 12, opacity: 0.78, marginTop: 6 }}>dirtyInfo: {dirtyInfo}</div>
          <div style={{ fontSize: 12, opacity: 0.78, marginTop: 6 }}>isNewUnsaved: {String(isNewUnsaved)}</div>
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
        <button type="button" style={ui.btnPrimary} onClick={saveDraft} disabled={loading || saving}>
          {saving ? "Salvando…" : "Salvar"}
        </button>

        <button
          type="button"
          style={{ ...(ui.btn as any), ...(publishDisabledBecauseAlreadyPublic ? ui.btnDisabled : null) }}
          onClick={publish}
          disabled={loading || saving || publishDisabledBecauseAlreadyPublic}
          title={
            publishDisabledBecauseAlreadyPublic
              ? "Já está publicado (sem mudanças). Edite algo para habilitar."
              : isNewUnsaved
              ? "Publicar e criar no banco"
              : "Publicar"
          }
        >
          {publishBtnLabel}
        </button>

        <button
          type="button"
          style={{ ...(ui.btn as any), ...(!canUnpublish ? ui.btnDisabled : null) }}
          onClick={unpublish}
          disabled={loading || saving || !canUnpublish}
          title={isNewUnsaved ? "Crie/publicar primeiro" : status !== "PUBLIC" ? "Somente quando estiver público" : "Voltar para rascunho"}
        >
          Despublicar
        </button>

        <button type="button" style={ui.btn} onClick={reloadSelected} disabled={loading || saving || isNewUnsaved || !openChapterId}>
          Recarregar
        </button>

        <div style={{ flex: "1 1 auto" }} />

        <button type="button" style={ui.btnGhost} onClick={goListMode} disabled={loading || saving}>
          Voltar
        </button>
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={ui.label}>Título (livre)</div>
        <input
          style={ui.input}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={() => {
            if (!didFocusTitle.current) {
              didFocusTitle.current = true;
              if (title === DEFAULT_NEW_TITLE) setTitle("");
            }
          }}
          placeholder="Ex.: Minha chegada ao mundo"
        />
        <div style={{ fontSize: 11, opacity: 0.7, marginTop: 6, fontWeight: 800 }}>{title.trim().length} / 120</div>
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={ui.label}>Descrição curta (opcional)</div>
        <textarea
          style={{ ...ui.textarea, minHeight: 70 }}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onFocus={() => {
            if (!didFocusDesc.current) {
              didFocusDesc.current = true;
              if (description === DEFAULT_NEW_DESCRIPTION) setDescription("");
            }
          }}
          placeholder="Uma frase curta sobre essa fase"
        />
        <div style={{ fontSize: 11, opacity: 0.7, marginTop: 6, fontWeight: 800 }}>{description.trim().length} / 220</div>
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={ui.label}>Texto do capítulo</div>
        <textarea style={{ ...ui.textarea, minHeight: 240 }} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Escreva com calma. Isso é o mapa da sua vida." />
        <div style={{ fontSize: 11, opacity: 0.7, marginTop: 6, fontWeight: 800 }}>{body.trim().length} caracteres</div>
      </div>
    </div>
  );

  return (
    <div style={ui.page}>
      <div style={ui.container}>
        <div style={ui.headerCard}>
          <div style={ui.headerGlow} />
          <div style={ui.h1Row}>
            <div>
              <h1 style={ui.h1}>Capítulos</h1>
              <div style={ui.subtitle}>
                {greetingPTBR()}, Alexandre. <span style={{ opacity: 0.82 }}>{pulseLabel}</span>
              </div>
            </div>
            <div style={ui.pill}>{countLabel}</div>
          </div>

          <div style={{ marginTop: 10, opacity: 0.82, fontWeight: 750, position: "relative", zIndex: 1 }}>{microcopy}</div>

          {mode === "list" ? headerFilters : null}
        </div>

        {mode === "list" && showDiag ? (
          <div style={ui.card}>
            <div style={{ fontWeight: 950, marginBottom: 6 }}>Diagnóstico</div>
            <div style={{ fontSize: 12, opacity: 0.78, marginTop: 6 }}>token: {token ? "OK" : "—"}</div>
            <div style={{ fontSize: 12, opacity: 0.78, marginTop: 6 }}>authorId (JWT): {authorId ?? "—"}</div>
            <div style={{ fontSize: 12, opacity: 0.78, marginTop: 6 }}>API: {lastApiInfo || "—"}</div>
            <div style={{ fontSize: 12, opacity: 0.78, marginTop: 6 }}>mode: {mode}</div>
            <div style={{ fontSize: 12, opacity: 0.78, marginTop: 6 }}>items: {items.length}</div>
          </div>
        ) : null}

        {mode === "list" ? (
          <>
            {toast ? (
              <div
                style={{
                  marginBottom: 14,
                  padding: 12,
                  borderRadius: 14,
                  border: "1px solid var(--hdud-border)",
                  background:
                    toast.kind === "ok"
                      ? "rgba(52, 199, 89, 0.10)"
                      : toast.kind === "warn"
                      ? "rgba(255, 204, 0, 0.10)"
                      : "rgba(255, 59, 48, 0.10)",
                  fontWeight: 900,
                }}
              >
                {toast.msg}
              </div>
            ) : null}

            {momentBlock}

            <div style={ui.card}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                <div style={ui.cardTitle}>Histórico</div>
                <div style={{ opacity: 0.75, fontSize: 12, fontWeight: 900 }}>
                  Clique para selecionar — <b>duplo clique</b> para editar.
                </div>
              </div>

              {loading ? (
                <div style={{ opacity: 0.85, fontWeight: 900 }}>Carregando…</div>
              ) : viewItems.length === 0 ? (
                <div style={ui.empty}>
                  <p style={ui.emptyTitle}>Nada por aqui — por enquanto.</p>
                  <div style={ui.emptyText}>Tente ajustar os filtros… ou crie um capítulo para começar o mapa.</div>
                </div>
              ) : (
                <div style={ui.listWrap}>
                  {viewItems.map((c) => {
                    const isHover = hoverId === c.chapter_id;
                    const isSel = selectedChapterId === c.chapter_id;
                    const statusLabel = c.status === "PUBLIC" ? "público" : "rascunho";
                    const ver = c.current_version_id ? `v${c.current_version_id}` : "v1";
                    const when = formatDateBR(c.updated_at || c.created_at);

                    return (
                      <div
                        key={c.chapter_id}
                        style={{
                          ...ui.row,
                          ...(isHover ? ui.rowHover : null),
                          ...(isSel ? ui.rowSelected : null),
                          paddingLeft: isSel ? 16 : 12,
                        }}
                        onMouseEnter={() => setHoverId(c.chapter_id)}
                        onMouseLeave={() => setHoverId((v) => (v === c.chapter_id ? null : v))}
                        onClick={() => setSelectedChapterId(c.chapter_id)}
                        onDoubleClick={() => {
                          if (!confirmIfDirty("Abrir capítulo para editar")) return;
                          void loadDetail(c.chapter_id);
                        }}
                        title="Duplo clique para editar"
                      >
                        {isSel ? <div style={ui.selectedBar} /> : null}

                        <div style={ui.rowTop}>
                          <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                            <div style={ui.rowTitle}>{c.title?.trim() ? c.title : `Capítulo #${c.chapter_id}`}</div>
                            <div style={{ opacity: 0.72, fontSize: 12, fontWeight: 900 }}>
                              #{c.chapter_id} • {ver} • {statusLabel}
                            </div>
                          </div>
                          <div style={ui.rowMeta}>{when}</div>
                        </div>

                        <div style={ui.rowSub}>{c.description ? c.description : "Adicione uma frase curta descrevendo essa fase."}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={ui.card}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                <div style={ui.cardTitle}>Guia de escrita</div>
                <div style={{ opacity: 0.75, fontSize: 12, fontWeight: 900 }}>
                  Sugestões rápidas — <b>{selectedTitlePreview}</b>
                </div>
              </div>

              <ul style={{ marginTop: 10, marginBottom: 0, paddingLeft: 18, fontSize: 12, opacity: 0.78, lineHeight: 1.6 }}>
                <li>Qual cenário define essa fase (cidade, rotina, época, clima)?</li>
                <li>Quem são as pessoas centrais aqui — e por quê?</li>
                <li>Qual foi a virada (antes/depois)?</li>
              </ul>
              <div style={{ marginTop: 8, fontSize: 11, opacity: 0.6 }}>*guia premium determinístico*</div>
            </div>
          </>
        ) : null}

        {mode === "edit" ? (
          <>
            {editorCard}
            {editorMemoriesBlock}
          </>
        ) : null}

        {/* ✅ Picker modal */}
        {pickerOpen ? (
          <div style={ui.overlay} onClick={() => setPickerOpen(false)}>
            <div style={ui.modal} onClick={(e) => e.stopPropagation()}>
              <div style={ui.modalHead}>
                <div>
                  <div style={{ fontWeight: 950, letterSpacing: -0.2 }}>Vincular memória</div>
                  <div style={{ opacity: 0.75, fontSize: 12, fontWeight: 800 }}>
                    Escolha uma memória para anexar a este capítulo.
                  </div>
                </div>
                <button type="button" style={ui.btn} onClick={() => setPickerOpen(false)}>
                  Fechar
                </button>
              </div>

              <div style={ui.modalBody}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <input
                    style={{ ...ui.input, maxWidth: 420 }}
                    placeholder="Buscar por título, conteúdo ou #ID…"
                    value={pickerQ}
                    onChange={(e) => setPickerQ(e.target.value)}
                  />
                  <div style={ui.pill}>
                    {pickerLoading ? "carregando…" : `${pickerViewItems.length} resultado(s)`}
                  </div>
                </div>

                {pickerLoading ? (
                  <div style={{ marginTop: 12, opacity: 0.85, fontWeight: 900 }}>Carregando inventário…</div>
                ) : pickerViewItems.length === 0 ? (
                  <div style={{ marginTop: 12, ...ui.empty }}>
                    <p style={ui.emptyTitle}>Nada encontrado.</p>
                    <div style={ui.emptyText}>Tente outra busca — ou crie uma nova memória em Memórias.</div>
                  </div>
                ) : (
                  <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                    {pickerViewItems.map((m) => {
                      const titleText = (m.title && String(m.title).trim()) || `Memória #${m.memory_id}`;
                      const when = formatDateBRShort(m.created_at || null);
                      const phaseLabel = (m.phase_name || m.life_phase || "").toString().trim();
                      const already = linkedIds.has(m.memory_id);

                      return (
                        <div
                          key={m.memory_id}
                          style={{
                            border: "1px solid var(--hdud-border)",
                            background: "var(--hdud-surface)",
                            borderRadius: 14,
                            padding: 12,
                            boxShadow: "var(--hdud-shadow-soft)",
                            display: "flex",
                            gap: 12,
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                              <div style={{ fontWeight: 950, letterSpacing: -0.2 }}>{titleText}</div>
                              <div style={{ opacity: 0.72, fontSize: 12, fontWeight: 900 }}>
                                #{m.memory_id}
                                {phaseLabel ? ` • ${phaseLabel}` : ""}
                                {when !== "—" ? ` • ${when}` : ""}
                              </div>
                            </div>
                            <div style={{ marginTop: 8, opacity: 0.82, fontSize: 12, lineHeight: 1.35, fontWeight: 750 }}>
                              {safeText(m.content, 220)}
                            </div>
                          </div>

                          <div style={{ display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
                            {already ? <div style={ui.pill}>já vinculada</div> : null}
                            <button
                              type="button"
                              style={already ? { ...ui.btn, ...ui.btnDisabled } : ui.btnPrimary}
                              disabled={already || saving}
                              onClick={() => linkMemory(m.memory_id)}
                              title={already ? "Esta memória já está vinculada" : "Vincular esta memória"}
                            >
                              Vincular
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}