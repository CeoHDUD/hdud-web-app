// C:\HDUD_DATA\hdud-web-app\src\memories\MemoryDetailPage.tsx

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useNavigate, useParams } from "react-router-dom";

type Props = { token?: string | null; onLogout?: () => void };

type MemoryDetail = {
  id?: number | string;
  authorId?: number | string;
  chapterId?: number | null;
  phaseId?: number | null;
  lifePhase?: string | null;
  phaseName?: string | null;
  title?: string | null;
  content?: string;
  createdAt?: string;
  versionNumber?: number;
  isDeleted?: boolean;
  meta?: { can_edit?: boolean; current_version?: number } | any;
  raw?: any;
};

type MemoryVersion = {
  memory_id: number;
  version_number: number;
  title?: string | null;
  content?: string;
  created_at?: string;
  created_by?: string;
};

type DiffRow = { t: "eq" | "add" | "del"; v: string };

const API_BASE = "/api";
const REQ_TIMEOUT_MS = 12000;

const LIFE_PHASES = [
  { value: "", label: "— (sem fase)" },
  { value: "CHILDHOOD", label: "Infância" },
  { value: "STUDIES", label: "Estudos" },
  { value: "CAREER", label: "Carreira" },
  { value: "RELATIONSHIPS", label: "Relacionamentos" },
  { value: "FAMILY", label: "Família" },
  { value: "CRISIS", label: "Crises" },
  { value: "ACHIEVEMENTS", label: "Conquistas" },
  { value: "OTHER", label: "Outros" },
] as const;

function lifePhaseLabel(v?: string | null) {
  if (!v) return "—";
  const found = LIFE_PHASES.find((x) => x.value === v);
  return found ? found.label : String(v);
}

function getTokenFromStorage(): string | null {
  return (
    localStorage.getItem("hdud_access_token") ||
    localStorage.getItem("HDUD_TOKEN") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("token")
  );
}

function isAbortError(e: any) {
  return e?.name === "AbortError" || String(e?.message || "").toLowerCase().includes("aborted");
}

