# Build multi-stage a partir da raiz do monorepo (workspaces npm).
# Contexto de build esperado: raiz do repositório.
#   docker build -f apps/api/Dockerfile -t santos-saf-api .

FROM node:20-alpine AS deps
# O engine do Prisma precisa de libssl em runtime; node:20-alpine não traz
# openssl instalado por padrão (sem isso, o engine falha ao carregar e o
# Prisma nem consegue reportar um erro em JSON legível).
RUN apk add --no-cache openssl
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
RUN npm ci

FROM deps AS build
WORKDIR /repo
COPY . .
RUN npm run prisma:generate -w apps/api
RUN npm run api:build

FROM node:20-alpine AS runtime
RUN apk add --no-cache openssl
ENV NODE_ENV=production
WORKDIR /repo
# npm workspaces faz hoist das dependências pra node_modules da raiz — não
# existe apps/api/node_modules separado a menos que uma dependência não seja
# hoistable. A resolução de módulos do Node sobe diretórios até achar
# node_modules, então rodar a partir de /repo/apps/api ainda enxerga
# /repo/node_modules normalmente.
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/prisma ./apps/api/prisma
# prisma/seed.ts roda via ts-node direto do código-fonte (não do dist
# compilado) e importa de ../src/common/permissions/permission-catalog.
COPY --from=build /repo/apps/api/src ./apps/api/src
COPY --from=build /repo/apps/api/tsconfig.json ./apps/api/tsconfig.json
COPY --from=build /repo/apps/api/package.json ./apps/api/package.json
COPY --from=build /repo/package.json ./package.json
WORKDIR /repo/apps/api
EXPOSE 3000
CMD ["node", "dist/src/main.js"]
