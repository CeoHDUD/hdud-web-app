// C:\HDUD_DATA\hdud-web-app\src\lib\api.ts

export type ApiErrorShape = {
  error?: string;
  detail?: string;
};

export class ApiError extends Error {
  status: number;
  payload?: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

// =========================
// Auth notice (usado no Login.tsx)
// =========================
export const HDUD_AUTH_NOTICE_KEY = "hdud_auth_notice";
export const HDUD_AUTH_NOTICE_EXPIRED = "expired";

export function setSessionExpiredNotice() {
  try {
    sessionStorage.setItem(HDUD_AUTH_NOTICE_KEY, HDUD_AUTH_NOTICE_EXPIRED);
  } catch {}
}

export function parseJsonSafe(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// =========================
// BASE URL (DEV vs PROD)
// =========================
function isViteDev(): boolean {
  try {
    return typeof window !== "undefined" && String(window.location?.port || "") === "5173";
  } catch {
    return false;
  }
}

/**
 * Normaliza base URL:
 * - remove trailing slash
 * - rejeita "" "/" "." "./"
 * - se vier apenas origin (http://localhost:5173) -> força /api
 */
function normalizeBaseUrl(raw: any): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;

  if (s === "/" || s === "." || s === "./") return null;

  // se alguém colocar apenas origin (ex: http://localhost:5173) -> força /api
  if (/^https?:\/\/[^/]+$/i.test(s)) return `${s}/api`;

  // remove trailing slash
  return s.endsWith("/") ? s.slice(0, -1) : s;
}

/**
 * Base URL:
 * - DEV (Vite 5173): default => http://127.0.0.1:4000  (não depende de proxy)
 * - PROD (nginx): default => /api
 *
 * Prioridade: VITE_API_BASE_URL > VITE_API_BASE > default seguro
 */
function getBaseUrl(): string {
  const env = (import.meta as any).env || {};
  const envBaseUrl = normalizeBaseUrl(env.VITE_API_BASE_URL);
  const envBase = normalizeBaseUrl(env.VITE_API_BASE);

  const picked = envBaseUrl || envBase;

  // ✅ DEV: se não tiver env, aponta direto para a API real (evita cair no SPA)
  if (isViteDev()) {
    return picked || "http://127.0.0.1:4000";
  }

  // ✅ PROD/DOCKER: nginx proxy /api
  return picked || "/api";
}

// ✅ Compat (alguns imports antigos usam API_BASE)
export const API_BASE = getBaseUrl();

// ✅ Handler global para 401/jwt expired (registrado pelo App.tsx)
let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(fn: (() => void) | null) {
  unauthorizedHandler = fn;
}

// =========================
// TOKENS (Access + Refresh)
// =========================
function getAccessToken(): string | null {
  return (
    localStorage.getItem("HDUD_TOKEN") ||
    localStorage.getItem("hdud_access_token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    null
  );
}

function setAccessToken(token: string) {
  localStorage.setItem("HDUD_TOKEN", token);
  localStorage.setItem("hdud_access_token", token);
  localStorage.setItem("access_token", token);
  localStorage.setItem("token", token);
}

function getRefreshToken(): string | null {
  return localStorage.getItem("hdud_refresh_token") || localStorage.getItem("refresh_token");
}

function setRefreshToken(refresh: string) {
  localStorage.setItem("hdud_refresh_token", refresh);
  localStorage.setItem("refresh_token", refresh);
}

export function setAuthTokens(access_token: string, refresh_token?: string) {
  if (access_token) setAccessToken(access_token);
  if (refresh_token) setRefreshToken(refresh_token);
}

export function clearAuthTokens() {
  localStorage.removeItem("HDUD_TOKEN");
  localStorage.removeItem("hdud_access_token");
  localStorage.removeItem("access_token");
  localStorage.removeItem("token");
  localStorage.removeItem("hdud_refresh_token");
  localStorage.removeItem("refresh_token");
}

// ============================
// Refresh + Retry
// ============================
type ApiRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: any;
  headers?: Record<string, string>;
  skipAuthRetry?: boolean;
};

let refreshInFlight: Promise<{ access_token: string; refresh_token?: string } | null> | null = null;

let unauthorizedFiredAtMs = 0;
const UNAUTHORIZED_DEBOUNCE_MS = 1500;

function extractAccessTokenFromPayload(payload: any): string | null {
  if (!payload) return null;

  const token =
    payload.access_token ||
    payload.token ||
    payload.accessToken ||
    payload.jwt ||
    payload.data?.access_token ||
    payload.data?.token ||
    payload.data?.accessToken ||
    payload.data?.jwt;

  return typeof token === "string" && token.trim() ? token.trim() : null;
}

function extractRefreshTokenFromPayload(payload: any): string | null {
  if (!payload) return null;

  const rt =
    payload.refresh_token ||
    payload.refreshToken ||
    payload.data?.refresh_token ||
    payload.data?.refreshToken;

  return typeof rt === "string" && rt.trim() ? rt.trim() : null;
}

async function refreshTokenOnce(baseUrl: string): Promise<{ access_token: string; refresh_token?: string } | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const url = `${baseUrl}/auth/refresh`;
    const refresh_token = getRefreshToken();
    if (!refresh_token) return null;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token }),
    });

    const ct = res.headers.get("content-type") || "";
    const isJson = ct.includes("application/json");

    let payload: any = undefined;
    try {
      payload = isJson ? await res.json() : await res.text();
    } catch {}

    if (!res.ok) return null;

    const newAccess = extractAccessTokenFromPayload(payload);
    if (!newAccess) return null;

    const rotatedRefresh = extractRefreshTokenFromPayload(payload) || undefined;

    setAccessToken(newAccess);
    if (rotatedRefresh) setRefreshToken(rotatedRefresh);

    return { access_token: newAccess, refresh_token: rotatedRefresh };
  })()
    .catch(() => null)
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

