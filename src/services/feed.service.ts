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

export type FeedSnapshot = {
  counts: {
    memoriesTotal: number;
    versionsTotal: number; // heurística segura: soma dos version_number (ou 1)
    rollbacksTotal: number; // ainda não existe endpoint -> placeholder
    chaptersTotal: number; // ainda não existe endpoint -> placeholder
  };
  recentMemories: Array<{
    memory_id: number;
    title: string;
    created_at: string;
    version_number: number;
  }>;
};

type ListResponse = {
  author_id: number;
  memories: MemoryItem[];
};

function safeVersion(m: MemoryItem): number {
  const v = Number(m.version_number ?? 1);
  return Number.isFinite(v) && v > 0 ? v : 1;
}

export async function fetchAuthorMemories(
  token: string,
  authorId: number
): Promise<MemoryItem[]> {
  const data = await apiJson<ListResponse>(`/authors/${authorId}/memories`, token);
  return Array.isArray(data?.memories) ? data.memories : [];
}

/**
 * Snapshot “inteligente” sem inventar lógica:
 * - memóriasTotal: quantidade de memórias não deletadas
 * - versionsTotal: soma dos version_number atuais (proxy simples de “versões registradas”)
 * - rollbacksTotal/chaptersTotal: 0 (placeholder) até existirem endpoints
 * - recentMemories: top 3 mais recentes
 */
export function buildFeedSnapshot(memories: MemoryItem[]): FeedSnapshot {
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

  return {
    counts: {
      memoriesTotal,
      versionsTotal,
      rollbacksTotal: 0,
      chaptersTotal: 0,
    },
    recentMemories,
  };
}
