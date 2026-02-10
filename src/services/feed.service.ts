// C:\HDUD_DATA\hdud-web-app\src\services\feed.service.ts

import { apiJson } from "../api/http";

export type MemoryItem = {
  memory_id: number;
  author_id: number;
  title: string | null;
  content: string | null;
  created_at: string;
  version_number?: number;
  is_deleted?: boolean;
};

export type ChapterItem = {
  chapter_id: number;
  author_id: number;
  title: string | null;
  description?: string | null;
  status?: string | null;
  created_at?: string;
  updated_at?: string;
  is_deleted?: boolean;
};

export type FeedSnapshot = {
  counts: {
    memoriesTotal: number;
    versionsTotal: number; // heurística segura: soma dos version_number (ou 1)
    rollbacksTotal: number; // ainda não existe endpoint -> placeholder
    chaptersTotal: number; // agora: best-effort via endpoint(s) do front
  };
  recentMemories: Array<{
    memory_id: number;
    title: string;
    created_at: string;
    version_number: number;
  }>;
};

type ListMemoriesResponse = {
  author_id: number;
  memories: MemoryItem[];
};

type ListChaptersResponseA = {
  author_id: number;
  chapters: ChapterItem[];
};

function safeVersion(m: MemoryItem): number {
  const v = Number(m.version_number ?? 1);
  return Number.isFinite(v) && v > 0 ? v : 1;
}

function isNonDeleted(x: { is_deleted?: boolean } | null | undefined) {
  return !!x && !x.is_deleted;
}

function normalizeChaptersPayload(data: any): ChapterItem[] {
  if (!data) return [];

  // formato A: { chapters: [...] }
  if (Array.isArray(data?.chapters)) return data.chapters;

  // formato B: [...] direto
  if (Array.isArray(data)) return data;

  // formato C: { items: [...] }
  if (Array.isArray(data?.items)) return data.items;

  return [];
}

export async function fetchAuthorMemories(
  token: string,
  authorId: number
): Promise<MemoryItem[]> {
  const data = await apiJson<ListMemoriesResponse>(`/authors/${authorId}/memories`, token);
  return Array.isArray(data?.memories) ? data.memories : [];
}

/**
 * Best-effort: tenta descobrir capítulos sem depender de contrato novo.
 * Se o endpoint não existir, retorna [] sem quebrar o Feed.
 */
export async function fetchAuthorChapters(
  token: string,
  authorId: number
): Promise<ChapterItem[]> {
  const attempts: Array<() => Promise<any>> = [
    // mais provável (espelhando memórias)
    () => apiJson<ListChaptersResponseA>(`/authors/${authorId}/chapters`, token),

    // fallback comum
    () => apiJson<any>(`/chapters?author_id=${authorId}`, token),

    // fallback alternativo
    () => apiJson<any>(`/chapters/${authorId}`, token),
  ];

  for (const run of attempts) {
    try {
      const data = await run();
      const chapters = normalizeChaptersPayload(data).filter(isNonDeleted);
      if (chapters.length >= 0) return chapters; // se respondeu, aceitamos (mesmo vazio)
    } catch {
      // tenta próxima rota
    }
  }

  return [];
}

/**
 * Snapshot “inteligente” sem inventar lógica:
 * - memóriasTotal: quantidade de memórias não deletadas
 * - versionsTotal: soma dos version_number atuais (proxy simples de “versões registradas”)
 * - rollbacksTotal: 0 (placeholder) até existirem endpoints
 * - chaptersTotal: best-effort (passado como parâmetro)
 * - recentMemories: top 3 mais recentes
 */
export function buildFeedSnapshot(
  memories: MemoryItem[],
  chaptersTotalOverride = 0
): FeedSnapshot {
  const alive = (memories ?? []).filter((m) => !m.is_deleted);

  const memoriesTotal = alive.length;
  const versionsTotal = alive.reduce((acc, m) => acc + safeVersion(m), 0);

  const recentMemories = [...alive]
    .sort((a, b) => {
      const da = new Date(a.created_at).getTime();
      const db = new Date(b.created_at).getTime();
      return (Number.isFinite(db) ? db : 0) - (Number.isFinite(da) ? da : 0);
    })
    .slice(0, 3)
    .map((m) => ({
      memory_id: m.memory_id,
      title: (m.title ?? "").trim() || "Memória sem título",
      created_at: m.created_at,
      version_number: safeVersion(m),
    }));

  const chaptersTotal =
    Number.isFinite(Number(chaptersTotalOverride)) && Number(chaptersTotalOverride) >= 0
      ? Number(chaptersTotalOverride)
      : 0;

  return {
    counts: {
      memoriesTotal,
      versionsTotal,
      rollbacksTotal: 0,
      chaptersTotal,
    },
    recentMemories,
  };
}
