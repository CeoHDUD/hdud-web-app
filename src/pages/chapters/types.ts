// C:\HDUD_DATA\hdud-web-app\src\pages\chapters\types.ts

export type ChapterStatus = "DRAFT" | "PUBLIC";
export type StatusFilter = "ALL" | "DRAFT" | "PUBLIC";
export type SortKey = "RECENT" | "OLD" | "TITLE";

export type ApiChapterListItem = {
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

export type ApiChapterDetail = {
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

export type ChapterMemoryItem = {
  memory_id: number;
  author_id?: number;
  title?: string | null;
  content?: string | null;
  created_at?: string | null;
  version_number?: number | null;
  phase_id?: number | null;
  life_phase?: string | null;
  phase_name?: string | null;
  sort_order?: number | null;
  linked_at?: string | null;
};

export type ApiChapterMemoriesResponse = {
  chapter_id: number;
  items: ChapterMemoryItem[];
};

export type ApiMemoriesAliasResponse = {
  author_id: number;
  memories: any[];
};

export type ToastKind = "ok" | "warn" | "err";
export type Toast = { kind: ToastKind; msg: string };

export type Snapshot = {
  title: string;
  description: string;
  body: string;
  status: ChapterStatus;
};

export type MoveLinkState =
  | null
  | {
      open: true;
      memory_id: number;
      from_chapter_id: number;
      to_chapter_id: number;
      title?: string | null;
    };

export type TryResult<T> = {
  ok: boolean;
  status: number;
  data: T | null;
  usedIndex: number;
  usedPath: string;
  attempts: Array<{ path: string; status: number; ok: boolean }>;
};