// C:\HDUD_DATA\hdud-web-app\src\features\timeline\types.ts

export type TimelineKind = "Memória" | "Capítulo" | "Versão" | "Rollback" | "Evento";

export type TimelineEventSource =
  | "memories"
  | "chapters"
  | "versions"
  | "ledger"
  | "unknown";

export type TimelineEvent = {
  id: string;
  at: string;
  title: string;
  kind: TimelineKind;
  note?: string;
  source?: TimelineEventSource;
  raw?: any;
};

export type TimelineThread = {
  id: string;
  lead: TimelineEvent;
  events: TimelineEvent[];
  count: number;
  latestAt: string;
  latestMs: number;
  score: number;
  kind: TimelineKind;
};

export type ThreadEventSummary = {
  key: string;
  label: string;
  count: number;
  latestAt: string;
  latestMs: number;
  events: TimelineEvent[];
  leadEvent: TimelineEvent;
};

export type TimelineResponse = {
  ok?: boolean;
  items?: any[];
  warnings?: string[];
  meta?: any;
};

export type FilterKey = "Tudo" | "Memórias" | "Capítulos";
export type EditorialCardLevel = "hero" | "standard" | "base";
export type InventoryEntity = "memories" | "chapters";
export type InventoryScopeKind = "author" | "global" | "mixed" | "unknown";

export type InventoryDiagnostics = {
  authorId: number | null;
  memoriesScope: InventoryScopeKind;
  chaptersScope: InventoryScopeKind;
  memoriesRouteUsed: string | null;
  chaptersRouteUsed: string | null;
  warnings: string[];
};

export type NarrativeSummary = {
  topTitle: string;
  threads: number;
  chapters: number;
  memories: number;
  heroKind: TimelineKind;
  heroScore: number;
};

export type ChapterSuggestionItem = {
  id: string;
  title: string;
  rationale: string;
  basedOn: string[];
};

export type IntelligencePanel = {
  dominantChapter: string | null;
  dominantChapterScore: number;
  dominantChapterThread: TimelineThread | null;
  pivotMemory: string | null;
  pivotMemoryScore: number;
  pivotMemoryThread: TimelineThread | null;
  topEvent: TimelineEvent | null;
  topEventScore: number;
  executiveReading: string;
  investorSummary: string;
  chapterSuggestions: ChapterSuggestionItem[];
};