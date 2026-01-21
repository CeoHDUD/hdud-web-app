// C:\HDUD_DATA\hdud-web-app\src\api\http.ts

// Base HTTP do HDUD (vNext)
// - Não altera core
// - Centraliza API_BASE + parse de erro
// - Reutilizável por Feed/Chapters/Timeline futuramente

export const API_BASE = import.meta.env.VITE_API_BASE || "/api";

async function readJsonOrText(res: Response): Promise<any> {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }
  try {
    return await res.text();
  } catch {
    return null;
  }
}

function messageFromErrorPayload(payload: any): string | null {
  if (!payload) return null;
  if (typeof payload === "string") return payload;
  return payload?.error || payload?.message || null;
}

export type ApiError = Error & {
  status?: number;
  payload?: any;
};

export async function apiJson<T>(
  path: string,
  token?: string | null,
  init?: RequestInit
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as any),
  };

  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    cache: init?.cache ?? "no-store",
  });

  const payload = await readJsonOrText(res);

  if (!res.ok) {
    const err: ApiError = new Error(
      messageFromErrorPayload(payload) || `HTTP ${res.status}`
    );
    err.status = res.status;
    err.payload = payload;
    throw err;
  }

  return payload as T;
}
