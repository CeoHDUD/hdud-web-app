// C:\HDUD_DATA\hdud-web-app\src\api\http.ts
//
// ✅ SHIM / COMPAT layer
// - Evita duas stacks concorrendo (fetch solto vs lib/api.ts)
// - Mantém apiJson() para não quebrar imports antigos
// - Centraliza token/retry/baseURL em src/lib/api.ts

import { apiGet } from "../lib/api";

export async function apiJson<T = any>(path: string): Promise<T> {
  // apiGet já injeta Authorization quando existir token
  // e respeita base "/api" (nginx) + env (dev).
  return apiGet<T>(path.startsWith("/") ? path : `/${path}`);
}