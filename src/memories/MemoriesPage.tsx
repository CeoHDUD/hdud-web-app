// C:\HDUD_DATA\hdud-web-app\src\memories\MemoriesPage.tsx

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import LivingEcosystem, { type LivingStory } from "../components/LivingEcosystem";

type MemoryListItem = {
  memory_id: number;
  author_id?: number;
  title: string | null;
  content: string;
  created_at: string;
  meta?: {
    can_edit?: boolean;
    current_version?: number;
    life_phase?: string | null;
    phase_name?: string | null;
    chapter_id?: number | null;
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

type ConfettiParticle = {
  id: string;
  left: number;
  top: number;
  size: number;
  delay: number;
  drift: number;
  rot: number;
  opacity: number;
};

type NarrativeStage = "plantadas" | "crescimento" | "ebulicao";

type NarrativeMemory = {
  memory_id: number;
  title: string;
  preview: string;
  atIso: string | null;
  chapter_id: number | null;
  phaseLabel: string | null;
};

type NarrativeCluster = {
  cluster_id: string;
  title: string;
  stage: NarrativeStage;
  confidence: number;
  summary: string;
  signals: string[];
  memory_ids: number[];
  memories: NarrativeMemory[];
  memory_count: number;
  suggested_chapter_title: string;
  energyLabel: string;
  phaseLabel: string | null;
  dominantKeywords: string[];
  firstAt: string | null;
  latestAt: string | null;
};

type GardenChapterDraft = {
  source: "garden";
  created_at: string;
  title: string;
  description: string;
  body: string;
  memoryIds: number[];
  memories: Array<{
    memory_id: number;
    title: string;
    preview: string;
    atIso: string | null;
    chapter_id: number | null;
  }>;
};

const API_BASE = "/api";
const HDUD_GARDEN_CHAPTER_DRAFT_KEY = "hdud_garden_chapter_draft";

const LIFE_PHASES = [
  { value: "__ALL__", label: "Fase: Todas" },
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

const STOPWORDS = new Set([
  "a",
  "à",
  "agora",
  "ali",
  "ao",
  "aos",
  "as",
  "às",
  "com",
  "como",
  "da",
  "das",
  "de",
  "dela",
  "dele",
  "deles",
  "depois",
  "do",
  "dos",
  "e",
  "ela",
  "ele",
  "em",
  "era",
  "essa",
  "esse",
  "esta",
  "está",
  "eu",
  "foi",
  "hoje",
  "isso",
  "já",
  "la",
  "lá",
  "mais",
  "mas",
  "me",
  "mesmo",
  "meu",
  "minha",
  "muito",
  "na",
  "não",
  "nas",
  "nem",
  "no",
  "nos",
  "nós",
  "o",
  "os",
  "ou",
  "para",
  "pela",
  "pelas",
  "pelo",
  "pelos",
  "por",
  "pra",
  "que",
  "se",
  "sem",
  "ser",
  "sua",
  "suas",
  "também",
  "te",
  "tem",
  "tinha",
  "uma",
  "umas",
  "um",
  "uns",
  "vida",
  "vivi",
]);

function getTokenFromStorage(): string | null {
  return (
    localStorage.getItem("HDUD_TOKEN") ||
    localStorage.getItem("hdud_access_token") ||
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

function formatDateBRShort(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(d);
  } catch {
    return iso;
  }
}

function coerceNumber(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function safeTrim(v: any): string {
  return String(v ?? "").trim();
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
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

function greetingPTBR(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Bom dia";
  if (h >= 12 && h < 18) return "Boa tarde";
  return "Boa noite";
}

function extractPhaseMeta(raw: any): { life_phase?: string | null; phase_name?: string | null } {
  const meta = raw?.meta ?? null;

  const life_phase =
    (meta?.life_phase ?? meta?.lifePhase ?? raw?.life_phase ?? raw?.lifePhase ?? null) as
      | string
      | null;

  const phase_name =
    (meta?.phase_name ?? meta?.phaseName ?? raw?.phase_name ?? raw?.phaseName ?? null) as
      | string
      | null;

  return {
    life_phase: life_phase === undefined ? null : life_phase,
    phase_name: phase_name === undefined ? null : phase_name,
  };
}

function normalizeFromLegacy(raw: any): MemoryListItem | null {
  const id = coerceNumber(raw?.memory_id) ?? coerceNumber(raw?.id);
  if (!id) return null;

  const created =
    raw?.created_at ||
    raw?.createdAt ||
    raw?.created ||
    new Date().toISOString();

  const phaseMeta = extractPhaseMeta(raw);

  return {
    memory_id: id,
    author_id: coerceNumber(raw?.author_id) ?? undefined,
    title: raw?.title === null || raw?.title === undefined ? null : String(raw?.title),
    content: String(raw?.content ?? ""),
    created_at: String(created),
    meta: {
      can_edit: typeof raw?.meta?.can_edit === "boolean" ? raw.meta.can_edit : undefined,
      current_version: coerceNumber(raw?.meta?.current_version) ?? undefined,
      life_phase: phaseMeta.life_phase ?? null,
      phase_name: phaseMeta.phase_name ?? null,
      chapter_id: coerceNumber(raw?.meta?.chapter_id) ?? undefined,
    },
  };
}

function normalizeFromTimelineItem(item: any): MemoryListItem | null {
  const raw = item?.raw ?? null;
  if (!raw) return null;

  const id = coerceNumber(raw?.memory_id) ?? null;
  if (!id) return null;

  const created = raw?.created_at || item?.at || item?.timestamp || new Date().toISOString();
  const metaRaw = raw?.meta ?? null;
  const phaseMeta = extractPhaseMeta(raw);

  return {
    memory_id: id,
    author_id: coerceNumber(raw?.author_id) ?? undefined,
    title: raw?.title === null || raw?.title === undefined ? null : String(raw?.title),
    content: String(raw?.content ?? ""),
    created_at: String(created),
    meta: {
      can_edit: typeof metaRaw?.can_edit === "boolean" ? metaRaw.can_edit : undefined,
      current_version: coerceNumber(metaRaw?.current_version) ?? undefined,
      life_phase: phaseMeta.life_phase ?? null,
      phase_name: phaseMeta.phase_name ?? null,
      chapter_id: coerceNumber(metaRaw?.chapter_id) ?? undefined,
    },
  };
}

function uid(): string {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function buildConfetti(count: number): ConfettiParticle[] {
  const safeCount = Math.max(3, Math.min(6, count));
  const arr: ConfettiParticle[] = [];
  for (let i = 0; i < safeCount; i++) {
    arr.push({
      id: uid(),
      left: 45 + Math.random() * 20,
      top: 72 + Math.random() * 30,
      size: 6 + Math.random() * 6,
      delay: Math.floor(Math.random() * 90),
      drift: 24 + Math.random() * 40,
      rot: -25 + Math.random() * 50,
      opacity: 0.35 + Math.random() * 0.35,
    });
  }
  return arr;
}

function previewText(v: string, max = 180): string {
  const t = safeTrim(v).replace(/\s+/g, " ");
  if (!t) return "";
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + "…";
}

function normalizeWord(word: string): string {
  return word
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function extractKeywords(text: string): string[] {
  const matches = safeTrim(text)
    .match(/[A-Za-zÀ-ÿ0-9]+/g)
    ?.map((x) => normalizeWord(x))
    .filter((x) => x.length >= 4 && !STOPWORDS.has(x)) ?? [];

  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of matches) {
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
    if (out.length >= 8) break;
  }
  return out;
}

function formatStageLabel(stage: NarrativeStage): string {
  if (stage === "plantadas") return "Plantadas";
  if (stage === "crescimento") return "Em crescimento";
  return "Em ebulição";
}

function energyByStage(stage: NarrativeStage): string {
  if (stage === "plantadas") return "sinais iniciais";
  if (stage === "crescimento") return "conexões consistentes";
  return "força narrativa alta";
}

function resolvePhaseLabel(memory: MemoryListItem): string | null {
  return safeTrim(memory.meta?.phase_name) || safeTrim(memory.meta?.life_phase) || null;
}

function clusterStageBySize(size: number): NarrativeStage {
  if (size >= 5) return "ebulicao";
  if (size >= 3) return "crescimento";
  return "plantadas";
}

function buildClusterSummary(
  title: string,
  stage: NarrativeStage,
  memories: NarrativeMemory[],
  keywords: string[]
): string {
  const first = memories[0];
  const phase = memories.find((m) => m.phaseLabel)?.phaseLabel;
  const phaseText = phase ? ` na fase ${phase}` : "";
  const base =
    stage === "ebulicao"
      ? `Essas memórias estão se reconhecendo sozinhas${phaseText}. Já existe densidade emocional suficiente para nascer um capítulo.`
      : stage === "crescimento"
      ? `Há um fio narrativo em formação${phaseText}. O material já sugere começo, meio emocional e direção editorial.`
      : `O tema "${title}" começou a aparecer${phaseText}. Ainda é semente, mas já tem identidade própria.`;

  const keyText = keywords.length ? ` Sinais fortes: ${keywords.slice(0, 3).join(", ")}.` : "";
  const firstText = first?.atIso ? ` Pulso inicial em ${formatDateBRShort(first.atIso)}.` : "";
  return `${base}${keyText}${firstText}`;
}

function buildSuggestedChapterTitle(title: string, stage: NarrativeStage): string {
  if (stage === "ebulicao") return title;
  if (stage === "crescimento") return `${title} — quando tudo começou a se conectar`;
  return `${title} — rascunho de um capítulo`;
}

function buildDraftBody(cluster: NarrativeCluster): string {
  const lines: string[] = [];
  lines.push(`## Núcleo narrativo`);
  lines.push(cluster.summary);
  lines.push("");
  lines.push(`## Memórias que sustentam esta narrativa`);
  cluster.memories.forEach((memory, index) => {
    lines.push(
      `${index + 1}. ${memory.title}${memory.atIso ? ` — ${formatDateBRShort(memory.atIso)}` : ""}`
    );
    lines.push(`   ${memory.preview}`);
  });

  if (cluster.signals.length) {
    lines.push("");
    lines.push(`## Sinais detectados`);
    cluster.signals.forEach((signal) => lines.push(`- ${signal}`));
  }

  return lines.join("\n");
}

function buildGardenDraft(cluster: NarrativeCluster): GardenChapterDraft {
  return {
    source: "garden",
    created_at: new Date().toISOString(),
    title: cluster.suggested_chapter_title,
    description: cluster.summary,
    body: buildDraftBody(cluster),
    memoryIds: cluster.memory_ids,
    memories: cluster.memories.map((m) => ({
      memory_id: m.memory_id,
      title: m.title,
      preview: m.preview,
      atIso: m.atIso,
      chapter_id: m.chapter_id,
    })),
  };
}

function clusterNarrativeLine(cluster: NarrativeCluster): string {
  if (cluster.stage === "ebulicao") return "Esta narrativa está pronta para nascer.";
  if (cluster.stage === "crescimento") return "Existe um padrão surgindo aqui.";
  return "Algo começou a tomar forma neste núcleo.";
}

function buildNarrativeClusters(memories: MemoryListItem[]): NarrativeCluster[] {
  if (!Array.isArray(memories) || memories.length === 0) return [];

  const phaseGroups = new Map<string, MemoryListItem[]>();
  const keywordGroups = new Map<string, MemoryListItem[]>();

  for (const memory of memories) {
    const phaseLabel = resolvePhaseLabel(memory);
    if (phaseLabel) {
      const key = `phase:${normalizeWord(phaseLabel)}`;
      const arr = phaseGroups.get(key) ?? [];
      arr.push(memory);
      phaseGroups.set(key, arr);
    }

    const words = extractKeywords(`${memory.title ?? ""} ${memory.content}`);
    words.slice(0, 3).forEach((word) => {
      const arr = keywordGroups.get(word) ?? [];
      arr.push(memory);
      keywordGroups.set(word, arr);
    });
  }

  const candidates: Array<{
    id: string;
    label: string;
    memories: MemoryListItem[];
    phaseLabel: string | null;
    keywords: string[];
  }> = [];

  phaseGroups.forEach((group) => {
    if (group.length < 2) return;
    const phaseLabel = resolvePhaseLabel(group[0]);
    candidates.push({
      id: `phase-${normalizeWord(phaseLabel ?? "fase")}`,
      label: phaseLabel ? `Raízes de ${phaseLabel}` : "Raízes narrativas",
      memories: group,
      phaseLabel,
      keywords: Array.from(
        new Set(group.flatMap((m) => extractKeywords(`${m.title ?? ""} ${m.content}`)).slice(0, 5))
      ).slice(0, 5),
    });
  });

  keywordGroups.forEach((group, keyword) => {
    const unique = Array.from(new Map(group.map((m) => [m.memory_id, m])).values());
    if (unique.length < 2) return;
    candidates.push({
      id: `kw-${keyword}`,
      label: keyword.charAt(0).toUpperCase() + keyword.slice(1),
      memories: unique,
      phaseLabel: null,
      keywords: [keyword],
    });
  });

  const normalized = candidates
    .map((candidate) => {
      const sorted = candidate.memories
        .slice()
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const uniqueMemories = Array.from(new Map(sorted.map((m) => [m.memory_id, m])).values()).slice(0, 6);
      const stage = clusterStageBySize(uniqueMemories.length);
      const memoriesForCluster: NarrativeMemory[] = uniqueMemories.map((memory) => ({
        memory_id: memory.memory_id,
        title: safeTrim(memory.title) || `Memória #${memory.memory_id}`,
        preview: previewText(memory.content, 170),
        atIso: memory.created_at || null,
        chapter_id: memory.meta?.chapter_id ?? null,
        phaseLabel: resolvePhaseLabel(memory),
      }));

      const dominantKeywords = Array.from(
        new Set(
          uniqueMemories.flatMap((m) => extractKeywords(`${m.title ?? ""} ${m.content}`)).concat(candidate.keywords)
        )
      ).slice(0, 5);

      const confidence = Math.min(
        0.94,
        0.48 +
          uniqueMemories.length * 0.08 +
          (candidate.phaseLabel ? 0.08 : 0) +
          Math.min(dominantKeywords.length, 3) * 0.04
      );

      const title =
        candidate.phaseLabel && uniqueMemories.length >= 3
          ? `Ciclo de ${candidate.phaseLabel}`
          : candidate.label;

      const summary = buildClusterSummary(title, stage, memoriesForCluster, dominantKeywords);

      const signals = [
        `${uniqueMemories.length} memória(s) se aproximando`,
        candidate.phaseLabel ? `fase dominante: ${candidate.phaseLabel}` : "aproximação por linguagem e recorrência",
        dominantKeywords.length ? `palavras-semente: ${dominantKeywords.slice(0, 3).join(", ")}` : "intuição narrativa local",
      ];

      const oldestSorted = uniqueMemories
        .slice()
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      return {
        cluster_id: candidate.id,
        title,
        stage,
        confidence,
        summary,
        signals,
        memory_ids: memoriesForCluster.map((m) => m.memory_id),
        memories: memoriesForCluster,
        memory_count: memoriesForCluster.length,
        suggested_chapter_title: buildSuggestedChapterTitle(title, stage),
        energyLabel: energyByStage(stage),
        phaseLabel: candidate.phaseLabel,
        dominantKeywords,
        firstAt: oldestSorted[0]?.created_at ?? null,
        latestAt: uniqueMemories[0]?.created_at ?? null,
      } satisfies NarrativeCluster;
    })
    .sort((a, b) => {
      const scoreA =
        a.memory_count * 10 + a.confidence * 100 + (a.stage === "ebulicao" ? 20 : a.stage === "crescimento" ? 10 : 0);
      const scoreB =
        b.memory_count * 10 + b.confidence * 100 + (b.stage === "ebulicao" ? 20 : b.stage === "crescimento" ? 10 : 0);
      return scoreB - scoreA;
    });

  const uniqueBySignature = new Map<string, NarrativeCluster>();
  for (const cluster of normalized) {
    const signature = cluster.memory_ids.slice().sort((a, b) => a - b).join("-");
    if (!signature) continue;
    if (!uniqueBySignature.has(signature)) {
      uniqueBySignature.set(signature, cluster);
    }
  }

  const result = Array.from(uniqueBySignature.values()).slice(0, 8);

  const coveredIds = new Set(result.flatMap((cluster) => cluster.memory_ids));
  const orphanMemories = memories.filter((memory) => !coveredIds.has(memory.memory_id));

  const orphanClusters: NarrativeCluster[] = orphanMemories.map((memory) => {
    const keywords = extractKeywords(`${memory.title ?? ""} ${memory.content}`);

    return {
      cluster_id: `solo-${memory.memory_id}`,
      title: safeTrim(memory.title) || "Semente narrativa",
      stage: "plantadas",
      confidence: 0.32,
      summary: "Esta memória ainda está isolada, mas já contém uma semente narrativa pronta para futuras conexões.",
      signals: [
        "memória isolada",
        "aguardando conexão",
        keywords.length ? `palavra-chave: ${keywords[0]}` : "intuição inicial",
      ],
      memory_ids: [memory.memory_id],
      memories: [
        {
          memory_id: memory.memory_id,
          title: safeTrim(memory.title) || `Memória #${memory.memory_id}`,
          preview: previewText(memory.content),
          atIso: memory.created_at || null,
          chapter_id: memory.meta?.chapter_id ?? null,
          phaseLabel: resolvePhaseLabel(memory),
        },
      ],
      memory_count: 1,
      suggested_chapter_title: safeTrim(memory.title) || "Semente narrativa",
      energyLabel: "potencial latente",
      phaseLabel: resolvePhaseLabel(memory),
      dominantKeywords: keywords.slice(0, 3),
      firstAt: memory.created_at || null,
      latestAt: memory.created_at || null,
    } satisfies NarrativeCluster;
  });

  if (result.length > 0 || orphanClusters.length > 0) {
    return [...result, ...orphanClusters].slice(0, 12);
  }

  const fallback = memories
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, Math.min(4, memories.length));

  const fallbackNarrativeMemories: NarrativeMemory[] = fallback.map((memory) => ({
    memory_id: memory.memory_id,
    title: safeTrim(memory.title) || `Memória #${memory.memory_id}`,
    preview: previewText(memory.content, 170),
    atIso: memory.created_at || null,
    chapter_id: memory.meta?.chapter_id ?? null,
    phaseLabel: resolvePhaseLabel(memory),
  }));

  const stage = clusterStageBySize(fallbackNarrativeMemories.length);
  return [
    {
      cluster_id: "garden-fallback",
      title: "Primeiros sinais do seu Jardim",
      stage,
      confidence: 0.42,
      summary:
        "Ainda existem poucas memórias para formar um grande agrupamento, mas já há um núcleo inicial pronto para virar rascunho editorial.",
      signals: [
        `${fallbackNarrativeMemories.length} memória(s) recentes reunidas`,
        "cluster de aquecimento local",
        "pronto para virar draft manual",
      ],
      memory_ids: fallbackNarrativeMemories.map((m) => m.memory_id),
      memories: fallbackNarrativeMemories,
      memory_count: fallbackNarrativeMemories.length,
      suggested_chapter_title: "Primeiros sinais do meu Jardim",
      energyLabel: energyByStage(stage),
      phaseLabel: null,
      dominantKeywords: [],
      firstAt: fallbackNarrativeMemories[fallbackNarrativeMemories.length - 1]?.atIso ?? null,
      latestAt: fallbackNarrativeMemories[0]?.atIso ?? null,
    },
  ];
}

export default function MemoriesPage(props: {
  token?: string | null;
  onLogout?: () => void;
}) {
  const navigate = useNavigate();
  const token = useMemo(() => props.token || getTokenFromStorage(), [props.token]);

  const [authorId, setAuthorId] = useState<number | null>(() => getAuthorIdFromStorage());
  const [items, setItems] = useState<MemoryListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<"list" | "create">("list");

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [creating, setCreating] = useState(false);

  const [q, setQ] = useState("");
  const [phase, setPhase] = useState<string>("__ALL__");
  const [onlyEditable, setOnlyEditable] = useState(false);
  const [orderBy, setOrderBy] = useState<"newest" | "oldest" | "title">("newest");

  const [hoverId, setHoverId] = useState<number | null>(null);
  const [confetti, setConfetti] = useState<ConfettiParticle[]>([]);
  const confettiTimerRef = useRef<number | null>(null);

  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [draftingClusterId, setDraftingClusterId] = useState<string | null>(null);

  const hardLogout = useCallback(() => {
    localStorage.removeItem("HDUD_TOKEN");
    localStorage.removeItem("hdud_access_token");
    localStorage.removeItem("access_token");
    localStorage.removeItem("token");
    localStorage.removeItem("HDUD_AUTHOR_ID");
    localStorage.removeItem("author_id");
    if (props.onLogout) props.onLogout();
    navigate("/login");
  }, [navigate, props]);

  useEffect(() => {
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
      let list: MemoryListItem[] = [];

      try {
        const data = await api<TimelineResponse>("GET", `/timeline`, token);
        const all = Array.isArray(data?.items) ? data.items! : [];
        const memoriesOnly = all.filter((it: any) => it?.source === "memories");
        list = memoriesOnly
          .map((it: any) => normalizeFromTimelineItem(it))
          .filter(Boolean) as MemoryListItem[];
      } catch {
        list = [];
      }

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

      const unique = Array.from(new Map(list.map((m) => [m.memory_id, m])).values());
      setItems(unique);
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
    if (token) void load();
  }, [token, load]);

  const phaseOptions = useMemo(() => {
    const base = LIFE_PHASES.map((x) => ({ value: x.value, label: x.label }));

    const found = new Map<string, string>();
    for (const it of items) {
      const pn = safeTrim(it.meta?.phase_name);
      if (pn) found.set(pn, pn);
    }

    const extras = Array.from(found.entries())
      .map(([value, label]) => ({ value, label: `Fase: ${label}` }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR", { sensitivity: "base" }));

    const baseValues = new Set(base.map((b) => b.value));
    const filteredExtras = extras.filter((x) => !baseValues.has(x.value));

    return [...base, ...filteredExtras];
  }, [items]);

  const viewItems = useMemo(() => {
    let list = items.slice();

    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter((m) => {
        const t = (m.title ?? "").toLowerCase();
        const c = (m.content ?? "").toLowerCase();
        return t.includes(needle) || c.includes(needle);
      });
    }

    if (phase !== "__ALL__") {
      if (phase === "") {
        list = list.filter((m) => !safeTrim(m.meta?.life_phase) && !safeTrim(m.meta?.phase_name));
      } else {
        list = list.filter((m) => {
          const lp = safeTrim(m.meta?.life_phase);
          const pn = safeTrim(m.meta?.phase_name);
          return lp === phase || pn === phase;
        });
      }
    }

    if (onlyEditable) {
      list = list.filter((m) => m.meta?.can_edit === true);
    }

    if (orderBy === "oldest") {
      list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } else if (orderBy === "title") {
      list.sort((a, b) =>
        String(a.title ?? "").localeCompare(String(b.title ?? ""), "pt-BR", {
          sensitivity: "base",
        })
      );
    } else {
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return list;
  }, [items, q, onlyEditable, orderBy, phase]);

  const countLabel = useMemo(() => {
    const filtered =
      q.trim().length > 0 || onlyEditable || orderBy !== "newest" || phase !== "__ALL__";
    return filtered ? `${viewItems.length}/${items.length} memória(s)` : `${items.length} memória(s)`;
  }, [items.length, viewItems.length, q, onlyEditable, orderBy, phase]);

  const latestMemory = useMemo(() => {
    if (items.length === 0) return null;
    const sorted = items
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return sorted[0] ?? null;
  }, [items]);

  const pulseLabel = useMemo(() => {
    if (!latestMemory) return "Seu jardim ainda está vazio — comece com uma primeira memória.";
    return `Última memória ${daysAgoLabel(latestMemory.created_at)}.`;
  }, [latestMemory]);

  const moment = useMemo(() => {
    const sorted = viewItems
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const destaque = sorted[0] ?? null;

    let revisitar: MemoryListItem | null = null;
    if (sorted.length >= 2) {
      const oldest = viewItems
        .slice()
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      const pool = oldest.slice(0, Math.min(6, oldest.length));
      revisitar = pool[Math.floor(Math.random() * pool.length)] ?? null;
    }

    return { destaque, revisitar };
  }, [viewItems]);

  const microcopy = useMemo(() => {
    const parts: string[] = [];
    const needle = q.trim();
    if (needle) parts.push(`busca: “${needle}”`);
    if (phase !== "__ALL__") {
      if (phase === "") parts.push("fase: sem fase");
      else parts.push(`fase: ${phase}`);
    }
    if (onlyEditable) parts.push("somente editáveis");
    if (orderBy === "oldest") parts.push("ordem: antigas primeiro");
    if (orderBy === "title") parts.push("ordem: por título");

    if (parts.length === 0) {
      return "Seu jardim está em movimento. Algumas memórias estão começando a se aproximar.";
    }
    return `Mostrando ${parts.join(" • ")}.`;
  }, [q, phase, onlyEditable, orderBy]);

  const clusters = useMemo(() => buildNarrativeClusters(viewItems), [viewItems]);

  const epicenterCluster = useMemo(() => {
    if (!clusters.length) return null;
    return (
      clusters
        .slice()
        .sort((a, b) => {
          const epicA = (a.stage === "ebulicao" ? 100 : a.stage === "crescimento" ? 40 : 0) + a.confidence * 100 + a.memory_count * 6;
          const epicB = (b.stage === "ebulicao" ? 100 : b.stage === "crescimento" ? 40 : 0) + b.confidence * 100 + b.memory_count * 6;
          return epicB - epicA;
        })[0] ?? null
    );
  }, [clusters]);

  useEffect(() => {
    if (clusters.length === 0) {
      setSelectedClusterId(null);
      return;
    }

    setSelectedClusterId((current) => {
      if (current && clusters.some((cluster) => cluster.cluster_id === current)) return current;
      return epicenterCluster?.cluster_id ?? clusters[0].cluster_id;
    });
  }, [clusters, epicenterCluster]);

  const selectedCluster = useMemo(
    () => clusters.find((cluster) => cluster.cluster_id === selectedClusterId) ?? epicenterCluster ?? clusters[0] ?? null,
    [clusters, selectedClusterId, epicenterCluster]
  );

  const ecosystemStories = useMemo<LivingStory[]>(
    () =>
      clusters.map((cluster) => ({
        id: cluster.cluster_id,
        authorName:
          cluster.cluster_id === epicenterCluster?.cluster_id
            ? "Epicentro vivo"
            : formatStageLabel(cluster.stage),
        title: cluster.title,
        fragment: clusterNarrativeLine(cluster),
        href: cluster.cluster_id,
      })),
    [clusters, epicenterCluster]
  );

  const gardenStats = useMemo(() => {
    const planted = clusters.filter((c) => c.stage === "plantadas").length;
    const growing = clusters.filter((c) => c.stage === "crescimento").length;
    const boiling = clusters.filter((c) => c.stage === "ebulicao").length;
    const linkedToChapters = viewItems.filter((m) => Number(m.meta?.chapter_id) > 0).length;

    return {
      planted,
      growing,
      boiling,
      linkedToChapters,
    };
  }, [clusters, viewItems]);

  function openCreate() {
    setError(null);
    setMode("create");
    try {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {}
  }

  function cancelCreate() {
    setError(null);
    setMode("list");
    setTitle("");
    setContent("");
  }

  function triggerConfetti() {
    if (confettiTimerRef.current) {
      window.clearTimeout(confettiTimerRef.current);
      confettiTimerRef.current = null;
    }
    const particles = buildConfetti(4 + Math.floor(Math.random() * 3));
    setConfetti(particles);

    confettiTimerRef.current = window.setTimeout(() => {
      setConfetti([]);
      confettiTimerRef.current = null;
    }, 820);
  }

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
      await api("POST", `/memory`, token, {
        author_id: authorId,
        title: title.trim() ? title.trim() : null,
        content,
      });

      await load();

      setTitle("");
      setContent("");
      setMode("list");

      triggerConfetti();
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

  const openMemory = useCallback(
    (id: number) => {
      navigate(`/memories/${id}`);
    },
    [navigate]
  );

  const transformClusterIntoChapter = useCallback(
    (cluster: NarrativeCluster) => {
      try {
        setDraftingClusterId(cluster.cluster_id);
        const draft = buildGardenDraft(cluster);
        sessionStorage.setItem(HDUD_GARDEN_CHAPTER_DRAFT_KEY, JSON.stringify(draft));
        navigate("/chapters");
      } finally {
        window.setTimeout(() => setDraftingClusterId(null), 200);
      }
    },
    [navigate]
  );

  const ui = useMemo(() => {
    const page: React.CSSProperties = {
      padding: 0,
      color: "var(--hdud-text)",
      background:
        "radial-gradient(1200px 560px at 10% 0%, color-mix(in srgb, var(--hdud-warn-bg) 60%, transparent) 0%, transparent 58%), radial-gradient(980px 520px at 100% 0%, color-mix(in srgb, var(--hdud-success-bg) 65%, transparent) 0%, transparent 62%)",
      minHeight: "100%",
    };

    const container: React.CSSProperties = {
      width: "100%",
      maxWidth: 1920,
      margin: "0 auto",
      padding: "18px clamp(16px, 2.2vw, 36px) 28px",
      boxSizing: "border-box",
      position: "relative",
    };

    const headerCard: React.CSSProperties = {
      background:
        "linear-gradient(180deg, color-mix(in srgb, var(--hdud-surface) 98%, transparent), color-mix(in srgb, var(--hdud-surface-2) 92%, transparent))",
      borderRadius: 22,
      padding: 20,
      boxShadow: "var(--hdud-shadow-2)",
      marginBottom: 16,
      border: "1px solid color-mix(in srgb, var(--hdud-border) 82%, transparent)",
      position: "relative",
      overflow: "hidden",
      backdropFilter: "blur(6px)",
    };

    const headerGlow: React.CSSProperties = {
      position: "absolute",
      inset: -60,
      background:
        "radial-gradient(circle at 12% 14%, color-mix(in srgb, var(--hdud-warn-bg) 85%, transparent) 0%, transparent 34%), radial-gradient(circle at 88% 16%, color-mix(in srgb, var(--hdud-success-bg) 78%, transparent) 0%, transparent 36%)",
      pointerEvents: "none",
      opacity: 0.7,
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
      fontSize: 42,
      fontWeight: 950,
      letterSpacing: -0.9,
      margin: 0,
      lineHeight: 1.0,
    };

    const subtitle: React.CSSProperties = {
      marginTop: 9,
      color: "var(--hdud-muted)",
      fontWeight: 780,
      position: "relative",
      zIndex: 1,
      maxWidth: 860,
    };

    const toolbarRow: React.CSSProperties = {
      display: "flex",
      gap: 10,
      alignItems: "center",
      flexWrap: "wrap",
      marginTop: 16,
      position: "relative",
      zIndex: 1,
    };

    const spacer: React.CSSProperties = { flex: "1 1 auto" };

    const card: React.CSSProperties = {
      background: "color-mix(in srgb, var(--hdud-surface) 98%, transparent)",
      borderRadius: 20,
      padding: 14,
      boxShadow: "var(--hdud-shadow-1)",
      border: "1px solid color-mix(in srgb, var(--hdud-border) 80%, transparent)",
      marginBottom: 14,
      backdropFilter: "blur(4px)",
    };

    const cardTitle: React.CSSProperties = {
      fontSize: 12,
      fontWeight: 950,
      marginBottom: 10,
      letterSpacing: 0.22,
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
      borderRadius: 14,
      border: "1px solid color-mix(in srgb, var(--hdud-border) 88%, transparent)",
      background: "var(--hdud-surface)",
      color: "var(--hdud-text)",
      outline: "none",
      boxSizing: "border-box",
    };

    const textarea: React.CSSProperties = {
      width: "100%",
      minHeight: 160,
      padding: "12px 12px",
      borderRadius: 14,
      border: "1px solid color-mix(in srgb, var(--hdud-border) 88%, transparent)",
      background: "var(--hdud-surface)",
      color: "var(--hdud-text)",
      outline: "none",
      resize: "vertical",
      fontFamily: "inherit",
      lineHeight: 1.5,
      boxSizing: "border-box",
    };

    const select: React.CSSProperties = {
      padding: "9px 12px",
      borderRadius: 14,
      border: "1px solid color-mix(in srgb, var(--hdud-border) 88%, transparent)",
      background: "var(--hdud-surface)",
      color: "var(--hdud-text)",
      outline: "none",
      fontWeight: 800,
    };

    const btn: React.CSSProperties = {
      padding: "10px 14px",
      borderRadius: 14,
      border: "1px solid color-mix(in srgb, var(--hdud-border) 88%, transparent)",
      background: "var(--hdud-surface)",
      color: "var(--hdud-text)",
      cursor: "pointer",
      fontWeight: 900,
      whiteSpace: "nowrap",
      boxShadow: "var(--hdud-shadow-1)",
      transition: "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, opacity 160ms ease",
    };

    const btnPrimary: React.CSSProperties = {
      ...btn,
      background: "var(--hdud-primary-bg)",
      borderColor: "var(--hdud-primary-bg)",
      color: "var(--hdud-primary-text)",
    };

    const btnGhost: React.CSSProperties = {
      ...btn,
      background: "transparent",
      boxShadow: "none",
    };

    const pill: React.CSSProperties = {
      border: "1px solid color-mix(in srgb, var(--hdud-border) 88%, transparent)",
      padding: "6px 11px",
      borderRadius: 999,
      fontSize: 12,
      whiteSpace: "nowrap",
      background: "color-mix(in srgb, var(--hdud-surface-2) 90%, transparent)",
      fontWeight: 900,
    };

    const epicenterPill: React.CSSProperties = {
      border: "1px solid color-mix(in srgb, var(--hdud-warn-border) 88%, transparent)",
      padding: "6px 11px",
      borderRadius: 999,
      fontSize: 11,
      whiteSpace: "nowrap",
      background: "color-mix(in srgb, var(--hdud-warn-bg) 92%, transparent)",
      fontWeight: 950,
      color: "var(--hdud-text)",
      animation: "hdud-pulse-soft 2.8s ease-in-out infinite",
      boxShadow: "0 0 0 1px color-mix(in srgb, var(--hdud-warn-bg) 40%, transparent)",
    };

    const statGrid: React.CSSProperties = {
      display: "grid",
      gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
      gap: 10,
      marginTop: 16,
      position: "relative",
      zIndex: 1,
    };

    const statCard: React.CSSProperties = {
      border: "1px solid color-mix(in srgb, var(--hdud-border) 80%, transparent)",
      borderRadius: 16,
      padding: 14,
      background: "color-mix(in srgb, var(--hdud-surface) 94%, transparent)",
      boxShadow: "var(--hdud-shadow-1)",
    };

    const statValue: React.CSSProperties = {
      fontSize: 24,
      fontWeight: 950,
      letterSpacing: -0.5,
      lineHeight: 1,
    };

    const twoCols: React.CSSProperties = {
      display: "grid",
      gridTemplateColumns: "1.2fr 0.8fr",
      gap: 14,
      alignItems: "start",
      marginBottom: 14,
    };

    const narrativeGrid: React.CSSProperties = {
      display: "grid",
      gap: 12,
      marginTop: 10,
    };

    const clusterCard: React.CSSProperties = {
      border: "1px solid color-mix(in srgb, var(--hdud-border) 82%, transparent)",
      background: "linear-gradient(180deg, var(--hdud-surface), color-mix(in srgb, var(--hdud-surface-2) 92%, transparent))",
      borderRadius: 18,
      padding: 16,
      boxShadow: "var(--hdud-shadow-1)",
      transition: "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
      position: "relative",
      overflow: "hidden",
    };

    const epicenterCard: React.CSSProperties = {
      border: "1px solid color-mix(in srgb, var(--hdud-warn-border) 92%, transparent)",
      background:
        "radial-gradient(1100px 420px at 12% 12%, color-mix(in srgb, var(--hdud-warn-bg) 88%, transparent) 0%, transparent 52%), linear-gradient(180deg, var(--hdud-surface), color-mix(in srgb, var(--hdud-surface-2) 94%, transparent))",
      borderRadius: 22,
      padding: 18,
      boxShadow: "var(--hdud-shadow-2)",
      position: "relative",
      overflow: "hidden",
      transform: "translateY(-1px)",
    };

    const detailCard: React.CSSProperties = {
      ...card,
      position: "sticky",
      top: 16,
    };

    const signalPill: React.CSSProperties = {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      borderRadius: 999,
      padding: "6px 10px",
      background: "color-mix(in srgb, var(--hdud-accent-bg) 95%, transparent)",
      border: "1px solid color-mix(in srgb, var(--hdud-accent-border) 70%, transparent)",
      fontSize: 12,
      fontWeight: 850,
    };

    const signalPillBoiling: React.CSSProperties = {
      ...signalPill,
      background: "color-mix(in srgb, var(--hdud-warn-bg) 92%, transparent)",
      border: "1px solid color-mix(in srgb, var(--hdud-warn-border) 80%, transparent)",
      animation: "hdud-pulse-soft 2.8s ease-in-out infinite",
    };

    const grid2: React.CSSProperties = {
      display: "grid",
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      gap: 10,
    };

    const momentCard: React.CSSProperties = {
      border: "1px solid color-mix(in srgb, var(--hdud-border) 82%, transparent)",
      background: "var(--hdud-surface)",
      borderRadius: 18,
      padding: 14,
      boxShadow: "var(--hdud-shadow-1)",
      cursor: "pointer",
      transition: "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
    };

    const momentTitle: React.CSSProperties = {
      fontWeight: 950,
      margin: 0,
      fontSize: 14,
      letterSpacing: -0.2,
    };

    const momentMeta: React.CSSProperties = {
      marginTop: 6,
      color: "var(--hdud-muted)",
      fontSize: 12,
      fontWeight: 800,
      lineHeight: 1.35,
      display: "-webkit-box",
      WebkitLineClamp: 3,
      WebkitBoxOrient: "vertical",
      overflow: "hidden",
    };

    const listWrap: React.CSSProperties = {
      display: "grid",
      gap: 10,
      marginTop: 10,
    };

    const row: React.CSSProperties = {
      border: "1px solid color-mix(in srgb, var(--hdud-border) 82%, transparent)",
      background: "var(--hdud-surface)",
      borderRadius: 18,
      padding: 14,
      cursor: "pointer",
      boxShadow: "var(--hdud-shadow-1)",
      transition: "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
      transform: "translate3d(0,0,0)",
    };

    const rowHover: React.CSSProperties = {
      transform: "translate3d(0,-2px,0)",
      boxShadow: "var(--hdud-shadow-2)",
      borderColor: "color-mix(in srgb, var(--hdud-border) 100%, transparent)",
    };

    const rowTop: React.CSSProperties = {
      display: "flex",
      justifyContent: "space-between",
      gap: 12,
      alignItems: "baseline",
    };

    const rowTitle: React.CSSProperties = {
      fontWeight: 950,
      fontSize: 14,
      margin: 0,
      letterSpacing: -0.2,
    };

    const rowMeta: React.CSSProperties = {
      color: "var(--hdud-muted)",
      fontSize: 12,
      whiteSpace: "nowrap",
      fontWeight: 800,
    };

    const rowSub: React.CSSProperties = {
      color: "var(--hdud-muted)",
      fontSize: 12,
      marginTop: 8,
      lineHeight: 1.45,
      display: "-webkit-box",
      WebkitLineClamp: 3,
      WebkitBoxOrient: "vertical",
      overflow: "hidden",
    };

    const createFooter: React.CSSProperties = {
      display: "flex",
      justifyContent: "flex-end",
      gap: 10,
      marginTop: 14,
    };

    const empty: React.CSSProperties = {
      border: "1px dashed color-mix(in srgb, var(--hdud-border) 82%, transparent)",
      background: "color-mix(in srgb, var(--hdud-surface) 94%, transparent)",
      borderRadius: 18,
      padding: 18,
      opacity: 0.95,
    };

    const emptyTitle: React.CSSProperties = {
      margin: 0,
      fontWeight: 950,
      letterSpacing: -0.2,
    };

    const emptyText: React.CSSProperties = {
      marginTop: 6,
      color: "var(--hdud-muted)",
      fontWeight: 750,
      lineHeight: 1.45,
    };

    const confettiLayer: React.CSSProperties = {
      position: "fixed",
      inset: 0,
      pointerEvents: "none",
      zIndex: 999,
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
      pill,
      epicenterPill,
      statGrid,
      statCard,
      statValue,
      twoCols,
      narrativeGrid,
      clusterCard,
      epicenterCard,
      detailCard,
      signalPill,
      signalPillBoiling,
      grid2,
      momentCard,
      momentTitle,
      momentMeta,
      listWrap,
      row,
      rowHover,
      rowTop,
      rowTitle,
      rowMeta,
      rowSub,
      createFooter,
      empty,
      emptyTitle,
      emptyText,
      confettiLayer,
    };
  }, []);

  const headerFilters = (
    <div style={ui.toolbarRow}>
      <button type="button" style={ui.btnPrimary} onClick={openCreate} disabled={loading}>
        Criar memória
      </button>

      <div style={ui.spacer} />

      <input
        style={{ ...ui.input, width: 280 }}
        placeholder="Buscar (título ou conteúdo)…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <select style={ui.select} value={phase} onChange={(e) => setPhase(e.target.value)}>
        {phaseOptions.map((p) => (
          <option key={p.value || "__EMPTY__"} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>

      <select style={ui.select} value={orderBy} onChange={(e) => setOrderBy(e.target.value as any)}>
        <option value="newest">Mais recentes</option>
        <option value="oldest">Mais antigas</option>
        <option value="title">Título</option>
      </select>

      <button
        type="button"
        style={onlyEditable ? ui.btnPrimary : ui.btn}
        onClick={() => setOnlyEditable((v) => !v)}
      >
        Editáveis
      </button>

      <button type="button" style={ui.btn} onClick={load} disabled={loading}>
        Atualizar
      </button>
    </div>
  );

  const momentBlock = (
    <div style={ui.card}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <div style={ui.cardTitle}>Pulso do Jardim</div>
        <div style={{ color: "var(--hdud-muted)", fontSize: 12, fontWeight: 900 }}>
          {latestMemory ? `Pulso: ${pulseLabel}` : "Pulso: em silêncio"}
        </div>
      </div>

      <div className="hdud-garden-moment-grid" style={ui.grid2}>
        {moment.destaque ? (
          <div
            style={ui.momentCard}
            onClick={() => openMemory(moment.destaque!.memory_id)}
            onMouseEnter={() => setHoverId(moment.destaque!.memory_id)}
            onMouseLeave={() => setHoverId((v) => (v === moment.destaque!.memory_id ? null : v))}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ color: "var(--hdud-muted)", fontSize: 12, fontWeight: 900 }}>Em destaque</div>
                <p style={ui.momentTitle}>
                  {(moment.destaque.title && moment.destaque.title.trim()) || `Memória #${moment.destaque.memory_id}`}
                </p>
              </div>
              <div style={{ color: "var(--hdud-muted)", fontSize: 12, fontWeight: 900, whiteSpace: "nowrap" }}>
                {formatDateBRShort(moment.destaque.created_at)}
              </div>
            </div>
            <div style={ui.momentMeta}>{moment.destaque.content}</div>
          </div>
        ) : (
          <div style={ui.empty}>
            <p style={ui.emptyTitle}>Seu jardim começa aqui.</p>
            <div style={ui.emptyText}>Crie a primeira memória e o HDUD passa a ter pulso.</div>
          </div>
        )}

        {moment.revisitar ? (
          <div
            style={ui.momentCard}
            onClick={() => openMemory(moment.revisitar!.memory_id)}
            onMouseEnter={() => setHoverId(moment.revisitar!.memory_id)}
            onMouseLeave={() => setHoverId((v) => (v === moment.revisitar!.memory_id ? null : v))}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ color: "var(--hdud-muted)", fontSize: 12, fontWeight: 900 }}>Revisitar</div>
                <p style={ui.momentTitle}>
                  {(moment.revisitar.title && moment.revisitar.title.trim()) || `Memória #${moment.revisitar.memory_id}`}
                </p>
              </div>
              <div style={{ color: "var(--hdud-muted)", fontSize: 12, fontWeight: 900, whiteSpace: "nowrap" }}>
                {formatDateBRShort(moment.revisitar.created_at)}
              </div>
            </div>
            <div style={ui.momentMeta}>{moment.revisitar.content}</div>
          </div>
        ) : (
          <div style={ui.empty}>
            <p style={ui.emptyTitle}>Sem revisitas ainda.</p>
            <div style={ui.emptyText}>
              Quando você tiver mais memórias, o Jardim começa a puxar temas antigos de volta.
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div style={ui.page}>
      <style>{`
        @keyframes hdud_confetti_fall {
          0% { transform: translate3d(0,0,0) rotate(0deg); opacity: 0; }
          12% { opacity: 1; }
          100% { transform: translate3d(0,80px,0) rotate(18deg); opacity: 0; }
        }
        @keyframes hdud-pulse-soft {
          0% { transform: scale(1); opacity: 0.88; }
          50% { transform: scale(1.03); opacity: 1; }
          100% { transform: scale(1); opacity: 0.88; }
        }
        @keyframes hdud-shimmer {
          0% { background-position: -220px 0; }
          100% { background-position: 220px 0; }
        }
        @media (max-width: 1120px) {
          .hdud-garden-main-grid {
            grid-template-columns: 1fr !important;
          }
          .hdud-garden-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }
        @media (max-width: 760px) {
          .hdud-garden-stats-grid,
          .hdud-garden-moment-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      {confetti.length > 0 ? (
        <div style={ui.confettiLayer}>
          {confetti.map((p) => (
            <div
              key={p.id}
              style={{
                position: "absolute",
                left: `${p.left}vw`,
                top: `${p.top}px`,
                width: p.size,
                height: p.size,
                borderRadius: 999,
                background: "color-mix(in srgb, var(--hdud-success-border) 68%, transparent)",
                opacity: p.opacity,
                transform: `translate3d(0,0,0) rotate(${p.rot}deg)`,
                animation: `hdud_confetti_fall 800ms ease ${p.delay}ms 1 both`,
                filter: "blur(0.2px)",
              }}
            />
          ))}
        </div>
      ) : null}

      <div style={ui.container}>
        <div style={ui.headerCard}>
          <div style={ui.headerGlow} />
          <div style={ui.h1Row}>
            <div>
              <h1 style={ui.h1}>Jardim de Memórias</h1>
              <div style={ui.subtitle}>
                {greetingPTBR()}, Alexandre. {pulseLabel} Aqui as memórias são cultivadas, reconhecem padrões
                e amadurecem até virarem capítulos.
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {epicenterCluster ? <div style={ui.epicenterPill}>🔥 Epicentro vivo</div> : null}
              <div style={ui.pill}>{countLabel}</div>
            </div>
          </div>

          <div style={{ marginTop: 10, color: "var(--hdud-muted)", fontWeight: 760, position: "relative", zIndex: 1 }}>
            {microcopy}
          </div>

          <div className="hdud-garden-stats-grid" style={ui.statGrid}>
            <div style={ui.statCard}>
              <div style={{ color: "var(--hdud-muted)", fontSize: 12, fontWeight: 900 }}>Narrativas plantadas</div>
              <div style={ui.statValue}>{gardenStats.planted}</div>
            </div>
            <div style={ui.statCard}>
              <div style={{ color: "var(--hdud-muted)", fontSize: 12, fontWeight: 900 }}>Em crescimento</div>
              <div style={ui.statValue}>{gardenStats.growing}</div>
            </div>
            <div style={ui.statCard}>
              <div style={{ color: "var(--hdud-muted)", fontSize: 12, fontWeight: 900 }}>Em ebulição</div>
              <div style={ui.statValue}>{gardenStats.boiling}</div>
            </div>
            <div style={ui.statCard}>
              <div style={{ color: "var(--hdud-muted)", fontSize: 12, fontWeight: 900 }}>Já vinculadas a capítulos</div>
              <div style={ui.statValue}>{gardenStats.linkedToChapters}</div>
            </div>
          </div>

          {mode === "list" ? headerFilters : null}
        </div>

        {error ? (
          <div
            style={{
              background: "var(--hdud-danger-bg)",
              border: "1px solid var(--hdud-danger-border)",
              borderRadius: 16,
              padding: 12,
              marginBottom: 14,
              color: "var(--hdud-text)",
              fontWeight: 900,
            }}
          >
            {error}
          </div>
        ) : null}

        {mode === "create" ? (
          <div style={ui.card}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={ui.cardTitle}>Registrar</div>
                <div style={{ color: "var(--hdud-muted)", fontSize: 12, fontWeight: 800 }}>
                  Uma memória é a semente. O Jardim cuida do resto.
                </div>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={ui.label}>Título (opcional)</div>
              <input
                style={ui.input}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: A noite em que tudo começou"
              />
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={ui.label}>Conteúdo</div>
              <textarea
                style={ui.textarea}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Escreva aqui…"
              />
            </div>

            <div style={ui.createFooter}>
              <button type="button" style={ui.btnGhost} onClick={cancelCreate} disabled={creating}>
                Cancelar
              </button>
              <button type="button" style={ui.btnPrimary} onClick={create} disabled={creating}>
                {creating ? "Criando…" : "Criar memória"}
              </button>
            </div>
          </div>
        ) : null}

        {mode === "list" ? (
          <div className="hdud-garden-main-grid" style={ui.twoCols}>
            <div>
              <div style={ui.card}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                  <div style={ui.cardTitle}>Narrativas emergentes</div>
                  <div style={{ color: "var(--hdud-muted)", fontSize: 12, fontWeight: 900 }}>
                    Clusters locais • mock de descoberta narrativa
                  </div>
                </div>

                {clusters.length === 0 ? (
                  <div style={ui.empty}>
                    <p style={ui.emptyTitle}>Ainda não existem sinais suficientes.</p>
                    <div style={ui.emptyText}>
                      Registre mais memórias e o Jardim começará a revelar agrupamentos naturalmente.
                    </div>
                  </div>
                ) : (
                  <>
                    <LivingEcosystem
                      title="Epicentro vivo"
                      subtitle="As conexões mais fortes do momento aparecem primeiro. O Jardim já está reconhecendo o que quer nascer."
                      items={ecosystemStories}
                      onOpen={(href) => setSelectedClusterId(href)}
                      variant="card"
                    />

                    <div style={ui.narrativeGrid}>
                      {clusters.map((cluster) => {
                        const active = selectedCluster?.cluster_id === cluster.cluster_id;
                        const isEpicenter = epicenterCluster?.cluster_id === cluster.cluster_id;
                        const stageStyle =
                          cluster.stage === "ebulicao"
                            ? ui.signalPillBoiling
                            : ui.signalPill;

                        return (
                          <div
                            key={cluster.cluster_id}
                            style={{
                              ...(isEpicenter ? ui.epicenterCard : ui.clusterCard),
                              padding: isEpicenter ? 18 : 12,
                              zIndex: isEpicenter ? 2 : 1,
                              borderColor: active
                                ? isEpicenter
                                  ? "color-mix(in srgb, var(--hdud-warn-border) 100%, transparent)"
                                  : cluster.stage === "crescimento"
                                  ? "color-mix(in srgb, var(--hdud-accent-border) 100%, transparent)"
                                  : "color-mix(in srgb, var(--hdud-border) 100%, transparent)"
                                : isEpicenter
                                ? "color-mix(in srgb, var(--hdud-warn-border) 86%, transparent)"
                                : "color-mix(in srgb, var(--hdud-border) 82%, transparent)",
                              boxShadow: isEpicenter
                                ? "0 10px 30px rgba(0,0,0,0.08), 0 0 0 1px var(--hdud-warn-border)"
                                : active
                                ? "var(--hdud-shadow-2)"
                                : "var(--hdud-shadow-1)",
                              transform: isEpicenter
                                ? "translateY(-2px) scale(1.015)"
                                : active
                                ? "translateY(-1px)"
                                : "translateY(0)",
                              background:
                                isEpicenter
                                  ? "linear-gradient(120deg, rgba(255,255,255,0.0) 20%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0.0) 80%), radial-gradient(1100px 420px at 12% 12%, color-mix(in srgb, var(--hdud-warn-bg) 88%, transparent) 0%, transparent 52%), linear-gradient(180deg, var(--hdud-surface), color-mix(in srgb, var(--hdud-surface-2) 94%, transparent))"
                                  : (ui.clusterCard.background as string),
                              backgroundSize: isEpicenter ? "220% 100%, auto, auto" : undefined,
                              animation: isEpicenter ? "hdud-shimmer 4.2s linear infinite" : undefined,
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                              <div>
                                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                  <span style={stageStyle}>{formatStageLabel(cluster.stage)}</span>
                                  <span
                                    style={{
                                      ...ui.signalPill,
                                      background: "color-mix(in srgb, var(--hdud-success-bg) 94%, transparent)",
                                      borderColor: "color-mix(in srgb, var(--hdud-success-border) 72%, transparent)",
                                    }}
                                  >
                                    {cluster.energyLabel}
                                  </span>
                                  {isEpicenter ? <span style={ui.epicenterPill}>🔥 Epicentro vivo</span> : null}
                                </div>
                                <div style={{ fontSize: isEpicenter ? 24 : 18, fontWeight: 950, letterSpacing: -0.45, marginTop: 10 }}>
                                  {cluster.title}
                                </div>
                                <div style={{ color: "var(--hdud-muted)", fontSize: 12, fontWeight: 900, marginTop: 6 }}>
                                  {clusterNarrativeLine(cluster)}
                                </div>
                              </div>

                              <div style={{ textAlign: "right", minWidth: 120 }}>
                                <div style={{ fontSize: 12, color: "var(--hdud-muted)", fontWeight: 850 }}>
                                  confiança local
                                </div>
                                <div style={{ fontSize: 18, fontWeight: 950 }}>
                                  {Math.round(cluster.confidence * 100)}%
                                </div>
                              </div>
                            </div>

                            <div style={{ color: "var(--hdud-muted)", fontSize: isEpicenter ? 13 : 12, opacity: isEpicenter ? 1 : 0.86, lineHeight: 1.55, marginTop: 10 }}>
                              {cluster.summary}
                            </div>

                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                              {cluster.signals.map((signal) => (
                                <span key={signal} style={cluster.stage === "ebulicao" ? ui.signalPillBoiling : ui.signalPill}>
                                  {signal}
                                </span>
                              ))}
                            </div>

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
                              <div style={{ color: "var(--hdud-muted)", fontSize: 12, fontWeight: 900 }}>
                                {cluster.memory_count} memória(s) • {cluster.latestAt ? `pulso em ${formatDateBRShort(cluster.latestAt)}` : "sem data"}
                              </div>

                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                <button
                                  type="button"
                                  style={ui.btn}
                                  onClick={() => setSelectedClusterId(cluster.cluster_id)}
                                >
                                  Observar narrativa
                                </button>
                                <button
                                  type="button"
                                  style={ui.btnPrimary}
                                  onClick={() => transformClusterIntoChapter(cluster)}
                                  disabled={draftingClusterId === cluster.cluster_id}
                                >
                                  {draftingClusterId === cluster.cluster_id ? "Colhendo…" : "Colher capítulo"}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              <div style={{ marginTop: 20 }}>
                {momentBlock}
              </div>

              <div style={{ marginTop: 18 }}>
                <div style={ui.card}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                  <div style={ui.cardTitle}>Memórias cultivadas</div>
                  <div style={{ color: "var(--hdud-muted)", fontSize: 12, fontWeight: 900 }}>
                    Clique em qualquer memória para abrir o detalhe.
                  </div>
                </div>

                {loading ? (
                  <div style={{ color: "var(--hdud-muted)", fontWeight: 900 }}>Carregando…</div>
                ) : viewItems.length === 0 ? (
                  <div style={ui.empty}>
                    <p style={ui.emptyTitle}>Nada por aqui — por enquanto.</p>
                    <div style={ui.emptyText}>
                      Tente ajustar os filtros ou registre uma nova memória para fazer o Jardim florescer.
                    </div>
                  </div>
                ) : (
                  <div style={ui.listWrap}>
                    {viewItems.map((m) => {
                      const titleText = m.title?.trim() ? m.title.trim() : `Memória #${m.memory_id}`;
                      const when = formatDateBR(m.created_at);
                      const canEdit = m.meta?.can_edit === true;
                      const ver = m.meta?.current_version ? `v${m.meta.current_version}` : "v?";
                      const phaseLabel = safeTrim(m.meta?.phase_name) || safeTrim(m.meta?.life_phase) || "";
                      const isHover = hoverId === m.memory_id;

                      return (
                        <div
                          key={m.memory_id}
                          style={{ ...ui.row, ...(isHover ? ui.rowHover : null) }}
                          onMouseEnter={() => setHoverId(m.memory_id)}
                          onMouseLeave={() => setHoverId((v) => (v === m.memory_id ? null : v))}
                          onClick={() => openMemory(m.memory_id)}
                          title="Abrir memória"
                        >
                          <div style={ui.rowTop}>
                            <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                              <div style={ui.rowTitle}>{titleText}</div>
                              <div style={{ color: "var(--hdud-muted)", fontSize: 12, fontWeight: 900 }}>
                                #{m.memory_id} • {ver} • {canEdit ? "editável" : "somente leitura"}
                                {phaseLabel ? ` • ${phaseLabel}` : ""}
                              </div>
                            </div>
                            <div style={ui.rowMeta}>{when}</div>
                          </div>

                          <div style={ui.rowSub}>{m.content}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
                </div>
              </div>
            </div>

            <div>
              <div style={ui.detailCard}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                  <div style={ui.cardTitle}>Leitura narrativa</div>
                  {selectedCluster ? (
                    <span style={selectedCluster.stage === "ebulicao" ? ui.signalPillBoiling : ui.signalPill}>
                      {formatStageLabel(selectedCluster.stage)}
                    </span>
                  ) : null}
                </div>

                {!selectedCluster ? (
                  <div style={ui.empty}>
                    <p style={ui.emptyTitle}>Sem narrativa selecionada.</p>
                    <div style={ui.emptyText}>Escolha um bloco de narrativa emergente para ver os sinais.</div>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 950, color: "var(--hdud-muted)", letterSpacing: 0.25, textTransform: "uppercase" }}>
                      {clusterNarrativeLine(selectedCluster)}
                    </div>
                    <div style={{ fontSize: 24, fontWeight: 950, letterSpacing: -0.5, marginTop: 8 }}>
                      {selectedCluster.suggested_chapter_title}
                    </div>
                    <div style={{ color: "var(--hdud-muted)", marginTop: 8, lineHeight: 1.55 }}>
                      Aqui existe densidade emocional suficiente para se tornar um capítulo. O Jardim detectou aproximação,
                      recorrência e força simbólica.
                    </div>
                    <div style={{ color: "var(--hdud-muted)", marginTop: 10, lineHeight: 1.55 }}>
                      {selectedCluster.summary}
                    </div>

                    <div style={{ marginTop: 16 }}>
                      <div style={ui.cardTitle}>Sinais detectados</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {selectedCluster.signals.map((signal) => (
                          <span key={signal} style={selectedCluster.stage === "ebulicao" ? ui.signalPillBoiling : ui.signalPill}>
                            {signal}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div style={{ marginTop: 16 }}>
                      <div style={ui.cardTitle}>Memórias que sustentam esta narrativa</div>
                      <div style={{ display: "grid", gap: 10 }}>
                        {selectedCluster.memories.map((memory) => (
                          <div
                            key={memory.memory_id}
                            style={{
                              border: "1px solid color-mix(in srgb, var(--hdud-border) 80%, transparent)",
                              borderRadius: 16,
                              padding: 12,
                              background: "color-mix(in srgb, var(--hdud-surface) 95%, transparent)",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                              <div style={{ fontWeight: 900 }}>{memory.title}</div>
                              <div style={{ color: "var(--hdud-muted)", fontSize: 12, fontWeight: 800 }}>
                                {memory.atIso ? formatDateBRShort(memory.atIso) : "sem data"}
                              </div>
                            </div>
                            <div style={{ color: "var(--hdud-muted)", marginTop: 6, fontSize: 13, lineHeight: 1.45 }}>
                              {memory.preview}
                            </div>
                            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                              {memory.phaseLabel ? <span style={ui.signalPill}>{memory.phaseLabel}</span> : null}
                              {memory.chapter_id ? (
                                <span style={ui.signalPill}>já vinculada ao capítulo #{memory.chapter_id}</span>
                              ) : (
                                <span style={ui.signalPill}>ainda livre para colheita</span>
                              )}
                              <button type="button" style={ui.btnGhost} onClick={() => openMemory(memory.memory_id)}>
                                Abrir memória
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ marginTop: 18 }}>
                      <div style={ui.cardTitle}>Próxima jogada</div>
                      <div style={{ color: "var(--hdud-muted)", fontSize: 13, lineHeight: 1.55 }}>
                        O Jardim detecta a aproximação entre memórias. O capítulo só nasce quando você aceita a colheita.
                        Nada será persistido sem sua ação explícita no editor.
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
                      <button
                        type="button"
                        style={ui.btnPrimary}
                        onClick={() => transformClusterIntoChapter(selectedCluster)}
                        disabled={draftingClusterId === selectedCluster.cluster_id}
                      >
                        {draftingClusterId === selectedCluster.cluster_id ? "Colhendo…" : "Colher capítulo"}
                      </button>
                      <button type="button" style={ui.btn} onClick={() => setSelectedClusterId(epicenterCluster?.cluster_id ?? clusters[0]?.cluster_id ?? null)}>
                        Voltar ao epicentro
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
