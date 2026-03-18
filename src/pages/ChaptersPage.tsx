// C:\HDUD_DATA\hdud-web-app\src\pages\ChaptersPage.tsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiRequest, getToken, parseJwtPayload, tryMany } from "./chapters/api";
import ChaptersHeader from "./chapters/components/ChaptersHeader";
import ChapterEditorCard from "./chapters/components/ChapterEditorCard";
import ChaptersList from "./chapters/components/ChaptersList";
import ChaptersMoments from "./chapters/components/ChaptersMoments";
import MemoryPickerModal from "./chapters/components/MemoryPickerModal";
import MoveMemoryModal from "./chapters/components/MoveMemoryModal";
import { buildChaptersPageUI } from "./chapters/styles";
import type {
  ApiChapterDetail,
  ApiChapterListItem,
  ApiChapterMemoriesResponse,
  ApiMemoriesAliasResponse,
  ChapterMemoryItem,
  ChapterStatus,
  MoveLinkState,
  Snapshot,
  SortKey,
  StatusFilter,
  Toast,
} from "./chapters/types";
import {
  buildEffectiveOrders,
  consumeOpenChapterHint,
  DEFAULT_NEW_DESCRIPTION,
  DEFAULT_NEW_TITLE,
  diffDirty,
  daysAgoLabel,
  extractErrMsg,
  extractLinkedChapterIdFromConflict,
  formatAttempts,
  formatDateBR,
  greetingPTBR,
  isConflictAlreadyLinked,
  normDesc,
  normSnap,
  normText,
  normTitle,
  safeTrimOrNull,
  sortChapterMemoriesNarrative,
  toStatus,
  unwrapDetail,
  unwrapList,
} from "./chapters/utils";

const HDUD_DASHBOARD_CHAPTER_DRAFT_KEY = "hdud_dashboard_chapter_draft";
const HDUD_GARDEN_CHAPTER_DRAFT_KEY = "hdud_garden_chapter_draft";

type DashboardDraftMemory = {
  memory_id: number;
  title: string;
  preview: string;
  atIso: string | null;
  chapter_id: number | null;
};

type DashboardChapterDraft = {
  source: "dashboard" | "garden";
  created_at: string;
  title: string;
  description: string;
  body: string;
  memoryIds: number[];
  memories: DashboardDraftMemory[];
};

type AiChapterSuggestionData = {
  chapter_title_suggestion: string | null;
  chapter_summary: string | null;
  themes: string[];
  sections: string[];
  emotional_arc: string[];
  confidence_score: number | null;
};

type AiChapterSuggestionMeta = {
  suggestion_status?: string | null;
  source_memory_count?: number | null;
  source_snapshot?: any;
  provider?: string | null;
  model?: string | null;
  prompt_version?: string | null;
  tokens_input?: number | null;
  tokens_output?: number | null;
  created_at?: string | null;
  applied_at?: string | null;
  discarded_at?: string | null;
  generated_at?: string | null;
};

type AiChapterSuggestion = {
  ok: boolean;
  status: number;
  chapter_id: number;
  suggestion_id: number | null;
  data: AiChapterSuggestionData;
  meta: AiChapterSuggestionMeta;
};

type ApplyScope = "title" | "summary" | "all";

type AiApplyResponse = {
  ok: boolean;
  applied: boolean;
  code?: string | null;
  message?: string | null;
  chapter_id: number;
  suggestion_id: number;
  apply_scope: ApplyScope;
  chapter_version_id: number | null;
  chapter?: {
    chapter_id: number;
    title: string;
    description: string | null;
    body: string;
  } | null;
  suggestion?: {
    suggestion_id: number;
    suggestion_status?: string | null;
    applied_at?: string | null;
  } | null;
  changes?: {
    title_changed: boolean;
    body_changed: boolean;
  } | null;
};

function normalizeAiSuggestion(raw: any): AiChapterSuggestion | null {
  if (!raw || typeof raw !== "object") return null;

  const data = raw.data && typeof raw.data === "object" ? raw.data : {};
  const meta = raw.meta && typeof raw.meta === "object" ? raw.meta : {};

  return {
    ok: !!raw.ok,
    status: Number(raw.status ?? 200),
    chapter_id: Number(raw.chapter_id ?? 0),
    suggestion_id:
      raw.suggestion_id != null && Number.isFinite(Number(raw.suggestion_id))
        ? Number(raw.suggestion_id)
        : null,
    data: {
      chapter_title_suggestion:
        data.chapter_title_suggestion != null ? String(data.chapter_title_suggestion) : null,
      chapter_summary: data.chapter_summary != null ? String(data.chapter_summary) : null,
      themes: Array.isArray(data.themes) ? data.themes.map((x: any) => String(x)) : [],
      sections: Array.isArray(data.sections) ? data.sections.map((x: any) => String(x)) : [],
      emotional_arc: Array.isArray(data.emotional_arc)
        ? data.emotional_arc.map((x: any) => String(x))
        : [],
      confidence_score:
        data.confidence_score != null && Number.isFinite(Number(data.confidence_score))
          ? Number(data.confidence_score)
          : null,
    },
    meta: {
      suggestion_status:
        meta.suggestion_status != null ? String(meta.suggestion_status) : null,
      source_memory_count:
        meta.source_memory_count != null && Number.isFinite(Number(meta.source_memory_count))
          ? Number(meta.source_memory_count)
          : null,
      source_snapshot: meta.source_snapshot ?? null,
      provider: meta.provider != null ? String(meta.provider) : null,
      model: meta.model != null ? String(meta.model) : null,
      prompt_version: meta.prompt_version != null ? String(meta.prompt_version) : null,
      tokens_input:
        meta.tokens_input != null && Number.isFinite(Number(meta.tokens_input))
          ? Number(meta.tokens_input)
          : null,
      tokens_output:
        meta.tokens_output != null && Number.isFinite(Number(meta.tokens_output))
          ? Number(meta.tokens_output)
          : null,
      created_at: meta.created_at != null ? String(meta.created_at) : null,
      applied_at: meta.applied_at != null ? String(meta.applied_at) : null,
      discarded_at: meta.discarded_at != null ? String(meta.discarded_at) : null,
      generated_at: meta.generated_at != null ? String(meta.generated_at) : null,
    },
  };
}

