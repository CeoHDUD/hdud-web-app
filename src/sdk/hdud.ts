import {
  AuthApi,
  AuthorsApi,
  MemoriesApi,
  HealthApi,
  Configuration,
} from "@hdud/sdk";

/**
 * IMPORTANTE:
 * - No browser, SEMPRE usamos "/api"
 * - O Vite (vite.config.ts) faz proxy para http://hdud-api:4000
 * - NÃO usar VITE_API_BASE
 * - NÃO usar host.docker.internal
 */
const BASE_URL = "/api";

function withAuth(token?: string) {
  return new Configuration({
    basePath: BASE_URL,
    accessToken: token,
  });
}

/* =========================
   AUTH
========================= */
export function authApi() {
  return new AuthApi(
    new Configuration({
      basePath: BASE_URL,
    })
  );
}

/* =========================
   AUTHORS
========================= */
export function authorsApi(token: string) {
  return new AuthorsApi(withAuth(token));
}

/* =========================
   MEMORIES
========================= */
export function memoriesApi(token: string) {
  return new MemoriesApi(withAuth(token));
}

/* =========================
   HEALTH
========================= */
export function healthApi() {
  return new HealthApi(
    new Configuration({
      basePath: BASE_URL,
    })
  );
}
