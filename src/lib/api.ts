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

// ✅ Handler global para 401/jwt expired (registrado pelo App.tsx)
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
 * Mantém compat com chaves antigas e adiciona refresh_token para o /auth/refresh real do backend.
 */

function getAccessToken(): string | null {
  return (
    localStorage.getItem("HDUD_TOKEN") ||
    localStorage.getItem("hdud_access_token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("token")
  );
}

function setAccessToken(token: string) {
  // Mantém compat com chaves antigas, mas define uma “fonte” primária.
  localStorage.setItem("HDUD_TOKEN", token);
  localStorage.setItem("hdud_access_token", token);
  localStorage.setItem("access_token", token);
  localStorage.setItem("token", token);
}

function getRefreshToken(): string | null {
  return (
    localStorage.getItem("hdud_refresh_token") ||
    localStorage.getItem("refresh_token")
  );
}

function setRefreshToken(refresh: string) {
  localStorage.setItem("hdud_refresh_token", refresh);
  localStorage.setItem("refresh_token", refresh);
}

export function clearAuthTokens() {
  // access (todas as chaves compat)
  localStorage.removeItem("HDUD_TOKEN");
  localStorage.removeItem("hdud_access_token");
  localStorage.removeItem("access_token");
  localStorage.removeItem("token");

  // refresh (novas chaves)
  localStorage.removeItem("hdud_refresh_token");
  localStorage.removeItem("refresh_token");
}

/**
 * ============================
 * Refresh + Retry (profissional)
 * ============================
 */

type ApiRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: any;
  headers?: Record<string, string>;
  /**
   * Se true: não tenta refresh/retry automático.
   * Útil para chamadas que NÃO podem disparar retry (ex.: o próprio /auth/refresh).
   */
  skipAuthRetry?: boolean;
};

let refreshInFlight: Promise<{ access_token: string; refresh_token?: string } | null> | null = null;

function extractAccessTokenFromPayload(payload: any): string | null {
  if (!payload) return null;

  // Variações comuns:
  // { access_token }, { token }, { accessToken }, { jwt }
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
  // Single-flight: múltiplas requests 401 aguardam a mesma promise.
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const url = `${baseUrl}/auth/refresh`;
    const refresh_token = getRefreshToken();

    // Se não houver refresh_token, não há como renovar
    if (!refresh_token) return null;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // ✅ Contrato do backend: { refresh_token }
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

    // Persistir
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

async function apiRequestInternal<T = any>(
  path: string,
  options: ApiRequestOptions = {},
  attempt: number = 0
): Promise<T> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}${path}`;

  const token = getAccessToken();

  const headers: Record<string, string> = {
    ...(options.headers || {}),
  };

  // Autoriza sempre que houver token
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  if (options.body !== undefined && !isFormData) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    method: options.method || "GET",
    headers,
    body:
      options.body === undefined
        ? undefined
        : isFormData
        ? options.body
        : JSON.stringify(options.body),
  });

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  let payload: any = undefined;
  try {
    payload = isJson ? await res.json() : await res.text();
  } catch {
    // ignore
  }

  // ✅ 401: tenta refresh + retry automático (1 vez)
  if (res.status === 401) {
    const skip =
      options.skipAuthRetry === true || isRefreshEndpoint(path) === true;

    if (!skip && attempt === 0) {
      const refreshed = await refreshTokenOnce(baseUrl);

      if (refreshed?.access_token) {
        // Retry do request original com o token atualizado (já persistido).
        return apiRequestInternal<T>(path, options, 1);
      }
    }

    // Falhou refresh ou já tentou retry -> encerra sessão
    await callUnauthorizedHandlerSafe();

    const msg =
      (payload && (payload.detail || payload.error)) || `HTTP 401 Unauthorized`;
    throw new ApiError(msg, 401, payload);
  }

  if (!res.ok) {
    const msg =
      (payload && (payload.detail || payload.error)) ||
      `HTTP ${res.status} ${res.statusText}`;
    throw new ApiError(msg, res.status, payload);
  }

  return payload as T;
}

export async function apiRequest<T = any>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
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

// Compat: algumas páginas antigas importavam `apiFetch`.
// Mantemos como alias seguro para evitar quebrar build.
export const apiFetch = apiRequest;

/**
 * Helper opcional (se você quiser chamar no login):
 * - setAccessToken + setRefreshToken
 */
export function setAuthTokens(access_token: string, refresh_token?: string) {
  if (access_token) setAccessToken(access_token);
  if (refresh_token) setRefreshToken(refresh_token);
}