function consumeDashboardDraft(): DashboardChapterDraft | null {
  try {
    const keys = [HDUD_GARDEN_CHAPTER_DRAFT_KEY, HDUD_DASHBOARD_CHAPTER_DRAFT_KEY];

    let raw: string | null = null;
    let usedKey: string | null = null;

    for (const key of keys) {
      const value = sessionStorage.getItem(key);
      if (value) {
        raw = value;
        usedKey = key;
        break;
      }
    }

    if (!raw) return null;

    keys.forEach((key) => sessionStorage.removeItem(key));

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const memories = Array.isArray(parsed.memories)
      ? parsed.memories
          .map((m: any) => ({
            memory_id: Number(m?.memory_id),
            title: String(m?.title ?? "").trim() || "Memória sem título",
            preview: String(m?.preview ?? "").trim(),
            atIso: m?.atIso != null ? String(m.atIso) : null,
            chapter_id:
              m?.chapter_id != null && Number.isFinite(Number(m.chapter_id))
                ? Number(m.chapter_id)
                : null,
          }))
          .filter((m: DashboardDraftMemory) => Number.isFinite(m.memory_id) && m.memory_id > 0)
      : [];

    const source =
      parsed?.source === "garden" || usedKey === HDUD_GARDEN_CHAPTER_DRAFT_KEY
        ? "garden"
        : "dashboard";

    return {
      source,
      created_at: parsed?.created_at ? String(parsed.created_at) : new Date().toISOString(),
      title: String(parsed?.title ?? "").trim() || DEFAULT_NEW_TITLE,
      description: String(parsed?.description ?? "").trim() || DEFAULT_NEW_DESCRIPTION,
      body: String(parsed?.body ?? ""),
      memoryIds:
        Array.isArray(parsed?.memoryIds) && parsed.memoryIds.length
          ? parsed.memoryIds
              .map((x: any) => Number(x))
              .filter((x: number) => Number.isFinite(x) && x > 0)
          : memories.map((m: DashboardDraftMemory) => m.memory_id),
      memories,
    };
  } catch {
    return null;
  }
}

