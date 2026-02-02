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

// Base URL: em produção (nginx) normalmente é "/api".
// Em dev (se existir) pode vir de env.
function getBaseUrl(): string {
  const envBase = (import.meta as any).env?.VITE_API_BASE as string | undefined;
  if (envBase && envBase.trim()) return envBase.trim();
  return "/api";
}

// ✅ Compat (alguns arquivos antigos importavam API_BASE como constante)
export const API_BASE = getBaseUrl();

// ✅ Handler global para 401/403 (registrado pelo App.tsx)
let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(fn: (() => void) | null) {
  unauthorizedHandler = fn;
}

export function parseJsonSafe(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * =========================
 * TOKENS (Access + Refresh)
 * =========================
 * - storage é a fonte de verdade
 * - mantém compat com chaves antigas
 */

export function getAccessToken(): string | null {
  return (
    localStorage.getItem("HDUD_TOKEN") ||
    localStorage.getItem("hdud_access_token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("token")
  );
}

function setAccessToken(token: string) {
  const t = String(token || "").trim();
  if (!t) return;

  localStorage.setItem("HDUD_TOKEN", t);
  localStorage.setItem("hdud_access_token", t);
  localStorage.setItem("access_token", t);
  localStorage.setItem("token", t);
}

function getRefreshToken(): string | null {
  return localStorage.getItem("hdud_refresh_token") || localStorage.getItem("refresh_token");
}

function setRefreshToken(refresh: string) {
  const rt = String(refresh || "").trim();
  if (!rt) return;

  localStorage.setItem("hdud_refresh_token", rt);
  localStorage.setItem("refresh_token", rt);
}

// ✅ usado pelo App.tsx (MVP)
export function clearHdudSession() {
  const keys = [
    // access compat
    "HDUD_TOKEN",
    "hdud_access_token",
    "access_token",
    "token",

    // refresh compat
    "hdud_refresh_token",
    "refresh_token",

    // outras chaves que aparecem no app
    "author_id",
    "HDUD_AUTHOR_ID",
    "user_id",
    "email",
  ];
  for (const k of keys) localStorage.removeItem(k);
}

// ✅ mantido por compat (caso alguém importe)
export function clearAuthTokens() {
  clearHdudSession();
}

// Helper opcional: pode ser usado no Login
export function setAuthTokens(access_token: string, refresh_token?: string) {
  if (access_token) setAccessToken(access_token);
  if (refresh_token) setRefreshToken(refresh_token);
}

/**
 * ============================
 * Refresh + Retry (single-flight)
 * ============================
 */

type ApiRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: any;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /**
   * Se true: não tenta refresh/retry automático.
   * Útil para chamadas que NÃO podem disparar retry (ex.: o próprio /auth/refresh).
   */
  skipAuthRetry?: boolean;
};

let refreshInFlight: Promise<{ access_token: string; refresh_token?: string } | null> | null = null;

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

  const rt = payload.refresh_token || payload.refreshToken || payload.data?.refresh_token || payload.data?.refreshToken;

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

    const contentType = res.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");

    let payload: any = undefined;
    try {
      payload = isJson ? await res.json() : await res.text();
    } catch {
      // ignore
    }

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
  try {
    unauthorizedHandler?.();
  } catch {
    // ignore
  }
}

async function apiRequestInternal<T = any>(path: string, options: ApiRequestOptions = {}, attempt = 0): Promise<T> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}${path}`;

  const token = getAccessToken();

  const headers: Record<string, string> = {
    ...(options.headers || {}),
  };

  if (token) headers["Authorization"] = `Bearer ${token}`;

  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;

  if (options.body !== undefined && !isFormData) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body === undefined ? undefined : isFormData ? options.body : JSON.stringify(options.body),
    signal: options.signal,
  });

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  let payload: any = undefined;
  try {
    payload = isJson ? await res.json() : await res.text();
  } catch {
    // ignore
  }

  // ✅ 401/403: sessão inválida -> tenta refresh (apenas 401) + retry; senão derruba
  const isAuthFail = res.status === 401 || res.status === 403;

  if (isAuthFail) {
    const skip = options.skipAuthRetry === true || isRefreshEndpoint(path) === true;

    // Só tenta refresh para 401 (expirado). 403 -> derruba direto (perm negada / token inválido)
    if (res.status === 401 && !skip && attempt === 0) {
      const refreshed = await refreshTokenOnce(baseUrl);
      if (refreshed?.access_token) {
        return apiRequestInternal<T>(path, options, 1);
      }
    }

    await callUnauthorizedHandlerSafe();

    const msg = (payload && (payload.detail || payload.error)) || `HTTP ${res.status} Unauthorized`;
    throw new ApiError(msg, res.status, payload);
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

export function apiGet<T = any>(path: string, signal?: AbortSignal) {
  return apiRequest<T>(path, { method: "GET", signal });
}

export function apiPost<T = any>(path: string, body?: any, signal?: AbortSignal) {
  return apiRequest<T>(path, { method: "POST", body, signal });
}

export function apiPut<T = any>(path: string, body?: any, signal?: AbortSignal) {
  return apiRequest<T>(path, { method: "PUT", body, signal });
}

// Compat
export const apiFetch = apiRequest;
