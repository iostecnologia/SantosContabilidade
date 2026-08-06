# Build multi-stage a partir da raiz do monorepo (workspaces npm).
# Contexto de build esperado: raiz do repositório.
#   docker build -f apps/web/Dockerfile -t santos-saf-web .
#
# A imagem final É o Caddy: serve os arquivos estáticos do build do Vite E
# faz proxy reverso pra API (ver Caddyfile) — um único container cobre os
# dois papéis, sem precisar de um processo Node em produção pro frontend.

FROM node:20-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm ci
COPY . .
RUN npm run build -w apps/web

FROM caddy:2-alpine AS runtime
COPY --from=build /repo/apps/web/dist /srv/web
COPY Caddyfile /etc/caddy/Caddyfile