export default function ChaptersPage() {
  const token = getToken();
  const canUseApi = !!token;
  const ui = useMemo(() => buildChaptersPageUI(), []);

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

  const pendingOpenChapterIdRef = useRef<number | null>(consumeOpenChapterHint());

  const listSeqRef = useRef(0);
  const detailSeqRef = useRef(0);

  const snapshotRef = useRef<Snapshot | null>(null);

  const [chapterMemories, setChapterMemories] = useState<ChapterMemoryItem[]>([]);
  const [loadingMemories, setLoadingMemories] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQ, setPickerQ] = useState("");
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerItems, setPickerItems] = useState<ChapterMemoryItem[]>([]);

  const [linkedElsewhereMap, setLinkedElsewhereMap] = useState<Record<number, number>>({});
  const [moveLink, setMoveLink] = useState<MoveLinkState>(null);

  const [aiSuggestion, setAiSuggestion] = useState<AiChapterSuggestion | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiLoadedOnce, setAiLoadedOnce] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiApplyingScope, setAiApplyingScope] = useState<ApplyScope | null>(null);

  const [pendingDashboardDraftMemories, setPendingDashboardDraftMemories] = useState<
    DashboardDraftMemory[]
  >([]);

  const isDirty = useMemo(() => {
    if (loading || saving) return false;
    const snap = snapshotRef.current;
    if (!snap) return false;

    const a: Snapshot = {
      title: normTitle(title),
      description: normDesc(description),
      body: normText(body),
      status,
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
      status,
    };
    const b = normSnap(snap);
    const diffs = diffDirty(cur, b);
    return diffs.length ? diffs.join(" | ") : "OK (no diffs)";
  }, [title, description, body, status]);

  const aiCardStyle = useMemo<React.CSSProperties>(
    () => ({
      marginTop: 18,
      position: "relative",
      borderRadius: 18,
      border: "1px solid rgba(15,23,42,0.08)",
      background:
        "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(250,248,242,0.98) 100%)",
      boxShadow: "0 10px 24px rgba(15,23,42,0.08)",
      padding: 20,
      overflow: "hidden",
    }),
    []
  );

  const aiGlowStyle = useMemo<React.CSSProperties>(
    () => ({
      position: "absolute",
      inset: -60,
      background:
        "radial-gradient(circle at top right, rgba(34,197,94,0.08), transparent 26%), radial-gradient(circle at left center, rgba(59,130,246,0.06), transparent 24%)",
      pointerEvents: "none",
    }),
    []
  );

  const aiMutedStyle = useMemo<React.CSSProperties>(
    () => ({
      color: "rgba(15,23,42,0.68)",
      fontSize: 13,
      lineHeight: 1.45,
    }),
    []
  );

  function setToastAuto(t: Toast | null, ms = 3500) {
    setToast(t);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    if (t) toastTimer.current = setTimeout(() => setToast(null), ms);
  }

  function setApiInfo(label: string, usedPath: string, attempts: Array<{ path: string; status: number; ok: boolean }>) {
    const a = formatAttempts(attempts);
    setLastApiInfo(`${label}: ${usedPath}${a ? ` | tentativas: ${a}` : ""}`);
  }

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

  function resetAiSuggestionState() {
    setAiSuggestion(null);
    setAiError(null);
    setAiLoading(false);
    setAiLoadedOnce(false);
    setAiApplyingScope(null);
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

    setChapterMemories([]);
    setPickerOpen(false);
    setPickerQ("");
    setPickerItems([]);
    setMoveLink(null);
    setPendingDashboardDraftMemories([]);
    resetAiSuggestionState();
  }

  function openLocalNewDraft(preset?: { title: string; description?: string | null; body?: string | null }) {
    if (!confirmIfDirty("Criar novo capítulo")) return;

    setSelectedChapterId(null);
    setOpenChapterId(null);
    setIsNewUnsaved(true);

    const nextTitle = preset?.title ?? DEFAULT_NEW_TITLE;
    const nextDescription = String(preset?.description ?? DEFAULT_NEW_DESCRIPTION);
    const nextBody = String(preset?.body ?? "");

    setTitle(nextTitle);
    setDescription(nextDescription);
    setBody(nextBody);
    setStatus("DRAFT");
    setVersionLabel("v1");
    setCreatedAt("—");
    setUpdatedAt("—");
    setPublishedAt("—");

    snapshotRef.current = normSnap({
      title: nextTitle,
      description: nextDescription,
      body: nextBody,
      status: "DRAFT",
    });

    didFocusTitle.current = false;

    setChapterMemories([]);
    setPickerOpen(false);
    setPickerQ("");
    setPickerItems([]);
    setMoveLink(null);
    resetAiSuggestionState();

    goEditMode();
  }

  function openDashboardDraftInEditor(draft: DashboardChapterDraft) {
    openLocalNewDraft({
      title: draft.title || DEFAULT_NEW_TITLE,
      description: draft.description || DEFAULT_NEW_DESCRIPTION,
      body: draft.body || "",
    });

    setPendingDashboardDraftMemories(draft.memories || []);
    setToastAuto(
      {
        kind: "ok",
        msg:
          draft.source === "garden"
            ? "Draft colhido do Jardim. Revise, edite e salve apenas se gostar."
            : "Prévia editorial carregada. Revise, edite e salve apenas se gostar.",
      },
      4200
    );
  }

  async function attachPendingDraftMemoriesToChapter(chapterId: number) {
    if (!chapterId || !pendingDashboardDraftMemories.length) {
      return {
        linkedCount: 0,
        alreadyLinkedCount: 0,
        blockedCount: 0,
      };
    }

    let linkedCount = 0;
    let alreadyLinkedCount = 0;
    let blockedCount = 0;

    for (const memory of pendingDashboardDraftMemories) {
      const result = await tryMany<any>([
        () =>
          apiRequest<any>(`/api/chapters/${chapterId}/memories/${memory.memory_id}`, {
            method: "POST",
          }),
      ]);

      if (result.ok) {
        const alreadyLinked = !!(result.data as any)?.already_linked;
        if (alreadyLinked) alreadyLinkedCount += 1;
        else linkedCount += 1;
        continue;
      }

      if (isConflictAlreadyLinked(result.status, result.data)) {
        blockedCount += 1;
        continue;
      }

      const hint = result.status ? `HTTP ${result.status}` : "erro";
      const msg = extractErrMsg(result.data);
      throw new Error(
        `Falha ao vincular memória ${memory.memory_id} ao capítulo (${hint})${msg ? ` — ${msg}` : ""}.`
      );
    }

    setPendingDashboardDraftMemories([]);

    return {
      linkedCount,
      alreadyLinkedCount,
      blockedCount,
    };
  }

  async function loadLatestAiSuggestion(chapterId: number) {
    if (!chapterId || !Number.isFinite(chapterId)) return;

    setAiLoading(true);
    setAiError(null);

    try {
      const result = await tryMany<any>([
        () => apiRequest<any>(`/api/chapters/${chapterId}/suggestions/latest`, { method: "GET" }),
      ]);

      setApiInfo("AI_SUGGESTION_LATEST", result.usedPath || "—", result.attempts);

      if (!result.ok || !result.data) {
        if (result.status === 404) {
          setAiSuggestion(null);
          setAiLoadedOnce(true);
          setAiError(null);
          return;
        }

        const hint = result.status ? `HTTP ${result.status}` : "erro";
        const msg = extractErrMsg(result.data);
        setAiSuggestion(null);
        setAiLoadedOnce(true);
        setAiError(`Não consegui carregar a última sugestão (${hint})${msg ? ` — ${msg}` : ""}.`);
        return;
      }

      const normalized = normalizeAiSuggestion(result.data);
      setAiSuggestion(normalized);
      setAiLoadedOnce(true);
      setAiError(null);
    } finally {
      setAiLoading(false);
    }
  }

  async function suggestChapterWithAi(regenerate = false) {
    if (needAuthGuard()) return;
    if (isNewUnsaved || !openChapterId) {
      setToastAuto({ kind: "warn", msg: "Salve/crie o capítulo primeiro para usar a sugestão com IA." });
      return;
    }

    setAiLoading(true);
    setAiError(null);

    try {
      const payload = {
        mode: "summary",
        regenerate,
        options: {
          language: "pt-BR",
          tone: "autobiografico",
          max_sections: 6,
          max_themes: 5,
        },
      };

      const result = await tryMany<any>([
        () =>
          apiRequest<any>(`/api/chapters/${openChapterId}/suggest`, {
            method: "POST",
            body: JSON.stringify(payload),
          }),
      ]);

      setApiInfo("AI_SUGGEST", result.usedPath || "—", result.attempts);

      if (!result.ok || !result.data) {
        const hint = result.status ? `HTTP ${result.status}` : "erro";
        const msg = extractErrMsg(result.data);
        const text = `Falha ao gerar sugestão com IA (${hint})${msg ? ` — ${msg}` : ""}.`;

        setAiError(text);
        setAiLoadedOnce(true);
        setToastAuto({ kind: "err", msg: text }, 4800);
        return;
      }

      const normalized = normalizeAiSuggestion(result.data);
      setAiSuggestion(normalized);
      setAiLoadedOnce(true);
      setAiError(null);

      setToastAuto({
        kind: "ok",
        msg: regenerate ? "Sugestão editorial regenerada." : "Sugestão editorial gerada com IA.",
      });
    } finally {
      setAiLoading(false);
    }
  }

  async function applyAiSuggestion(scope: ApplyScope) {
    if (needAuthGuard()) return;
    if (isNewUnsaved || !openChapterId) {
      setToastAuto({ kind: "warn", msg: "Salve/crie o capítulo primeiro para aplicar a sugestão." });
      return;
    }

    const suggestionId = Number(aiSuggestion?.suggestion_id ?? 0);
    if (!Number.isFinite(suggestionId) || suggestionId <= 0) {
      setToastAuto({ kind: "warn", msg: "Nenhuma sugestão válida encontrada para aplicar." });
      return;
    }

    if (!confirmIfDirty("Aplicar sugestão da IA")) return;

    setAiApplyingScope(scope);
    setAiError(null);

    try {
      const payload = {
        apply_scope: scope,
      };

      const result = await tryMany<AiApplyResponse | any>([
        () =>
          apiRequest<any>(`/api/chapters/${openChapterId}/suggestions/${suggestionId}/apply`, {
            method: "POST",
            body: JSON.stringify(payload),
          }),
      ]);

      setApiInfo("AI_APPLY", result.usedPath || "—", result.attempts);

      if (!result.ok || !result.data) {
        const hint = result.status ? `HTTP ${result.status}` : "erro";
        const msg = extractErrMsg(result.data);
        const text = `Falha ao aplicar sugestão com IA (${hint})${msg ? ` — ${msg}` : ""}.`;
        setAiError(text);
        setToastAuto({ kind: "err", msg: text }, 4800);
        return;
      }

      const response = result.data as AiApplyResponse;
      const chapterPayload = response?.chapter ?? null;

      if (chapterPayload) {
        const nextTitle = String(chapterPayload.title ?? "");
        const nextDescription = String(chapterPayload.description ?? "");
        const nextBody = normText(chapterPayload.body ?? "");

        setTitle(nextTitle);
        setDescription(nextDescription);
        setBody(nextBody);

        snapshotRef.current = normSnap({
          title: nextTitle,
          description: nextDescription,
          body: nextBody,
          status,
        });
      }

      if (response?.chapter_version_id != null && Number.isFinite(Number(response.chapter_version_id))) {
        setVersionLabel(`v${Number(response.chapter_version_id)}`);
      }

      setAiSuggestion((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          meta: {
            ...prev.meta,
            suggestion_status:
              response?.suggestion?.suggestion_status ??
              (response?.applied ? "applied" : prev.meta?.suggestion_status ?? null),
            applied_at:
              response?.suggestion?.applied_at ??
              (response?.applied ? new Date().toISOString() : prev.meta?.applied_at ?? null),
          },
        };
      });

      if (response?.applied === false && response?.code === "NO_CHANGES_TO_APPLY") {
        setToastAuto({
          kind: "warn",
          msg: "Nada novo para aplicar. O capítulo já está alinhado com essa sugestão.",
        });
      } else if (response?.applied) {
        const label =
          scope === "title"
            ? "Título aplicado com sucesso."
            : scope === "summary"
            ? "Resumo aplicado com sucesso."
            : "Título e resumo aplicados com sucesso.";

        setToastAuto({ kind: "ok", msg: label });
      } else {
        setToastAuto({
          kind: "warn",
          msg: response?.message || "A operação foi concluída, mas não houve alteração editorial.",
        });
      }

      await loadList();
      await loadDetail(openChapterId);
    } finally {
      setAiApplyingScope(null);
    }
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

        const msg = extractErrMsg(result.data);
        setToastAuto({ kind: "err", msg: `Falha ao carregar capítulos (${hint})${msg ? ` — ${msg}` : ""}.` });
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
        }
        pendingOpenChapterIdRef.current = null;
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
        const hint =
          result.status === 401 ? "401" : result.status === 404 ? "404" : result.status ? `HTTP ${result.status}` : "erro";
        const msg = extractErrMsg(result.data);
        setToastAuto(
          { kind: "warn", msg: `Não consegui carregar as memórias vinculadas deste capítulo (${hint})${msg ? ` — ${msg}` : ""}.` },
          3200
        );
        setChapterMemories([]);
        return;
      }

      const rawItems = Array.isArray((result.data as any).items) ? (result.data as any).items : [];
      const normalized: ChapterMemoryItem[] = rawItems
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
          sort_order: m.sort_order != null && Number.isFinite(Number(m.sort_order)) ? Number(m.sort_order) : null,
          linked_at: m.linked_at ?? m.linkedAt ?? null,
        }))
        .filter((x) => Number.isFinite(x.memory_id) && x.memory_id > 0);

      setChapterMemories(sortChapterMemoriesNarrative(normalized));
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
        const msg = extractErrMsg(result.data);
        setToastAuto({ kind: "err", msg: `Falha ao abrir capítulo (${hint})${msg ? ` — ${msg}` : ""}.` });
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
      setPendingDashboardDraftMemories([]);

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

      await loadChapterMemories(chapterId);
      await loadLatestAiSuggestion(chapterId);
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
    ]);

    setApiInfo("CREATE", result.usedPath || "—", result.attempts);

    if (!result.ok) {
      const hint =
        result.status === 401
          ? "401 (token expirado). Faça login novamente."
          : result.status === 404
          ? "404 (rota de criação não existe no backend)."
          : `HTTP ${result.status || "erro"}`;

      const msg = extractErrMsg(result.data);
      setToastAuto({ kind: "err", msg: `Erro ao criar capítulo (${hint})${msg ? ` — ${msg}` : ""}.` });
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
      const msg = extractErrMsg(result.data);
      setToastAuto({ kind: "err", msg: `Falha ao salvar (${hint})${msg ? ` — ${msg}` : ""}.` });
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

  async function publishExisting(chapterId: number) {
    const result = await tryMany<any>([
      () => apiRequest<any>(`/api/chapters/${chapterId}/publish`, { method: "POST" }),
    ]);

    setApiInfo("PUBLISH", result.usedPath || "—", result.attempts);

    if (!result.ok) {
      const hint =
        result.status === 401 ? "401 (token expirado)." : result.status === 404 ? "404 (rota não existe)." : `HTTP ${result.status || "erro"}`;
      const msg = extractErrMsg(result.data);
      setToastAuto({ kind: "err", msg: `Falha ao publicar (${hint})${msg ? ` — ${msg}` : ""}.` });
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
      const msg = extractErrMsg(result.data);
      setToastAuto({ kind: "err", msg: `Falha ao despublicar (${hint})${msg ? ` — ${msg}` : ""}.` });
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

        const linkSummary = await attachPendingDraftMemoriesToChapter(cid);

        setIsNewUnsaved(false);
        setOpenChapterId(cid);
        setSelectedChapterId(cid);

        snapshotRef.current = normSnap({
          title: normTitle(title),
          description: normDesc(description),
          body: normText(body),
          status: "DRAFT",
        });

        if (
          linkSummary.linkedCount > 0 ||
          linkSummary.alreadyLinkedCount > 0 ||
          linkSummary.blockedCount > 0
        ) {
          setToastAuto({
            kind: linkSummary.blockedCount > 0 ? "warn" : "ok",
            msg:
              `Capítulo salvo (criado). ` +
              `${linkSummary.linkedCount} vínculo(s) novo(s), ` +
              `${linkSummary.alreadyLinkedCount} já existente(s), ` +
              `${linkSummary.blockedCount} bloqueado(s).`,
          }, 4600);
        } else {
          setToastAuto({ kind: "ok", msg: "Capítulo salvo (criado)." });
        }

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

        const linkSummary = await attachPendingDraftMemoriesToChapter(cid);

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

        if (
          linkSummary.linkedCount > 0 ||
          linkSummary.alreadyLinkedCount > 0 ||
          linkSummary.blockedCount > 0
        ) {
          setToastAuto({
            kind: linkSummary.blockedCount > 0 ? "warn" : "ok",
            msg:
              `Publicado. ` +
              `${linkSummary.linkedCount} vínculo(s) novo(s), ` +
              `${linkSummary.alreadyLinkedCount} já existente(s), ` +
              `${linkSummary.blockedCount} bloqueado(s).`,
          }, 4600);
        } else {
          setToastAuto({ kind: "ok", msg: "Publicado." });
        }

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

  async function openPicker() {
    if (isNewUnsaved || !openChapterId) {
      setToastAuto({ kind: "warn", msg: "Salve/crie o capítulo primeiro para vincular memórias." });
      return;
    }

    setLinkedElsewhereMap({});
    setMoveLink(null);

    setPickerOpen(true);
    setPickerQ("");
    setPickerLoading(true);

    try {
      const result = await tryMany<ApiMemoriesAliasResponse | any>([
        () => apiRequest<any>(`/api/memories`, { method: "GET" }),
      ]);

      setApiInfo("PICKER_MEMORIES", result.usedPath || "—", result.attempts);

      if (!result.ok || !result.data) {
        const hint = result.status ? `HTTP ${result.status}` : "erro";
        const msg = extractErrMsg(result.data);
        setToastAuto({ kind: "warn", msg: `Não consegui carregar o inventário de memórias (${hint})${msg ? ` — ${msg}` : ""}.` });
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

  async function doMoveMemory(fromChapterId: number, toChapterId: number, memoryId: number) {
    setSaving(true);
    try {
      const move = await tryMany<any>([
        () => apiRequest<any>(`/api/chapters/${toChapterId}/memories/${memoryId}/move`, { method: "POST" }),
      ]);

      setApiInfo("MOVE_MEMORY", move.usedPath || "—", move.attempts);

      if (!move.ok) {
        const hint = move.status ? `HTTP ${move.status}` : "erro";
        const msg = extractErrMsg(move.data);

        setToastAuto({
          kind: "err",
          msg: `Falha ao mover memória (${hint})${msg ? ` — ${msg}` : ""}.`,
        });

        return false;
      }

      setLinkedElsewhereMap((prev) => {
        const next = { ...prev };
        delete next[memoryId];
        return next;
      });

      setMoveLink(null);

      setToastAuto({
        kind: "ok",
        msg: "Memória movida com sucesso.",
      });

      await loadChapterMemories(toChapterId);
      return true;
    } finally {
      setSaving(false);
    }
  }

  async function linkMemory(memoryId: number, memoryTitle?: string | null) {
    if (!openChapterId) return;

    setSaving(true);
    try {
      const result = await tryMany<any>([
        () => apiRequest<any>(`/api/chapters/${openChapterId}/memories/${memoryId}`, { method: "POST" }),
      ]);

      setApiInfo("LINK_MEMORY", result.usedPath || "—", result.attempts);

      if (!result.ok) {
        if (isConflictAlreadyLinked(result.status, result.data)) {
          const fromId = extractLinkedChapterIdFromConflict(result.data);

          if (fromId && fromId !== openChapterId) {
            setLinkedElsewhereMap((prev) => ({ ...prev, [memoryId]: fromId }));
            setPickerOpen(true);
            setMoveLink({
              open: true,
              memory_id: memoryId,
              from_chapter_id: fromId,
              to_chapter_id: openChapterId,
              title: memoryTitle ?? null,
            });
            return;
          }

          if (fromId && fromId === openChapterId) {
            setToastAuto({ kind: "warn", msg: "Essa memória já está vinculada a este capítulo." }, 4200);
            return;
          }

          setToastAuto(
            {
              kind: "warn",
              msg: "Essa memória já está vinculada, mas o backend não retornou current_chapter_id (409).",
            },
            5200
          );
          return;
        }

        const hint = result.status ? `HTTP ${result.status}` : "erro";
        const msg = extractErrMsg(result.data);
        setToastAuto({ kind: "err", msg: `Falha ao vincular memória ao capítulo (${hint})${msg ? ` — ${msg}` : ""}.` });
        return;
      }

      const alreadyLinked = !!(result.data as any)?.already_linked;
      if (alreadyLinked) {
        setToastAuto({ kind: "warn", msg: "Essa memória já está vinculada a este capítulo." }, 3200);
        return;
      }

      setToastAuto({ kind: "ok", msg: "Memória vinculada." });
      setMoveLink(null);
      setLinkedElsewhereMap((prev) => {
        const next = { ...prev };
        delete next[memoryId];
        return next;
      });
      setPickerOpen(false);
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
        const hint = result.status ? `HTTP ${result.status}` : "erro";
        const msg = extractErrMsg(result.data);
        setToastAuto({ kind: "err", msg: `Falha ao remover vínculo da memória (${hint})${msg ? ` — ${msg}` : ""}.` });
        return;
      }

      setToastAuto({ kind: "ok", msg: "Vínculo removido." });
      await loadChapterMemories(openChapterId);
    } finally {
      setSaving(false);
    }
  }

  async function setMemoryOrder(chapterId: number, memoryId: number, sortOrder: number) {
    const payload = { sort_order: sortOrder };

    const result = await tryMany<any>([
      () => apiRequest<any>(`/api/chapters/${chapterId}/memories/${memoryId}/order`, { method: "PUT", body: JSON.stringify(payload) }),
    ]);

    setApiInfo("ORDER_MEMORY", result.usedPath || "—", result.attempts);

    if (!result.ok) {
      const hint = result.status ? `HTTP ${result.status}` : "erro";
      const msg = extractErrMsg(result.data);
      setToastAuto({ kind: "err", msg: `Falha ao reordenar (${hint})${msg ? ` — ${msg}` : ""}.` });
      return false;
    }

    return true;
  }

  async function moveMemory(memoryId: number, dir: -1 | 1) {
    if (!openChapterId) return;
    if (saving || loading || loadingMemories) return;

    const withEff = buildEffectiveOrders(chapterMemories) as any[];
    const idx = withEff.findIndex((x) => x.memory_id === memoryId);
    if (idx < 0) return;

    const j = idx + dir;
    if (j < 0 || j >= withEff.length) return;

    const a = withEff[idx];
    const b = withEff[j];

    const ao = Number(a._eff);
    const bo = Number(b._eff);

    setSaving(true);
    try {
      const ok1 = await setMemoryOrder(openChapterId, a.memory_id, bo);
      if (!ok1) return;
      const ok2 = await setMemoryOrder(openChapterId, b.memory_id, ao);
      if (!ok2) return;

      await loadChapterMemories(openChapterId);
      setToastAuto({ kind: "ok", msg: "Ordem atualizada." }, 2200);
    } finally {
      setSaving(false);
    }
  }

  function goToMemoryHub(memoryId: number, mode: "view" | "edit" = "view") {
    try {
      sessionStorage.setItem("hdud_open_memory_id", String(memoryId));
      sessionStorage.setItem("hdud_memory_open_mode", mode);
    } catch {}

    try {
      window.location.assign("/memories");
    } catch {
      window.location.href = "/memories";
    }
  }

  function handleOpenMemory(memoryId: number) {
    goToMemoryHub(memoryId, "view");
  }

  function handleEditMemory(memoryId: number) {
    goToMemoryHub(memoryId, "edit");
  }

  async function handleRemoveMemory(memoryId: number) {
    const target = chapterMemories.find((m) => m.memory_id === memoryId);
    const label = target?.title?.trim() || `Memória #${memoryId}`;

    const ok = window.confirm(
      `Remover “${label}” deste capítulo?\n\nA memória continuará existindo no acervo, apenas sairá deste capítulo.`
    );

    if (!ok) return;
    await unlinkMemory(memoryId);
  }

  async function reloadSelected() {
    if (!openChapterId) return;
    if (!confirmIfDirty("Recarregar capítulo")) return;
    await loadDetail(openChapterId);
    setToastAuto({ kind: "ok", msg: "Capítulo recarregado." });
  }

  function renderPendingDashboardDraftCard() {
    if (mode !== "edit" || !isNewUnsaved || !pendingDashboardDraftMemories.length) return null;

    return (
      <div
        style={{
          marginTop: 18,
          borderRadius: 18,
          border: "1px solid rgba(15,23,42,0.08)",
          background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(250,248,242,0.98) 100%)",
          boxShadow: "0 10px 24px rgba(15,23,42,0.08)",
          padding: 20,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.1, textTransform: "uppercase", color: "rgba(15,23,42,0.55)" }}>
          Prévia vinda do Dashboard
        </div>

        <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900, lineHeight: 1.15, color: "#0f172a" }}>
          Memórias sugeridas para este rascunho
        </div>

        <div style={{ ...aiMutedStyle, marginTop: 8 }}>
          Este capítulo ainda está local. Quando você salvar ou publicar, a HDUD criará o capítulo real e tentará vincular automaticamente as memórias abaixo.
        </div>

        <div
          style={{
            marginTop: 14,
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              borderRadius: 999,
              padding: "7px 12px",
              background: "#eef6ff",
              border: "1px solid rgba(59,130,246,0.16)",
              color: "#1d4ed8",
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            {pendingDashboardDraftMemories.length} memória(s) pendente(s)
          </span>
        </div>

        <div
          style={{
            marginTop: 16,
            display: "grid",
            gap: 10,
          }}
        >
          {pendingDashboardDraftMemories.map((m) => (
            <div
              key={`pending-draft-memory-${m.memory_id}`}
              style={{
                display: "grid",
                gap: 6,
                padding: "12px 14px",
                borderRadius: 14,
                background: "#fffefb",
                border: "1px solid rgba(15,23,42,0.08)",
              }}
            >
              <div style={{ fontWeight: 850, color: "#0f172a" }}>
                {m.title || `Memória #${m.memory_id}`}
              </div>
              <div style={{ fontSize: 13, color: "rgba(15,23,42,0.72)", lineHeight: 1.45 }}>
                {m.preview || "Sem prévia disponível."}
              </div>
              <div style={{ fontSize: 12, color: "rgba(15,23,42,0.58)", fontWeight: 700 }}>
                {m.chapter_id ? `Já participa do capítulo #${m.chapter_id}` : "Ainda sem capítulo"}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderAiSuggestionCard() {
    if (mode !== "edit") return null;

    const hasSuggestion = !!aiSuggestion?.suggestion_id;
    const sourceCount = aiSuggestion?.meta?.source_memory_count ?? chapterMemories.length ?? 0;
    const confidence =
      aiSuggestion?.data?.confidence_score != null
        ? `${Math.round(Number(aiSuggestion.data.confidence_score) * 100)}%`
        : "—";

    const isApplyingTitle = aiApplyingScope === "title";
    const isApplyingSummary = aiApplyingScope === "summary";
    const isApplyingAll = aiApplyingScope === "all";
    const isAiBusy = aiLoading || !!aiApplyingScope || saving || loading;

    return (
      <div style={aiCardStyle}>
        <div style={aiGlowStyle} />

        <div style={{ position: "relative", zIndex: 1 }}>
          <div
            style={{
              display: "flex",
              gap: 14,
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: 1.1,
                  textTransform: "uppercase",
                  color: "rgba(15,23,42,0.55)",
                }}
              >
                Editor assistido por IA
              </div>

              <div
                style={{
                  marginTop: 4,
                  fontSize: 24,
                  fontWeight: 900,
                  lineHeight: 1.12,
                  color: "#0f172a",
                }}
              >
                ✨ Sugerir capítulo com IA
              </div>

              <div style={{ ...aiMutedStyle, marginTop: 8, maxWidth: 920 }}>
                A HDUD lê as memórias vinculadas e propõe uma síntese editorial com título,
                resumo, temas centrais e estrutura sugerida.
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={() => void suggestChapterWithAi(false)}
                disabled={isAiBusy || isNewUnsaved || !openChapterId}
                style={{
                  border: "1px solid rgba(34,197,94,0.28)",
                  background: "#16a34a",
                  color: "white",
                  borderRadius: 12,
                  padding: "10px 14px",
                  fontWeight: 800,
                  cursor: isAiBusy || isNewUnsaved || !openChapterId ? "not-allowed" : "pointer",
                  opacity: isAiBusy || isNewUnsaved || !openChapterId ? 0.72 : 1,
                  boxShadow: "0 6px 14px rgba(22,163,74,0.18)",
                }}
                title="Gerar síntese editorial do capítulo"
              >
                {aiLoading ? "Gerando…" : "✨ Sugerir capítulo com IA"}
              </button>

              <button
                type="button"
                onClick={() => void suggestChapterWithAi(true)}
                disabled={isAiBusy || isNewUnsaved || !openChapterId}
                style={{
                  border: "1px solid rgba(15,23,42,0.12)",
                  background: "#ffffff",
                  color: "#0f172a",
                  borderRadius: 12,
                  padding: "10px 14px",
                  fontWeight: 800,
                  cursor: isAiBusy || isNewUnsaved || !openChapterId ? "not-allowed" : "pointer",
                  opacity: isAiBusy || isNewUnsaved || !openChapterId ? 0.72 : 1,
                }}
                title="Gerar uma nova proposta editorial"
              >
                Gerar novamente
              </button>
            </div>
          </div>

          <div
            style={{
              marginTop: 16,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            <div
              style={{
                borderRadius: 14,
                padding: 14,
                border: "1px solid rgba(15,23,42,0.08)",
                background: "#fffdf8",
              }}
            >
              <div style={{ fontSize: 12, color: "rgba(15,23,42,0.62)", fontWeight: 700 }}>Memórias lidas</div>
              <div style={{ marginTop: 6, fontSize: 26, fontWeight: 900, color: "#0f172a" }}>{sourceCount || "—"}</div>
            </div>

            <div
              style={{
                borderRadius: 14,
                padding: 14,
                border: "1px solid rgba(15,23,42,0.08)",
                background: "#fffdf8",
              }}
            >
              <div style={{ fontSize: 12, color: "rgba(15,23,42,0.62)", fontWeight: 700 }}>Confiança editorial</div>
              <div style={{ marginTop: 6, fontSize: 26, fontWeight: 900, color: "#0f172a" }}>{confidence}</div>
            </div>
          </div>

          {aiError ? (
            <div
              style={{
                marginTop: 16,
                borderRadius: 14,
                border: "1px solid rgba(239,68,68,0.20)",
                background: "rgba(254,242,242,0.95)",
                padding: 14,
                color: "#991b1b",
                fontWeight: 700,
              }}
            >
              {aiError}
            </div>
          ) : null}

          {!aiLoading && !hasSuggestion && aiLoadedOnce && !aiError ? (
            <div
              style={{
                marginTop: 16,
                borderRadius: 14,
                border: "1px dashed rgba(15,23,42,0.14)",
                background: "#fffdfa",
                padding: 18,
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>Nenhuma sugestão gerada ainda</div>
              <div style={{ ...aiMutedStyle, marginTop: 6 }}>
                Quando você acionar a IA, a HDUD vai propor um título, um resumo narrativo,
                temas centrais e uma estrutura sugerida para este capítulo.
              </div>
            </div>
          ) : null}

          {hasSuggestion ? (
            <div
              style={{
                marginTop: 18,
                display: "grid",
                gridTemplateColumns: "minmax(0, 1.35fr) minmax(300px, 0.95fr)",
                gap: 16,
              }}
            >
              <div
                style={{
                  borderRadius: 16,
                  padding: 20,
                  border: "1px solid rgba(15,23,42,0.08)",
                  background: "#fffefb",
                }}
              >
                <div style={{ fontSize: 12, color: "rgba(15,23,42,0.62)", fontWeight: 800, textTransform: "uppercase" }}>
                  Título sugerido
                </div>

                <div
                  style={{
                    marginTop: 10,
                    fontSize: 34,
                    lineHeight: 1.08,
                    fontWeight: 950,
                    color: "#0f172a",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {aiSuggestion?.data?.chapter_title_suggestion || "—"}
                </div>

                <div
                  style={{
                    marginTop: 22,
                    fontSize: 12,
                    color: "rgba(15,23,42,0.62)",
                    fontWeight: 800,
                    textTransform: "uppercase",
                  }}
                >
                  Resumo narrativo
                </div>

                <div
                  style={{
                    marginTop: 10,
                    padding: "16px 18px",
                    borderRadius: 14,
                    background: "#fcfaf4",
                    border: "1px solid rgba(15,23,42,0.06)",
                    fontSize: 17,
                    lineHeight: 1.78,
                    color: "#1e293b",
                    whiteSpace: "pre-wrap",
                    minHeight: 180,
                  }}
                >
                  {aiSuggestion?.data?.chapter_summary || "—"}
                </div>

                <div
                  style={{
                    marginTop: 16,
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => void applyAiSuggestion("title")}
                    disabled={isAiBusy || !hasSuggestion}
                    style={{
                      border: "1px solid rgba(59,130,246,0.18)",
                      background: "#eef6ff",
                      color: "#1d4ed8",
                      borderRadius: 12,
                      padding: "10px 14px",
                      fontWeight: 800,
                      cursor: isAiBusy || !hasSuggestion ? "not-allowed" : "pointer",
                      opacity: isAiBusy || !hasSuggestion ? 0.62 : 1,
                    }}
                  >
                    {isApplyingTitle ? "Aplicando título…" : "Aplicar título"}
                  </button>

                  <button
                    type="button"
                    onClick={() => void applyAiSuggestion("summary")}
                    disabled={isAiBusy || !hasSuggestion}
                    style={{
                      border: "1px solid rgba(16,185,129,0.18)",
                      background: "#ecfdf5",
                      color: "#047857",
                      borderRadius: 12,
                      padding: "10px 14px",
                      fontWeight: 800,
                      cursor: isAiBusy || !hasSuggestion ? "not-allowed" : "pointer",
                      opacity: isAiBusy || !hasSuggestion ? 0.62 : 1,
                    }}
                  >
                    {isApplyingSummary ? "Aplicando resumo…" : "Aplicar resumo"}
                  </button>

                  <button
                    type="button"
                    onClick={() => void applyAiSuggestion("all")}
                    disabled={isAiBusy || !hasSuggestion}
                    style={{
                      border: "1px solid rgba(109,40,217,0.16)",
                      background: "#f5f3ff",
                      color: "#6d28d9",
                      borderRadius: 12,
                      padding: "10px 14px",
                      fontWeight: 800,
                      cursor: isAiBusy || !hasSuggestion ? "not-allowed" : "pointer",
                      opacity: isAiBusy || !hasSuggestion ? 0.62 : 1,
                    }}
                  >
                    {isApplyingAll ? "Aplicando tudo…" : "Aplicar tudo"}
                  </button>
                </div>

                {(aiSuggestion?.meta?.created_at || aiSuggestion?.meta?.generated_at) && (
                  <div
                    style={{
                      marginTop: 14,
                      display: "flex",
                      gap: 12,
                      flexWrap: "wrap",
                      color: "rgba(15,23,42,0.62)",
                      fontSize: 12,
                      lineHeight: 1.45,
                    }}
                  >
                    <span>
                      Gerado em{" "}
                      {formatDateBR(aiSuggestion?.meta?.created_at ?? aiSuggestion?.meta?.generated_at ?? null)}
                    </span>
                    <span>•</span>
                    <span>Modelo: {aiSuggestion?.meta?.model || "—"}</span>
                    <span>•</span>
                    <span>Prompt: {aiSuggestion?.meta?.prompt_version || "—"}</span>
                    {aiSuggestion?.meta?.suggestion_status ? (
                      <>
                        <span>•</span>
                        <span>Status: {aiSuggestion.meta.suggestion_status}</span>
                      </>
                    ) : null}
                    {aiSuggestion?.meta?.applied_at ? (
                      <>
                        <span>•</span>
                        <span>Aplicado em {formatDateBR(aiSuggestion.meta.applied_at)}</span>
                      </>
                    ) : null}
                  </div>
                )}
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 16,
                }}
              >
                <div
                  style={{
                    borderRadius: 16,
                    padding: 18,
                    border: "1px solid rgba(15,23,42,0.08)",
                    background: "#fffefb",
                  }}
                >
                  <div style={{ fontSize: 12, color: "rgba(15,23,42,0.62)", fontWeight: 800, textTransform: "uppercase" }}>
                    Temas centrais
                  </div>

                  <div
                    style={{
                      marginTop: 12,
                      display: "flex",
                      gap: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    {aiSuggestion?.data?.themes?.length ? (
                      aiSuggestion.data.themes.map((theme, idx) => (
                        <span
                          key={`${theme}-${idx}`}
                          style={{
                            borderRadius: 999,
                            padding: "7px 12px",
                            background: "#eef6ff",
                            border: "1px solid rgba(59,130,246,0.16)",
                            color: "#1d4ed8",
                            fontSize: 13,
                            fontWeight: 800,
                          }}
                        >
                          {theme}
                        </span>
                      ))
                    ) : (
                      <span style={aiMutedStyle}>Sem temas identificados.</span>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    borderRadius: 16,
                    padding: 18,
                    border: "1px solid rgba(15,23,42,0.08)",
                    background: "#fffefb",
                  }}
                >
                  <div style={{ fontSize: 12, color: "rgba(15,23,42,0.62)", fontWeight: 800, textTransform: "uppercase" }}>
                    Estrutura sugerida
                  </div>

                  <div
                    style={{
                      marginTop: 12,
                      display: "grid",
                      gap: 10,
                    }}
                  >
                    {aiSuggestion?.data?.sections?.length ? (
                      aiSuggestion.data.sections.map((section, idx) => (
                        <div
                          key={`${section}-${idx}`}
                          style={{
                            display: "flex",
                            gap: 10,
                            alignItems: "flex-start",
                            padding: "10px 12px",
                            borderRadius: 12,
                            background: "#f8fafc",
                            border: "1px solid rgba(15,23,42,0.08)",
                          }}
                        >
                          <div
                            style={{
                              width: 24,
                              height: 24,
                              minWidth: 24,
                              borderRadius: 999,
                              display: "grid",
                              placeItems: "center",
                              background: "#ede9fe",
                              color: "#6d28d9",
                              fontSize: 12,
                              fontWeight: 900,
                            }}
                          >
                            {idx + 1}
                          </div>
                          <div style={{ lineHeight: 1.45, fontWeight: 700, color: "#0f172a" }}>{section}</div>
                        </div>
                      ))
                    ) : (
                      <span style={aiMutedStyle}>Sem seções sugeridas.</span>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    borderRadius: 16,
                    padding: 18,
                    border: "1px solid rgba(15,23,42,0.08)",
                    background: "#fffefb",
                  }}
                >
                  <div style={{ fontSize: 12, color: "rgba(15,23,42,0.62)", fontWeight: 800, textTransform: "uppercase" }}>
                    Arco emocional
                  </div>

                  <div
                    style={{
                      marginTop: 12,
                      display: "flex",
                      gap: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    {aiSuggestion?.data?.emotional_arc?.length ? (
                      aiSuggestion.data.emotional_arc.map((item, idx) => (
                        <span
                          key={`${item}-${idx}`}
                          style={{
                            borderRadius: 999,
                            padding: "7px 12px",
                            background: "#f5f3ff",
                            border: "1px solid rgba(109,40,217,0.14)",
                            color: "#6d28d9",
                            fontSize: 13,
                            fontWeight: 800,
                          }}
                        >
                          {item}
                        </span>
                      ))
                    ) : (
                      <span style={aiMutedStyle}>Sem arco emocional detectado.</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
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

  useEffect(() => {
    if (!canUseApi) {
      setToastAuto({ kind: "warn", msg: "Token ausente. Faça login para ver/editar capítulos." });
      return;
    }

    const draft = consumeDashboardDraft();
    if (draft) {
      openDashboardDraftInEditor(draft);
      return;
    }

    void loadList();
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

          <div style={{ marginTop: 10, opacity: 0.82, fontWeight: 750, position: "relative", zIndex: 1 }}>
            {microcopy}
          </div>

          {mode === "list" ? (
            <div style={ui.toolbarRow}>
              <button
                type="button"
                style={ui.btnPrimary}
                onClick={() => openLocalNewDraft()}
                disabled={loading || saving}
                title="Criar um novo capítulo (rascunho local)"
              >
                + Criar capítulo
              </button>

              <div style={ui.spacer} />

              <input
                style={{ ...ui.input, width: 280 }}
                placeholder="Buscar (título, descrição ou #ID)…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />

              <select style={ui.select} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
                <option value="ALL">Status: Todos</option>
                <option value="DRAFT">Status: Rascunhos</option>
                <option value="PUBLIC">Status: Públicos</option>
              </select>

              <select style={ui.select} value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
                <option value="RECENT">Mais recentes</option>
                <option value="OLD">Mais antigos</option>
                <option value="TITLE">Título</option>
              </select>

              <button type="button" style={ui.btn} onClick={() => void loadList()} disabled={loading || saving}>
                {loading ? "Atualizando…" : "Atualizar"}
              </button>

              <button type="button" style={showDiag ? ui.btnPrimary : ui.btn} onClick={() => setShowDiag((v) => !v)} disabled={loading || saving}>
                Diagnóstico
              </button>
            </div>
          ) : null}
        </div>

        {mode === "list" ? (
          <>
            <ChaptersMoments
              ui={ui}
              latestChapter={latestChapter}
              pulseLabel={pulseLabel}
              destaque={moment.destaque}
              revisitar={moment.revisitar}
              hoverId={hoverId}
              setHoverId={setHoverId}
              confirmIfDirty={confirmIfDirty}
              onOpenChapter={(chapterId) => {
                setSelectedChapterId(chapterId);
                void loadDetail(chapterId);
              }}
            />

            <ChaptersList
              ui={ui}
              items={viewItems}
              allItemsCount={items.length}
              openChapterId={openChapterId}
              selectedChapterId={selectedChapterId}
              hoverId={hoverId}
              setHoverId={setHoverId}
              confirmIfDirty={confirmIfDirty}
              onOpenChapter={(chapterId) => {
                setSelectedChapterId(chapterId);
                void loadDetail(chapterId);
              }}
              onClearFilters={() => {
                setQ("");
                setStatusFilter("ALL");
                setSortKey("RECENT");
              }}
            />
          </>
        ) : null}

        {mode === "edit" ? (
          <>
            <ChapterEditorCard
              ui={ui}
              token={token}
              authorId={authorId}
              openChapterId={openChapterId}
              isNewUnsaved={isNewUnsaved}
              versionLabel={versionLabel}
              status={status}
              chapterMemories={chapterMemories}
              loadingMemories={loadingMemories}
              createdAt={createdAt}
              updatedAt={updatedAt}
              publishedAt={publishedAt}
              toast={toast}
              showDiag={showDiag}
              lastApiInfo={lastApiInfo}
              isDirty={isDirty}
              dirtyInfo={dirtyInfo}
              loading={loading}
              saving={saving}
              title={title}
              description={description}
              body={body}
              didFocusTitle={didFocusTitle}
              onTitleChange={setTitle}
              onDescriptionChange={setDescription}
              onBodyChange={setBody}
              onOpenPicker={() => void openPicker()}
              onRefreshLinks={() => {
                if (openChapterId) void loadChapterMemories(openChapterId);
              }}
              onSaveDraft={() => void saveDraft()}
              onPublish={() => void publish()}
              onUnpublish={() => void unpublish()}
              onReloadSelected={() => void reloadSelected()}
              onGoListMode={goListMode}
              onOpenMemory={handleOpenMemory}
              onEditMemory={handleEditMemory}
              onMoveMemory={(memoryId, dir) => void moveMemory(memoryId, dir)}
              onRemoveMemory={(memoryId) => void handleRemoveMemory(memoryId)}
            />

            {renderPendingDashboardDraftCard()}
            {renderAiSuggestionCard()}
          </>
        ) : null}

        <MemoryPickerModal
          ui={ui}
          pickerOpen={pickerOpen}
          pickerQ={pickerQ}
          pickerLoading={pickerLoading}
          pickerViewItems={pickerViewItems}
          linkedIds={linkedIds}
          linkedElsewhereMap={linkedElsewhereMap}
          openChapterId={openChapterId}
          saving={saving}
          setPickerOpen={setPickerOpen}
          setPickerQ={setPickerQ}
          setMoveLink={setMoveLink}
          linkMemory={linkMemory}
        />

        <MoveMemoryModal
          ui={ui}
          moveLink={moveLink}
          saving={saving}
          openChapterId={openChapterId}
          setMoveLink={setMoveLink}
          setPickerOpen={setPickerOpen}
          setLinkedElsewhereMap={setLinkedElsewhereMap}
          doMoveMemory={doMoveMemory}
          loadChapterMemories={loadChapterMemories}
        />
      </div>
    </div>
  );
}