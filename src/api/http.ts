// C:\HDUD_DATA\hdud-web-app\src\api\http.ts
const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || "http://127.0.0.1:4000";

function getAccessToken(): string | null {
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("hdud_access_token") ||
    localStorage.getItem("HDUD_TOKEN") ||
    localStorage.getItem("token") ||
    null
  );
}

export async function apiJson<T = any>(path: string, token?: string): Promise<T> {
  const t = token || getAccessToken();

  const res = await fetch(`${API_BASE}${path.startsWith("/") ? path : `/${path}`}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
    },
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg = data?.error || `HTTP ${res.status}`;
    const err: any = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data as T;
}