function isRefreshEndpoint(path: string) {
  return path === "/auth/refresh" || path.endsWith("/auth/refresh");
}

async function callUnauthorizedHandlerSafe() {
  const now = Date.now();
  if (now - unauthorizedFiredAtMs < UNAUTHORIZED_DEBOUNCE_MS) return;
  unauthorizedFiredAtMs = now;

  try {
    unauthorizedHandler?.();
  } catch {}
}

function normalizeOptionsForRefresh(path: string, options: ApiRequestOptions): ApiRequestOptions {
  if (!isRefreshEndpoint(path)) return options;

  const method = options.method || "GET";
  if (method !== "POST") return options;

  if (options.body !== undefined) return options;

  const rt = getRefreshToken();
  if (!rt) return options;

  return { ...options, body: { refresh_token: rt } };
}

// ✅ Guard: se cair no SPA e vier HTML, explode com mensagem certa
function assertNotHtml(payload: any, url: string) {
  if (typeof payload !== "string") return;
  const s = payload.trim();
  if (s.startsWith("<!doctype html") || s.startsWith("<!DOCTYPE html") || s.includes("<html")) {
    throw new ApiError(
      `API retornou HTML (SPA) em vez de JSON.
Isso indica chamada para FRONT ao invés do BACKEND.

URL chamada: ${url}

Verifique:
- DEV: base deve ser http://127.0.0.1:4000 (ou VITE_API_BASE_URL)
- PROD: base deve ser /api (nginx proxy)`,
      200,
      payload
    );
  }
}

async function apiRequestInternal<T = any>(
  path: string,
  options: ApiRequestOptions = {},
  attempt: number = 0
): Promise<T> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}${path}`;

  const normalizedOptions = normalizeOptionsForRefresh(path, options);

  const token = getAccessToken();

  const headers: Record<string, string> = { ...(normalizedOptions.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const isFormData = typeof FormData !== "undefined" && normalizedOptions.body instanceof FormData;
  if (normalizedOptions.body !== undefined && !isFormData) headers["Content-Type"] = "application/json";

  const res = await fetch(url, {
    method: normalizedOptions.method || "GET",
    headers,
    body:
      normalizedOptions.body === undefined
        ? undefined
        : isFormData
        ? normalizedOptions.body
        : JSON.stringify(normalizedOptions.body),
    cache: "no-store",
  });

  const ct = res.headers.get("content-type") || "";
  const isJson = ct.includes("application/json");

  let payload: any = undefined;
  try {
    payload = isJson ? await res.json() : await res.text();
  } catch {}

  assertNotHtml(payload, url);

  if (res.status === 401) {
    const skip = normalizedOptions.skipAuthRetry === true || isRefreshEndpoint(path) === true;

    if (!skip && attempt === 0) {
      const refreshed = await refreshTokenOnce(baseUrl);
      if (refreshed?.access_token) return apiRequestInternal<T>(path, options, 1);
    }

    setSessionExpiredNotice();
    await callUnauthorizedHandlerSafe();

    const msg = (payload && (payload.detail || payload.error)) || `HTTP 401 Unauthorized`;
    throw new ApiError(msg, 401, payload);
  }

  if (res.status === 403) {
    await callUnauthorizedHandlerSafe();
    const msg = (payload && (payload.detail || payload.error)) || `HTTP 403 Forbidden`;
    throw new ApiError(msg, 403, payload);
  }

  if (!res.ok) {
    const msg = (payload && (payload.detail || payload.error)) || `HTTP ${res.status} ${res.statusText}`;
    throw new ApiError(msg, res.status, payload);
  }

  return payload as T;
}

export async function apiRequest<T = any>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  return apiRequestInternal<T>(path, options, 0);
}

export function apiGet<T = any>(path: string) {
  return apiRequest<T>(path, { method: "GET" });
}

export function apiPost<T = any>(path: string, body?: any) {
  return apiRequest<T>(path, { method: "POST", body });
}

export function apiPut<T = any>(path: string, body?: any) {
  return apiRequest<T>(path, { method: "PUT", body });
}

export const apiFetch = apiRequest;

export async function tryRefreshNow(): Promise<boolean> {
  const baseUrl = getBaseUrl();
  const refreshed = await refreshTokenOnce(baseUrl);
  return !!refreshed?.access_token;
}