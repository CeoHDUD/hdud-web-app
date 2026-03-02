// C:\HDUD_DATA\hdud-web-app\src\lib/cdn.ts

export function toAbsoluteCdnUrl(v: string): string {
  const s = (v ?? "").trim();
  if (!s) return "";
  if (/^https?:\/\/.+/i.test(s)) return s;

  const API_BASE =
    (import.meta as any).env?.VITE_API_BASE_URL || "http://127.0.0.1:4000";

  if (s.startsWith("/cdn/")) return `${API_BASE}${s}`;
  if (s.startsWith("/")) return `${API_BASE}${s}`; // dev-safe (evita 5173)
  return s;
}