export default function MemoryDetailPage(props: Props) {
  const { id } = useParams();
  const nav = useNavigate();
  const token = useMemo(() => props.token || getTokenFromStorage(), [props.token]);

  const [loadingDetail, setLoadingDetail] = useState(false);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [memory, setMemory] = useState<MemoryDetail | null>(null);

  const [loadingVersions, setLoadingVersions] = useState(false);
  const [errorVersions, setErrorVersions] = useState<string | null>(null);
  const [versions, setVersions] = useState<MemoryVersion[]>([]);

  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [draftLifePhase, setDraftLifePhase] = useState<string>("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [errorEdit, setErrorEdit] = useState<string | null>(null);
  const [successEdit, setSuccessEdit] = useState<string | null>(null);

  const [diffVA, setDiffVA] = useState<number | null>(null);
  const [diffVB, setDiffVB] = useState<number | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  // ✅ hover das versões (investor-ready)
  const [hoverVersionKey, setHoverVersionKey] = useState<string | null>(null);

  const memoryIdNum = useMemo(() => {
    const n = Number(id);
    return Number.isFinite(n) ? n : null;
  }, [id]);

  const detailAbortRef = useRef<AbortController | null>(null);
  const versionsAbortRef = useRef<AbortController | null>(null);
  const putAbortRef = useRef<AbortController | null>(null);

  const hardLogout = useCallback(() => {
    localStorage.removeItem("hdud_access_token");
    localStorage.removeItem("HDUD_TOKEN");
    localStorage.removeItem("access_token");
    localStorage.removeItem("token");
    props.onLogout?.();
    nav("/login");
  }, [nav, props.onLogout]);

  const t = useMemo(() => {
    return {
      pageBg: "var(--hdud-bg, #f6f7fb)",
      surface: "var(--hdud-surface, #ffffff)",
      surface2: "var(--hdud-surface-2, #fafafa)",
      text: "var(--hdud-text, #0f172a)",
      text2: "var(--hdud-text-2, #666666)",
      border: "var(--hdud-border, #d7dbe7)",
      borderSoft: "var(--hdud-border-soft, #eeeeee)",
      shadow: "var(--hdud-shadow, 0 14px 30px rgba(20,20,40,.08))",
      btnPrimaryBg: "var(--hdud-btn-primary-bg, #0f172a)",
      btnPrimaryText: "var(--hdud-btn-primary-text, #ffffff)",
      mutedBadgeBg: "var(--hdud-badge-bg, #fafafa)",
      mutedBadgeBorder: "var(--hdud-badge-border, #dddddd)",
      mutedBadgeText: "var(--hdud-badge-text, #222222)",
      okBg: "var(--hdud-ok-bg, #f3fff5)",
      okBorder: "var(--hdud-ok-border, #cce6d0)",
      okText: "var(--hdud-ok-text, #145a20)",
      errBg: "var(--hdud-err-bg, #fff5f5)",
      errBorder: "var(--hdud-err-border, #f3bcbc)",
      errText: "var(--hdud-err-text, #a31212)",
    };
  }, []);

  const badge: CSSProperties = {
    border: `1px solid ${t.mutedBadgeBorder}`,
    borderRadius: 999,
    padding: "4px 10px",
    fontSize: 12,
    background: t.mutedBadgeBg,
    color: t.mutedBadgeText,
    fontWeight: 900,
  };

  const subtle: CSSProperties = { color: t.text2, fontSize: 13, fontWeight: 750 };

  // ✅ hover card versões
  const versionCard: CSSProperties = {
    border: `1px solid ${t.borderSoft}`,
    borderRadius: 12,
    padding: 12,
    background: t.surface,
    boxShadow: t.shadow,
    transition: "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
    transform: "translate3d(0,0,0)",
    cursor: "default",
  };

  const versionCardHover: CSSProperties = {
    transform: "translate3d(0,-2px,0)",
    boxShadow: "0 18px 40px rgba(20,20,40,.10)",
    borderColor: "rgba(0,0,0,0.12)",
  };

  const input: CSSProperties = {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 12,
    border: `1px solid ${t.border}`,
    outline: "none",
    fontSize: 14,
    background: t.surface,
    color: t.text,
  };

  const textarea: CSSProperties = {
    ...input,
    minHeight: 180,
    resize: "vertical",
    fontFamily: "inherit",
    lineHeight: 1.45,
  };

  function fmtDateTimeCompactPtBR(iso?: string) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = String(d.getFullYear());
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
  }

  async function readJsonOrText(res: Response): Promise<any> {
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      try {
        return await res.json();
      } catch {
        return null;
      }
    }
    try {
      return await res.text();
    } catch {
      return null;
    }
  }

  function messageFromErrorPayload(payload: any): string | null {
    if (!payload) return null;
    if (typeof payload === "string") return payload;
    return payload?.detail || payload?.error || payload?.message || null;
  }

  function unwrapMemory(payload: any): any {
    if (!payload) return null;
    if (payload.memory_id != null) return payload;
    if (payload.memory?.memory_id != null) return payload.memory;
    if (payload.item?.raw?.memory_id != null) return payload.item.raw;
    if (payload.raw?.memory_id != null) return payload.raw;
    return payload;
  }

  function unwrapVersions(payload: any): any[] {
    if (!payload) return [];
    if (Array.isArray(payload.versions)) return payload.versions;
    if (Array.isArray(payload.items)) return payload.items;
    if (Array.isArray(payload)) return payload;
    return [];
  }

  async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
    const ctrl = (init.signal ? null : new AbortController()) as AbortController | null;
    const signal = (init.signal as AbortSignal | undefined) ?? ctrl?.signal;

    const tmr = setTimeout(() => {
      try {
        ctrl?.abort();
      } catch {}
    }, timeoutMs);

    try {
      const res = await fetch(url, { ...init, signal });
      return res;
    } finally {
      clearTimeout(tmr);
    }
  }

  async function apiGet(path: string, externalSignal?: AbortSignal): Promise<any> {
    if (!token) {
      const err: any = new Error("Sessão expirada. Faça login novamente.");
      err.status = 401;
      throw err;
    }

    const res = await fetchWithTimeout(
      `${API_BASE}${path}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: externalSignal,
      },
      REQ_TIMEOUT_MS
    );

    if (!res.ok) {
      const payload = await readJsonOrText(res);
      const msg = messageFromErrorPayload(payload);
      const err: any = new Error(msg || `HTTP ${res.status}`);
      err.status = res.status;
      err.payload = payload;
      throw err;
    }

    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      const txt = await res.text();
      throw new Error(`Resposta não-JSON (${res.status}). Início: ${txt.slice(0, 80)}`);
    }

    return res.json();
  }

  async function apiPut(path: string, body: any, externalSignal?: AbortSignal): Promise<any> {
    if (!token) {
      const err: any = new Error("Sessão expirada. Faça login novamente.");
      err.status = 401;
      throw err;
    }

    const res = await fetchWithTimeout(
      `${API_BASE}${path}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: externalSignal,
      },
      REQ_TIMEOUT_MS
    );

    if (!res.ok) {
      const payload = await readJsonOrText(res);
      const msg = messageFromErrorPayload(payload);
      const err: any = new Error(msg || `HTTP ${res.status}`);
      err.status = res.status;
      err.payload = payload;
      throw err;
    }

    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      try {
        return await res.json();
      } catch {
        return null;
      }
    }
    return null;
  }

  const loadDetail = useCallback(async () => {
    if (!memoryIdNum) return;

    if (!token) {
      setErrorDetail("Sessão expirada. Faça login novamente.");
      hardLogout();
      return;
    }

    try {
      detailAbortRef.current?.abort();
    } catch {}
    const ctrl = new AbortController();
    detailAbortRef.current = ctrl;

    setLoadingDetail(true);
    setErrorDetail(null);

    try {
      const payload = await apiGet(`/memory/${memoryIdNum}`, ctrl.signal);
      const m = unwrapMemory(payload);

      setMemory({
        id: m?.memory_id,
        authorId: m?.author_id,
        chapterId: m?.chapter_id ?? null,
        phaseId: m?.phase_id ?? null,
        lifePhase: m?.life_phase ?? null,
        phaseName: m?.phase_name ?? null,
        title: m?.title ?? null,
        content: m?.content ?? "",
        createdAt: m?.created_at,
        versionNumber: m?.version_number,
        isDeleted: m?.is_deleted,
        meta: m?.meta,
        raw: m,
      });
    } catch (e: any) {
      if (isAbortError(e)) return;
      if (e?.status === 401) {
        setErrorDetail("Sessão expirada. Faça login novamente.");
        hardLogout();
      } else {
        setErrorDetail(e?.message ?? "Erro ao carregar memória.");
      }
    } finally {
      setLoadingDetail(false);
    }
  }, [hardLogout, memoryIdNum, token]);

  const loadVersions = useCallback(async () => {
    if (!memoryIdNum) return;

    if (!token) {
      setErrorVersions("Sessão expirada. Faça login novamente.");
      hardLogout();
      return;
    }

    try {
      versionsAbortRef.current?.abort();
    } catch {}
    const ctrl = new AbortController();
    versionsAbortRef.current = ctrl;

    setLoadingVersions(true);
    setErrorVersions(null);

    try {
      const payload = await apiGet(`/memory/${memoryIdNum}/versions`, ctrl.signal);
      const list = unwrapVersions(payload) as MemoryVersion[];
      const safeList = Array.isArray(list) ? list : [];

      setVersions(safeList);

      const nums = safeList.map((x) => x.version_number).filter((x) => Number.isFinite(x));
      const uniqSorted = Array.from(new Set(nums)).sort((a, b) => a - b);

      setDiffVA((prev) => {
        if (prev != null) return prev;
        if (uniqSorted.length >= 2) return uniqSorted[uniqSorted.length - 2];
        if (uniqSorted.length === 1) return uniqSorted[0];
        return null;
      });

      setDiffVB((prev) => {
        if (prev != null) return prev;
        if (uniqSorted.length >= 2) return uniqSorted[uniqSorted.length - 1];
        if (uniqSorted.length === 1) return uniqSorted[0];
        return null;
      });
    } catch (e: any) {
      if (isAbortError(e)) return;
      if (e?.status === 401) {
        setErrorVersions("Sessão expirada. Faça login novamente.");
        hardLogout();
      } else {
        setErrorVersions(e?.message ?? "Erro ao carregar versões.");
      }
      setVersions([]);
    } finally {
      setLoadingVersions(false);
    }
  }, [hardLogout, memoryIdNum, token]);

  function startEdit() {
    if (!memory) return;
    setSuccessEdit(null);
    setErrorEdit(null);
    setDraftTitle((memory.title ?? "") as string);
    setDraftContent(memory.content ?? "");
    setDraftLifePhase((memory.lifePhase ?? "") as string);
    setEditing(true);
  }

  function cancelEdit() {
    setErrorEdit(null);
    setSuccessEdit(null);
    setEditing(false);
    setDraftTitle("");
    setDraftContent("");
    setDraftLifePhase("");
  }

  const currentVersion =
    (memory?.raw?.meta?.current_version ??
      memory?.raw?.meta?.currentVersion ??
      memory?.versionNumber ??
      1) as number;

  const canEdit = !!(memory?.raw?.meta?.can_edit ?? memory?.raw?.meta?.canEdit ?? false);

  async function saveEdit() {
    if (!memoryIdNum) return;

    setSuccessEdit(null);
    setErrorEdit(null);

    if (!token) {
      setErrorEdit("Sessão expirada. Faça login novamente.");
      hardLogout();
      return;
    }

    const contentTrim = (draftContent ?? "").trim();
    if (!contentTrim) {
      setErrorEdit("Conteúdo é obrigatório.");
      return;
    }

    const titleTrim = (draftTitle ?? "").trim();
    const phaseTrim = (draftLifePhase ?? "").trim();
    const phaseValue = phaseTrim ? phaseTrim : null;

    const payload: any = {
      content: contentTrim,
      title: titleTrim ? titleTrim : null,
      life_phase: phaseValue,
    };

    try {
      putAbortRef.current?.abort();
    } catch {}
    const ctrl = new AbortController();
    putAbortRef.current = ctrl;

    setSavingEdit(true);
    try {
      await apiPut(`/memory/${memoryIdNum}`, payload, ctrl.signal);
      await loadDetail();
      await loadVersions();
      setEditing(false);
      setSuccessEdit("Alterações salvas — nova versão registrada.");
    } catch (e: any) {
      if (isAbortError(e)) return;
      if (e?.status === 401) {
        setErrorEdit("Sessão expirada. Faça login novamente.");
        hardLogout();
      } else {
        setErrorEdit(e?.message ?? "Erro ao salvar alterações.");
      }
    } finally {
      setSavingEdit(false);
    }
  }

  async function restoreVersion(v: MemoryVersion) {
    if (!memoryIdNum) return;
    if (!canEdit) return;

    const ok = window.confirm(
      `Restaurar a versão v${v.version_number}?\n\nIsso criará uma NOVA versão baseada nessa versão.`
    );
    if (!ok) return;

    setErrorEdit(null);
    setSuccessEdit(null);

    try {
      putAbortRef.current?.abort();
    } catch {}
    const ctrl = new AbortController();
    putAbortRef.current = ctrl;

    setSavingEdit(true);
    try {
      const payload = {
        title: ((v.title ?? "") as string).trim() || null,
        content: (v.content ?? "").trim(),
        life_phase: memory?.lifePhase ?? null,
      };

      if (!payload.content) throw new Error("Não é possível restaurar uma versão sem conteúdo.");

      await apiPut(`/memory/${memoryIdNum}`, payload, ctrl.signal);
      await loadDetail();
      await loadVersions();
      setSuccessEdit(`Rollback criado: nova versão baseada na v${v.version_number}.`);
    } catch (e: any) {
      if (isAbortError(e)) return;
      if (e?.status === 401) {
        setErrorEdit("Sessão expirada. Faça login novamente.");
        hardLogout();
      } else {
        setErrorEdit(e?.message ?? "Erro ao restaurar versão.");
      }
    } finally {
      setSavingEdit(false);
    }
  }

  function getVersionContent(vn: number | null): string {
    if (vn == null) return "";
    const v = versions.find((x) => x.version_number === vn);
    return (v?.content ?? "") as string;
  }

  function diffLines(a = "", b = ""): DiffRow[] {
    const aL = String(a ?? "").split("\n");
    const bL = String(b ?? "").split("\n");
    const out: DiffRow[] = [];
    const max = Math.max(aL.length, bL.length);

    for (let i = 0; i < max; i++) {
      const left = aL[i] ?? "";
      const right = bL[i] ?? "";

      if (left === right) {
        if (left.trim() !== "") out.push({ t: "eq", v: left });
        continue;
      }

      if (left.trim() !== "") out.push({ t: "del", v: left });
      if (right.trim() !== "") out.push({ t: "add", v: right });
    }

    return out;
  }

  const canCompare = versions.length >= 1 && diffVA != null && diffVB != null;
  const diffRows: DiffRow[] =
    showDiff && canCompare ? diffLines(getVersionContent(diffVA), getVersionContent(diffVB)) : [];

  useEffect(() => {
    try {
      detailAbortRef.current?.abort();
      versionsAbortRef.current?.abort();
      putAbortRef.current?.abort();
    } catch {}

    if (!memoryIdNum) return;

    if (!token) {
      setErrorDetail("Sessão expirada. Faça login novamente.");
      hardLogout();
      return;
    }

    loadDetail();
    loadVersions();

    return () => {
      try {
        detailAbortRef.current?.abort();
        versionsAbortRef.current?.abort();
        putAbortRef.current?.abort();
      } catch {}
    };
  }, [memoryIdNum, token, hardLogout, loadDetail, loadVersions]);

  const breadcrumbLabel = ((memory?.title ?? "") as string).trim()
    ? (memory!.title as string)
    : memoryIdNum != null
      ? `#${memoryIdNum}`
      : id
        ? `#${id}`
        : "#";

  return (
    <div style={{ minHeight: "100vh", background: t.pageBg, color: t.text }}>
      {/* ✅ Mais largo (mas ainda pode ser limitado pelo AppShell) */}
      <div
        style={{
          width: "100%",
          maxWidth: 1680,
          margin: "0 auto",
          padding: "clamp(16px, 2.2vw, 28px) clamp(16px, 2.8vw, 56px)",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            color: t.text2,
          }}
        >
          <button
            type="button"
            onClick={() => nav("/memories")}
            style={{
              border: "none",
              background: "transparent",
              padding: 0,
              color: t.text2,
              cursor: "pointer",
              fontWeight: 900,
            }}
            aria-label="Voltar para Memórias"
            title="Voltar para Memórias"
          >
            Memórias
          </button>

          <span style={{ opacity: 0.6 }}>/</span>

          <span
            style={{
              color: t.text,
              fontWeight: 900,
              maxWidth: 720,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={breadcrumbLabel}
          >
            {breadcrumbLabel}
          </span>
        </div>

        {(loadingDetail || loadingVersions) && <p style={{ color: t.text2 }}>Carregando...</p>}
        {errorDetail && <p style={{ color: t.errText }}>{errorDetail}</p>}
        {!errorDetail && !loadingDetail && !memory && (
          <p style={{ color: t.text2 }}>Memória não encontrada.</p>
        )}

        {memory && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div style={{ minWidth: 260 }}>
                <h1 style={{ marginBottom: 6, fontSize: 28, lineHeight: 1.15 }}>
                  {memory.title || "(sem título)"}
                </h1>
                <div style={subtle}>
                  Criada em <strong>{fmtDateTimeCompactPtBR(memory.createdAt)}</strong>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
                <span style={badge}>v{currentVersion}</span>
                {canEdit && <span style={badge}>Editável</span>}
                {memory.authorId != null && <span style={badge}>Autor {String(memory.authorId)}</span>}
                {memory.chapterId != null && <span style={badge}>Capítulo {String(memory.chapterId)}</span>}
                <span style={badge}>
                  Fase: {lifePhaseLabel(memory.lifePhase)}
                  {memory.phaseName ? ` (${memory.phaseName})` : ""}
                </span>

                {memory.isDeleted && (
                  <span style={{ ...badge, borderColor: t.errBorder, background: t.errBg, color: t.errText }}>
                    Apagada
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginTop: 14 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  onClick={loadDetail}
                  disabled={loadingDetail}
                  style={{
                    fontSize: 12,
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: `1px solid ${t.border}`,
                    background: t.surface,
                    color: t.text,
                    cursor: loadingDetail ? "not-allowed" : "pointer",
                    fontWeight: 800,
                  }}
                >
                  {loadingDetail ? "Atualizando..." : "Recarregar detalhe"}
                </button>

                <button
                  onClick={loadVersions}
                  disabled={loadingVersions}
                  style={{
                    fontSize: 12,
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: `1px solid ${t.border}`,
                    background: t.surface,
                    color: t.text,
                    cursor: loadingVersions ? "not-allowed" : "pointer",
                    fontWeight: 800,
                  }}
                >
                  {loadingVersions ? "Atualizando..." : "Recarregar versões"}
                </button>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {canEdit && !editing && (
                  <button
                    onClick={startEdit}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 12,
                      border: `1px solid ${t.btnPrimaryBg}`,
                      background: t.btnPrimaryBg,
                      color: t.btnPrimaryText,
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    Editar
                  </button>
                )}

                {canEdit && editing && (
                  <>
                    <button
                      onClick={cancelEdit}
                      disabled={savingEdit}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 12,
                        border: `1px solid ${t.border}`,
                        background: t.surface,
                        color: t.text,
                        fontWeight: 800,
                        cursor: savingEdit ? "not-allowed" : "pointer",
                      }}
                    >
                      Cancelar
                    </button>

                    <button
                      onClick={saveEdit}
                      disabled={savingEdit}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 12,
                        border: `1px solid ${t.btnPrimaryBg}`,
                        background: t.btnPrimaryBg,
                        color: t.btnPrimaryText,
                        fontWeight: 900,
                        cursor: savingEdit ? "not-allowed" : "pointer",
                      }}
                    >
                      {savingEdit ? "Salvando..." : "Salvar alterações"}
                    </button>
                  </>
                )}
              </div>
            </div>

            {(errorEdit || successEdit) && (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 12,
                  border: `1px solid ${errorEdit ? t.errBorder : t.okBorder}`,
                  background: errorEdit ? t.errBg : t.okBg,
                  color: errorEdit ? t.errText : t.okText,
                  fontWeight: 700,
                }}
              >
                {errorEdit ?? successEdit}
              </div>
            )}

            <div
              style={{
                border: `1px solid ${t.borderSoft}`,
                padding: 16,
                borderRadius: 12,
                marginTop: 18,
                background: t.surface,
                boxShadow: t.shadow,
              }}
            >
              <div style={{ opacity: 0.65, fontSize: 12, marginBottom: 8, color: t.text2 }}>
                {editing ? "Edição (salvar cria nova versão)" : "Conteúdo (estado atual)"}
              </div>

              {!editing ? (
                <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.55, color: t.text }}>
                  {memory.content || "(vazio)"}
                </div>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.75, marginBottom: 6, color: t.text2 }}>
                      Fase da vida (opcional)
                    </div>
                    <select
                      value={draftLifePhase}
                      onChange={(e) => setDraftLifePhase(e.target.value)}
                      disabled={savingEdit}
                      style={{ ...input, padding: "12px 12px", cursor: savingEdit ? "not-allowed" : "pointer" }}
                      aria-label="Selecionar fase da vida"
                    >
                      {LIFE_PHASES.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    <div style={{ marginTop: 6, ...subtle }}>
                      Agora isso persiste no banco via domínio (FK) e depois vira filtro “Memórias por Fase”.
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.75, marginBottom: 6, color: t.text2 }}>
                      Título
                    </div>
                    <input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} placeholder="(opcional)" style={input} disabled={savingEdit} />
                  </div>

                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.75, marginBottom: 6, color: t.text2 }}>
                      Conteúdo *
                    </div>
                    <textarea value={draftContent} onChange={(e) => setDraftContent(e.target.value)} placeholder="Escreva aqui..." style={textarea} disabled={savingEdit} />
                  </div>

                  <div style={{ ...subtle }}>
                    Ao salvar, o HDUD registra uma <strong>nova versão</strong> — não sobrescreve versões anteriores.
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginTop: 28 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                <h3 style={{ margin: 0 }}>Linha do Tempo (Versões)</h3>
                <button
                  onClick={loadVersions}
                  disabled={loadingVersions}
                  style={{
                    fontSize: 12,
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: `1px solid ${t.border}`,
                    background: t.surface,
                    color: t.text,
                    cursor: loadingVersions ? "not-allowed" : "pointer",
                    fontWeight: 800,
                  }}
                >
                  {loadingVersions ? "Atualizando..." : "Recarregar versões"}
                </button>
              </div>

              <p style={{ marginTop: 6, ...subtle }}>
                Versão atual: <strong>v{currentVersion}</strong>
                {" • "}
                {versions.length > 0 ? `${versions.length} versão(ões) registradas` : "nenhuma versão registrada ainda"}
              </p>

              {errorVersions && <p style={{ color: t.errText }}>{errorVersions}</p>}

              {!loadingVersions && versions.length === 0 ? (
                <div style={{ marginTop: 12, border: `1px dashed ${t.border}`, borderRadius: 12, padding: 14, background: t.surface2 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Nenhuma versão encontrada</div>
                  <div style={subtle}>Edite e salve esta memória para gerar a primeira versão no histórico.</div>
                </div>
              ) : (
                <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  {/* ✅ FIX: map com bloco + return (JSX válido) */}
                  {versions.map((v) => {
                    const key = `${v.memory_id}-${v.version_number}`;
                    const isHover = hoverVersionKey === key;

                    return (
                      <div
                        key={key}
                        style={{ ...versionCard, ...(isHover ? versionCardHover : undefined) }}
                        onMouseEnter={() => setHoverVersionKey(key)}
                        onMouseLeave={() => setHoverVersionKey((cur) => (cur === key ? null : cur))}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            <span style={badge}>v{v.version_number}</span>
                            <span style={{ fontWeight: 900, color: t.text }}>{v.title || "(sem título)"}</span>
                            {v.version_number === currentVersion && (
                              <span style={{ ...badge, borderColor: t.okBorder, background: t.okBg, color: t.okText }}>
                                Atual
                              </span>
                            )}
                          </div>
                          <div style={subtle}>{fmtDateTimeCompactPtBR(v.created_at)}</div>
                        </div>

                        <div style={{ marginTop: 8 }}>
                          <div style={{ opacity: 0.75, fontSize: 12, marginBottom: 6, color: t.text2, fontWeight: 900 }}>
                            Snapshot
                          </div>

                          {/* ✅ clamp 3 linhas (investor-ready) */}
                          <div
                            style={{
                              whiteSpace: "pre-wrap",
                              lineHeight: 1.5,
                              color: t.text,
                              display: "-webkit-box",
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                              fontWeight: 700,
                              opacity: 0.95,
                            }}
                          >
                            {v.content || "(vazio)"}
                          </div>
                        </div>

                        {canEdit && v.version_number !== currentVersion && (
                          <button
                            onClick={() => restoreVersion(v)}
                            disabled={savingEdit}
                            style={{
                              marginTop: 10,
                              padding: "7px 10px",
                              borderRadius: 10,
                              border: `1px solid ${t.btnPrimaryBg}`,
                              background: t.surface,
                              color: t.text,
                              fontWeight: 900,
                              fontSize: 12,
                              cursor: savingEdit ? "not-allowed" : "pointer",
                            }}
                          >
                            Restaurar esta versão
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ marginTop: 18, borderTop: `1px solid ${t.borderSoft}`, paddingTop: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 900 }}>Comparar versões</div>
                    <div style={{ fontSize: 12, opacity: 0.7, color: t.text2 }}>
                      Selecione duas versões e veja o que foi adicionado/removido (diff por linhas).
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <select
                      value={diffVA ?? ""}
                      onChange={(e) => {
                        const vv = Number(e.target.value);
                        setDiffVA(Number.isFinite(vv) ? vv : null);
                        setShowDiff(false);
                      }}
                      style={{ padding: "8px 10px", borderRadius: 10, border: `1px solid ${t.border}`, background: t.surface, color: t.text, fontWeight: 900 }}
                    >
                      <option value="">Versão A</option>
                      {versions
                        .map((x) => x.version_number)
                        .filter((x, idx, arr) => arr.indexOf(x) === idx)
                        .sort((a, b) => a - b)
                        .map((vn) => (
                          <option key={`a-${vn}`} value={vn}>
                            v{vn}
                          </option>
                        ))}
                    </select>

                    <select
                      value={diffVB ?? ""}
                      onChange={(e) => {
                        const vv = Number(e.target.value);
                        setDiffVB(Number.isFinite(vv) ? vv : null);
                        setShowDiff(false);
                      }}
                      style={{ padding: "8px 10px", borderRadius: 10, border: `1px solid ${t.border}`, background: t.surface, color: t.text, fontWeight: 900 }}
                    >
                      <option value="">Versão B</option>
                      {versions
                        .map((x) => x.version_number)
                        .filter((x, idx, arr) => arr.indexOf(x) === idx)
                        .sort((a, b) => a - b)
                        .map((vn) => (
                          <option key={`b-${vn}`} value={vn}>
                            v{vn}
                          </option>
                        ))}
                    </select>

                    <button
                      onClick={() => setShowDiff(true)}
                      disabled={!canCompare}
                      style={{
                        padding: "9px 12px",
                        borderRadius: 10,
                        border: `1px solid ${t.btnPrimaryBg}`,
                        background: canCompare ? t.btnPrimaryBg : "var(--hdud-btn-disabled, #9aa3b2)",
                        color: "white",
                        fontWeight: 900,
                        cursor: canCompare ? "pointer" : "not-allowed",
                      }}
                    >
                      Comparar
                    </button>

                    {showDiff && (
                      <button
                        onClick={() => setShowDiff(false)}
                        style={{ padding: "9px 12px", borderRadius: 10, border: `1px solid ${t.border}`, background: t.surface, color: t.text, fontWeight: 900, cursor: "pointer" }}
                      >
                        Fechar
                      </button>
                    )}
                  </div>
                </div>

                {showDiff && (
                  <div style={{ marginTop: 12, border: `1px solid ${t.borderSoft}`, borderRadius: 12, padding: 12, background: t.surface, boxShadow: t.shadow }}>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
                      <span style={badge}>A: v{diffVA}</span>
                      <span style={badge}>B: v{diffVB}</span>
                      <span style={{ ...subtle }}>🟢 adições • 🔴 remoções • linhas iguais são omitidas</span>
                    </div>

                    {diffRows.length === 0 ? (
                      <div style={subtle}>Nenhuma diferença detectada.</div>
                    ) : (
                      <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace" }}>
                        {diffRows.map((row, idx) => {
                          const isAdd = row.t === "add";
                          const isDel = row.t === "del";
                          const color = isAdd ? t.okText : isDel ? t.errText : t.text;
                          const bg = isAdd ? t.okBg : isDel ? t.errBg : "transparent";
                          const prefix = isAdd ? "+ " : isDel ? "- " : "  ";

                          return (
                            <div key={idx} style={{ color, background: bg, padding: "2px 6px", borderRadius: 8, marginBottom: 4, whiteSpace: "pre-wrap", lineHeight: 1.45 }}>
                              {prefix}{row.v}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}