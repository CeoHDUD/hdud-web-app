// C:\HDUD_DATA\hdud-web-app\vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // ✅ API (já existente)
      "/api": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },

      // ✅ CDN (novo): evita cross-origin no <img>
      // Use no frontend: /cdn/avatars/author_1.jpg
      "/cdn": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true,
        // não reescreve: queremos preservar /cdn/...
      },
    },
  },
});
