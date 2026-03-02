// C:\HDUD_DATA\hdud-web-app\src\lib\assets.ts

export function resolveAssetUrl(input: string | null): string | null {
  const s = String(input || "").trim();
  if (!s) return null;

  if (/^https?:\/\/.+/i.test(s)) return s;

  const API_BASE_URL =
    (import.meta as any).env?.VITE_API_BASE_URL || "http://127.0.0.1:4000";

  if (s.startsWith("/")) return `${API_BASE_URL}${s}`;
  return s;
}
