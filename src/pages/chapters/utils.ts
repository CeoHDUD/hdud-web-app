// C:\HDUD_DATA\hdud-web-app\src\pages\chapters\utils.ts

import type {
  ApiChapterDetail,
  ApiChapterListItem,
  ChapterMemoryItem,
  ChapterStatus,
  Snapshot,
} from "./types";

export const DEFAULT_NEW_TITLE = "Novo capítulo";
export const DEFAULT_NEW_DESCRIPTION = "";

export function formatDateBR(v?: string | null) {
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

export function formatDateBRShort(v?: string | null) {
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

export function safeTrimOrNull(v: any): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

export function greetingPTBR(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Bom dia";
  if (h >= 12 && h < 18) return "Boa tarde";
  return "Boa noite";
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function daysAgoLabel(fromIso: string): string {
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

export function toStatus(v: any): ChapterStatus {
  return v === "PUBLIC" ? "PUBLIC" : "DRAFT";
}

export function unwrapList(data: any): ApiChapterListItem[] | null {
  if (!data) return null;
  if (Array.isArray(data)) return data as ApiChapterListItem[];
  if (Array.isArray((data as any).items)) return (data as any).items as ApiChapterListItem[];
  if (Array.isArray((data as any).chapters)) return (data as any).chapters as ApiChapterListItem[];
  if ((data as any).data && Array.isArray((data as any).data.items)) return (data as any).data.items as ApiChapterListItem[];
  if ((data as any).data && Array.isArray((data as any).data.chapters)) return (data as any).data.chapters as ApiChapterListItem[];
  return null;
}

export function unwrapDetail(data: any): ApiChapterDetail | any | null {
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

export function extractErrMsg(data: any): string {
  if (!data) return "";
  return String(data?.detail || data?.error || data?.message || data?.msg || "").trim();
}

export function extractLinkedChapterIdFromConflict(data: any): number | null {
  if (!data) return null;

  const raw =
    data.current_chapter_id ??
    data.currentChapterId ??
    data.chapter_id ??
    data.chapterId ??
    data?.meta?.current_chapter_id;

  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function isConflictAlreadyLinked(status: number, data: any): boolean {
  if (status !== 409) return false;
  const code = String(data?.code || data?.error_code || data?.name || "").toUpperCase();
  if (code.includes("MEMORY") && code.includes("LINK")) return true;
  const msg = extractErrMsg(data).toLowerCase();
  if (msg.includes("já") && msg.includes("vincul")) return true;
  if (msg.includes("already") && msg.includes("link")) return true;
  return true;
}

export function formatAttempts(attempts: Array<{ path: string; status: number; ok: boolean }>) {
  if (!attempts.length) return "";
  const short = attempts
    .slice(0, 4)
    .map((a, idx) => `${idx + 1}) ${a.path} → ${a.status || "erro"}`)
    .join(" | ");
  return attempts.length > 4 ? `${short} | …` : short;
}

export function consumeOpenChapterHint(): number | null {
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

export function normText(v: any): string {
  const s = String(v ?? "");
  const noBom = s.replace(/^\uFEFF/, "");
  const lf = noBom.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const trimLineEnds = lf.replace(/[ \t]+$/gm, "");
  const trimEndNewlines = trimLineEnds.replace(/\n+$/g, "\n");
  return trimEndNewlines;
}

export function normTitle(v: any): string {
  return String(v ?? "");
}

export function normDesc(v: any): string {
  return String(v ?? "");
}

export function normSnap(s: Snapshot): Snapshot {
  return {
    title: normTitle(s.title),
    description: normDesc(s.description),
    body: normText(s.body),
    status: s.status,
  };
}

export function diffDirty(current: Snapshot, snap: Snapshot) {
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

export function safeText(v: any, max = 240) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

export function sortChapterMemoriesNarrative(list: ChapterMemoryItem[]) {
  return list
    .slice()
    .sort((a, b) => {
      const ao = a.sort_order;
      const bo = b.sort_order;
      const aNull = ao == null || !Number.isFinite(Number(ao));
      const bNull = bo == null || !Number.isFinite(Number(bo));

      if (aNull && !bNull) return 1;
      if (!aNull && bNull) return -1;
      if (!aNull && !bNull) return Number(ao) - Number(bo);

      const ad = new Date(a.linked_at || a.created_at || 0).getTime();
      const bd = new Date(b.linked_at || b.created_at || 0).getTime();
      if (ad !== bd) return ad - bd;
      return (a.memory_id || 0) - (b.memory_id || 0);
    });
}

export function buildEffectiveOrders(list: ChapterMemoryItem[]) {
  const nonNull = list
    .map((x) => (x.sort_order != null && Number.isFinite(Number(x.sort_order)) ? Number(x.sort_order) : null))
    .filter((x) => x != null) as number[];

  const max = nonNull.length ? Math.max(...nonNull) : 0;
  const narrative = sortChapterMemoriesNarrative(list);

  let next = max + 1;

  return narrative.map((m) => {
    const has = m.sort_order != null && Number.isFinite(Number(m.sort_order));
    const eff = has ? Number(m.sort_order) : next++;
    return { ...m, _eff: eff };
  });
}