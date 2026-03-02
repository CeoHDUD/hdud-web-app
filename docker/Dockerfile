# =========================
# Stage 1: build
# =========================
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# =========================
# Stage 2: nginx
# =========================
FROM nginx:alpine
WORKDIR /usr/share/nginx/html

# limpa html padrão
RUN rm -rf ./*

# copia o build do Vite
COPY --from=build /app/dist ./

# 🔥 ESTE É O FIX DEFINITIVO:
# seu nginx.conf do repo vira o default.conf do nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
