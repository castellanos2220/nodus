# syntax=docker/dockerfile:1
# ==============================================================================
# NODUS Web — Next.js 15
#
# Misma estrategia de capas que la API: manifiestos → dependencias → código.
# Ver la nota sobre `node_modules` en `.dockerignore`.
# ==============================================================================

FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json pnpm-workspace.yaml ./
COPY pnpm-lock.yaml* ./
COPY apps/web/package.json ./apps/web/
COPY packages/types/package.json ./packages/types/
COPY packages/config/package.json ./packages/config/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile || pnpm install

FROM deps AS source
COPY packages ./packages
COPY apps/web ./apps/web
# `@nodus/types` se compila a CommonJS; la web lo consume ya construido.
RUN pnpm --filter @nodus/types build

FROM source AS development
ENV NODE_ENV=development
EXPOSE 3000
CMD ["pnpm", "--filter", "@nodus/web", "dev"]

FROM source AS build
ENV NODE_ENV=production
ENV NEXT_OUTPUT=standalone
RUN pnpm --filter @nodus/web build

FROM base AS production
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S nodus -u 1001

# El output standalone de Next incluye sólo las dependencias que el servidor usa.
COPY --from=build --chown=nodus:nodejs /app/apps/web/.next/standalone ./
COPY --from=build --chown=nodus:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=nodus:nodejs /app/apps/web/public ./apps/web/public

USER nodus
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "apps/web/server.js"]
