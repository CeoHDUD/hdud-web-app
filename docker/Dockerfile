FROM node:20-alpine
WORKDIR /app
EXPOSE 5173
CMD sh -lc "corepack enable && pnpm install && pnpm dev --host 0.0.0.0 --port 5173"
