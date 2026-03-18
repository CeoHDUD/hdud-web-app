// C:\HDUD_DATA\hdud-web-app\src\features\timeline\api.ts

import type { FilterKey, InventoryEntity } from "./types";

export const TIMELINE_LIMIT = 500;

export function tryExtractTokenFromValue(v: string): string | null {
  const s = (v || "").trim();
  if (!s) return null;

  if (s.split(".").length === 3) return s;

  try {
    const obj = JSON.parse(s);
    const candidates = [
      obj?.access_token,
      obj?.token,
      obj?.jwt,
      obj?.data?.access_token,
      obj?.data?.token,
    ];
    for (const t of candidates) {
      if (typeof t === "string" && t.trim().split(".").length === 3) return t.trim();
    }
  } catch {}

  return null;
}

export function getAuthToken(): string | null {
  const candidates = ["hdud_access_token", "HDUD_TOKEN", "access_token", "token"];

  for (const k of candidates) {
    const v = window.localStorage.getItem(k);
    if (!v) continue;

    const token = tryExtractTokenFromValue(v);
    if (token) return token;
  }

  return null;
}

export function parseJwtPayload(token: string): any | null {
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

export function getAuthorIdFromToken(token: string | null): number | null {
  if (!token) return null;
  const jwt = parseJwtPayload(token);
  const authorIdRaw = jwt?.author_id ?? jwt?.authorId ?? jwt?.sub_author_id ?? null;
  const authorId = Number(authorIdRaw);
  return Number.isFinite(authorId) && authorId > 0 ? authorId : null;
}

export function getApiBase(): string {
  const env = (import.meta as any).env || {};
  const base =
    env.VITE_API_BASE || env.VITE_API_URL || env.VITE_BACKEND_URL || env.VITE_API || "";
  return String(base || "")
    .trim()
    .replace(/\/+$/, "");
}

export function normalizeUrl(path: string): string {
  const base = getApiBase();
  if (!path.startsWith("/")) path = `/${path}`;
  return base ? `${base}${path}` : path;
}

export function buildTimelineUrl(filter: FilterKey, query: string): string {
  const params = new URLSearchParams();
  params.set("limit", String(TIMELINE_LIMIT));

  const q = String(query || "").trim();
  if (q) params.set("q", q);

  if (filter === "Memórias") params.set("type", "memory");
  else if (filter === "Capítulos") params.set("type", "chapter");

  return `/api/timeline?${params.toString()}`;
}

export function looksLikeHtml(value: any): boolean {
  if (typeof value !== "string") return false;
  const s = value.trim().toLowerCase();
  return (
    s.startsWith("<!doctype html") ||
    s.startsWith("<html") ||
    s.includes("<head") ||
    s.includes("<body")
  );
}

export async function fetchTimeline(
  token: string | null,
  filter: FilterKey,
  query: string
): Promise<{ ok: boolean; status: number; data: any; usedUrl: string; authSent: boolean }> {
  const authSent = Boolean(token);
  const primaryPath = buildTimelineUrl(filter, query);
  const fallbackPath = primaryPath.replace(/^\/api/, "") || "/timeline";
  const tries = [primaryPath, fallbackPath];

  let last: { ok: boolean; status: number; data: any; usedUrl: string; authSent: boolean } = {
    ok: false,
    status: 0,
    data: null,
    usedUrl: normalizeUrl(primaryPath),
    authSent,
  };

  for (const p of tries) {
    const usedUrl = normalizeUrl(p);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    const r = await fetch(usedUrl, { headers, cache: "no-store" });
    const text = await r.text();

    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    const candidate = { ok: r.ok, status: r.status, data, usedUrl, authSent };
    last = candidate;

    if (looksLikeHtml(data)) continue;
    if (r.ok && data && typeof data === "object" && Array.isArray(data.items)) return candidate;
    if (r.ok && data && typeof data === "object") return candidate;
    if (r.status === 401) return candidate;
  }

  return last;
}

export async function fetchJsonDirect(
  path: string,
  token: string | null
): Promise<{ ok: boolean; status: number; data: any; usedUrl: string }> {
  const usedUrl = normalizeUrl(path);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const r = await fetch(usedUrl, { headers, cache: "no-store" });
  const text = await r.text();

  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  return { ok: r.ok, status: r.status, data, usedUrl };
}

export async function fetchInventoryWithFallback(
  entity: InventoryEntity,
  token: string,
  authorId: number | null
): Promise<{
  ok: boolean;
  status: number;
  data: any;
  usedUrl: string | null;
  usedPath: string | null;
}> {
  void authorId;

  const tries = entity === "memories" ? ["/api/memories"] : ["/api/chapters"];

  let last = {
    ok: false,
    status: 0,
    data: null as any,
    usedUrl: null as string | null,
    usedPath: null as string | null,
  };

  for (const path of tries as string[]) {
    const result = await fetchJsonDirect(path, token);
    last = {
      ok: result.ok,
      status: result.status,
      data: result.data,
      usedUrl: result.usedUrl,
      usedPath: path,
    };

    if (looksLikeHtml(result.data)) continue;
    if (result.ok) return last;
    if (result.status === 401) return last;
  }

  return last;
}