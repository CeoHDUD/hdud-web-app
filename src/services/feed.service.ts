// C:\HDUD_DATA\hdud-web-app\src\services\feed.service.ts

import { apiGet } from "../lib/api";

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
  published_at?: string;
  current_version_id?: number | null;
  is_deleted?: boolean;
};

export type FeedSnapshot = {
  counts: {
    memoriesTotal: number;
    versionsTotal: number;
    rollbacksTotal: number;
    chaptersTotal: number;
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

function safeVersion(m: MemoryItem): number {
  const v = Number(m.version_number ?? 1);
  return Number.isFinite(v) && v > 0 ? v : 1;
}

function isNonDeleted(x: { is_deleted?: boolean } | null | undefined) {
  return !!x && !x.is_deleted;
}

function normalizeChaptersPayload(data: any): ChapterItem[] {
  if (!data) return [];
  if (Array.isArray(data?.chapters)) return data.chapters;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items; // ✅ backend /chapters => {items}
  return [];
}

// Mantém best-effort (snapshot)
export async function fetchAuthorMemories(_token: string, authorId: number): Promise<MemoryItem[]> {
  const data = await apiGet<ListMemoriesResponse>(`/authors/${authorId}/memories`);
  return Array.isArray((data as any)?.memories) ? (data as any).memories : [];
}

/**
 * ✅ Preferência total ao contrato OFICIAL:
 * - GET /chapters (author do token)
 */
export async function fetchAuthorChapters(_token: string, authorId: number): Promise<ChapterItem[]> {
  const attempts: Array<() => Promise<any>> = [
    () => apiGet<any>(`/chapters`),

    // tentativas antigas (mantidas por compat, mas por último)
    () => apiGet<any>(`/authors/${authorId}/chapters`),
    () => apiGet<any>(`/chapters?author_id=${authorId}`),
    () => apiGet<any>(`/chapters/${authorId}`),
  ];

  for (const run of attempts) {
    try {
      const data = await run();
      return normalizeChaptersPayload(data).filter(isNonDeleted);
    } catch {
      // tenta próxima rota
    }
  }
  return [];
}

export function buildFeedSnapshot(memories: MemoryItem[], chaptersTotalOverride = 0): FeedSnapshot {
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
    counts: { memoriesTotal, versionsTotal, rollbacksTotal: 0, chaptersTotal },
    recentMemories,
  };
}