// C:\HDUD_DATA\hdud-web-app\src\pages\ChapterEditorPage.tsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

type ChapterStatus = "DRAFT" | "PUBLIC";

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
};

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
      // ignore
    }
  }

  return { ...last, attempts };
}

function unwrapDetail(data: any): ApiChapterDetail | null {
  if (!data) return null;
  if ((data as any).chapter) return (data as any).chapter as ApiChapterDetail;
  if ((data as any).data && (data as any).data.chapter) return (data as any).data.chapter as ApiChapterDetail;
  return data as ApiChapterDetail;
}

// Normalização (evita dirty fantasma)
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

function safeTrimOrNull(v: any): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function toStatus(v: any): ChapterStatus {
  return v === "PUBLIC" ? "PUBLIC" : "DRAFT";
}

export default function ChapterEditorPage() {
  const navigate = useNavigate();
  const params = useParams();
  const chapterId = useMemo(() => Number(params.id), [params.id]);

  const token = getToken();
  const canUseApi = !!token;

  const jwt = useMemo(() => (token ? parseJwtPayload(token) : null), [token]);
  const authorId = useMemo(() => {
    const a = jwt?.author_id ?? jwt?.authorId ?? jwt?.sub_author_id ?? null;
    const n = Number(a);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [jwt]);

  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [body, setBody] = useState<string>("");

  const [status, setStatus] = useState<ChapterStatus>("DRAFT");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autosaveState, setAutosaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<any>(null);

  const detailSeqRef = useRef(0);
  const snapshotRef = useRef<Snapshot | null>(null);

  const autosaveTimerRef = useRef<any>(null);
  const lastChangeAtRef = useRef<number>(0);
  const lastSavedAtRef = useRef<number>(0);

  function setToastAuto(t: Toast | null, ms = 2600) {
    setToast(t);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    if (t) toastTimer.current = setTimeout(() => setToast(null), ms);
  }

  function needAuthGuard(): boolean {
    const t = getToken();
    if (!t) {
      setToastAuto({ kind: "warn", msg: "Token ausente. Faça login para escrever." });
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

  const isDirty = useMemo(() => {
    if (loading || saving) return false;
    const snap = snapshotRef.current;
    if (!snap) return false;

    const cur: Snapshot = {
      title: normTitle(title),
      description: normDesc(description),
      body: normText(body),
      status,
    };
    const base = normSnap(snap);

    return cur.title !== base.title || cur.description !== base.description || cur.body !== base.body || cur.status !== base.status;
  }, [title, description, body, status, loading, saving]);

  // ✅ Integra com Dirty Guard global do App (hdud:dirty)
  useEffect(() => {
    try {
      const evt = new CustomEvent("hdud:dirty", {
        detail: {
          dirty: isDirty,
          message: "Você tem alterações não salvas no capítulo. Deseja sair sem salvar?",
          source: "ChapterEditorPage",
        },
      });
      window.dispatchEvent(evt);
    } catch {
      // ignore
    }
  }, [isDirty]);

  // Guard de refresh/fechar aba (redundante ao App, mas seguro)
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

  async function loadDetail(id: number) {
    if (needAuthGuard()) return;

    const seq = ++detailSeqRef.current;
    setLoading(true);
    setToast(null);

    try {
      const result = await tryMany<any>([
        () => apiRequest<any>(`/api/chapter/${id}`, { method: "GET" }),
        () => apiRequest<any>(`/api/chapters/${id}`, { method: "GET" }),
        () => apiRequest<any>(`/api/chapter/detail/${id}`, { method: "GET" }),
        () => apiRequest<any>(`/api/chapters/detail/${id}`, { method: "GET" }),
      ]);

      if (seq !== detailSeqRef.current) return;

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

      const st = toStatus((d as any).status);

      setTitle(String(d.title ?? ""));
      setDescription(String(d.description ?? ""));
      setBody(normText((d as any).body ?? (d as any).content ?? ""));
      setStatus(st);

      snapshotRef.current = normSnap({
        title: String(d.title ?? ""),
        description: String(d.description ?? ""),
        body: normText((d as any).body ?? (d as any).content ?? ""),
        status: st,
      });

      setAutosaveState("idle");
    } finally {
      setLoading(false);
    }
  }

  async function save(statusOverride?: ChapterStatus) {
    if (needAuthGuard()) return;
    if (!Number.isFinite(chapterId) || chapterId <= 0) return;

    setSaving(true);
    setAutosaveState("saving");
    setToast(null);

    try {
      const payload = {
        title: safeTrimOrNull(title) ?? "",
        description: safeTrimOrNull(description),
        body: body ?? "",
        status: statusOverride ?? status,
      };

      const result = await tryMany<any>([
        () =>
          apiRequest<any>(`/api/chapter/${chapterId}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          }),
        () =>
          apiRequest<any>(`/api/chapters/${chapterId}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          }),
      ]);

      if (!result.ok) {
        const hint =
          result.status === 401 ? "401 (token expirado)." : result.status === 404 ? "404 (rota não existe)." : `HTTP ${result.status || "erro"}`;
        setAutosaveState("error");
        setToastAuto({ kind: "err", msg: `Falha ao salvar (${hint}).` });
        return;
      }

      const finalStatus = (statusOverride ?? status) as ChapterStatus;
      setStatus(finalStatus);

      snapshotRef.current = normSnap({
        title: normTitle(title),
        description: normDesc(description),
        body: normText(body),
        status: finalStatus,
      });

      lastSavedAtRef.current = Date.now();
      setAutosaveState("saved");
      // “silencioso”: toast só em ações explícitas (Salvar/Publicar)
    } finally {
      setSaving(false);
      // volta pra idle depois de um instante (sensação invisível)
      window.setTimeout(() => {
        setAutosaveState((s) => (s === "saved" ? "idle" : s));
      }, 900);
    }
  }

  // ✅ Autosave silencioso: debounce + evita spam
  useEffect(() => {
    if (!canUseApi) return;
    if (loading) return;
    if (!Number.isFinite(chapterId) || chapterId <= 0) return;

    if (!isDirty) return;

    // marca momento de mudança
    lastChangeAtRef.current = Date.now();

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);

    autosaveTimerRef.current = setTimeout(() => {
      // se houve mudança nos últimos 900ms, aguarda mais
      const now = Date.now();
      if (now - lastChangeAtRef.current < 900) return;

      // throttle mínimo entre saves automáticos (ex.: 3s)
      if (now - lastSavedAtRef.current < 3000) return;

      void save(); // salva como status atual, sem ruido
    }, 1200);

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, body, status, isDirty, loading, chapterId, canUseApi]);

  useEffect(() => {
    if (!canUseApi) {
      setToastAuto({ kind: "warn", msg: "Token ausente. Faça login para escrever." });
      return;
    }
    if (!Number.isFinite(chapterId) || chapterId <= 0) {
      setToastAuto({ kind: "err", msg: "ID de capítulo inválido." });
      return;
    }
    void loadDetail(chapterId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUseApi, chapterId]);

  function back() {
    // navegação simples; Dirty Guard global (App) cobre back/forward,
    // e antes de sair da aba.
    navigate("/chapters");
  }

  return (
    <div style={styles.page}>
      <div style={styles.wrap}>
        {/* Header mínimo */}
        <div style={styles.header}>
          <button className="hdud-btn" onClick={back} disabled={saving}>
            ← Voltar
          </button>

          <div style={styles.headerRight}>
            {/* Ações discretas (não “admin”) */}
            <button className="hdud-btn" onClick={() => save("DRAFT")} disabled={loading || saving}>
              Salvar
            </button>
            <button className="hdud-btn" onClick={() => save("PUBLIC")} disabled={loading || saving}>
              Publicar
            </button>
          </div>
        </div>

        {/* Título protagonista */}
        <div style={styles.titleBlock}>
          <input
            className="hdud-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título do capítulo"
            style={styles.titleInput}
          />
        </div>

        {/* Corpo */}
        <div style={styles.editorBlock}>
          <textarea
            className="hdud-input"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Escreva sua história aqui…"
            style={styles.editor}
          />
        </div>

        {/* descrição (opcional) sem “admin” */}
        <div style={styles.descBlock}>
          <textarea
            className="hdud-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="(opcional) Uma frase curta para contextualizar essa fase"
            style={styles.desc}
          />
        </div>

        {/* Rodapé invisível (autosave silencioso) */}
        <div style={styles.footer}>
          <span style={styles.footerText}>
            {autosaveState === "saving" ? "Salvando…" : autosaveState === "saved" ? "Salvo" : autosaveState === "error" ? "Não foi possível salvar" : " "}
          </span>
          <span style={styles.footerText}>{status === "PUBLIC" ? " " : " "}</span>
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
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { width: "100%", color: "var(--hdud-text)" },
  wrap: {
    width: "100%",
    maxWidth: 1200,
    margin: "0 auto",
    padding: "18px 18px 26px 18px",
    boxSizing: "border-box",
  },

  header: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 },
  headerRight: { display: "flex", gap: 10, alignItems: "center" },

  titleBlock: { marginTop: 14 },
  titleInput: {
    fontSize: 28,
    fontWeight: 900,
    letterSpacing: -0.4,
    padding: "14px 14px",
    borderRadius: 14,
  },

  editorBlock: { marginTop: 14 },
  editor: {
    minHeight: "56vh",
    resize: "vertical",
    fontFamily: "inherit",
    lineHeight: 1.65,
    padding: "14px 14px",
    borderRadius: 14,
  },

  descBlock: { marginTop: 14 },
  desc: {
    minHeight: 90,
    resize: "vertical",
    fontFamily: "inherit",
    lineHeight: 1.5,
    padding: "14px 14px",
    borderRadius: 14,
    opacity: 0.95,
  },

  footer: { marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center", minHeight: 18 },
  footerText: { fontSize: 12, opacity: 0.45 },
};