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

function getToken(): string | null {
  return (
    localStorage.getItem("HDUD_TOKEN") ||
    localStorage.getItem("hdud_access_token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("token")
  );
}

type ApiRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: any;
  headers?: Record<string, string>;
};

export async function apiRequest<T = any>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}${path}`;

  const token = getToken();

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

  // ✅ Centraliza 401/jwt expired
  if (res.status === 401) {
    try {
      unauthorizedHandler?.();
    } catch {
      // ignore
    }
    const msg =
      (payload && (payload.detail || payload.error)) ||
      `HTTP 401 Unauthorized`;
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
