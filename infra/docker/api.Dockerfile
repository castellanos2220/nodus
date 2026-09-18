# syntax=docker/dockerfile:1
# ==============================================================================
# NODUS API — imagen multi-stage.
#   target: development  → hot reload, el que usa docker-compose
#   target: production   → runtime mínimo, sólo dependencias de producción
#
# Orden de capas: primero los manifiestos (cambian poco → caché estable),
# después `pnpm install`, y el código fuente al final. Un cambio en el código no
# invalida la instalación de dependencias.
#
# El `.dockerignore` de la raíz excluye `node_modules` del contexto: pnpm lo
# construye con enlaces simbólicos al almacén de la raíz, y copiarlo desde el
# host rompería el árbol instalado para Linux.
# ==============================================================================

# ------------------------------------------------------------------- base -----
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl curl
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

# ------------------------------------------------------------------- deps -----
# Sólo los manifiestos: maximiza el acierto de caché de capas.
FROM base AS deps
COPY package.json pnpm-workspace.yaml ./
COPY pnpm-lock.yaml* ./
COPY apps/api/package.json ./apps/api/
COPY packages/types/package.json ./packages/types/
COPY packages/config/package.json ./packages/config/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile || pnpm install

# ------------------------------------------------------------------ source ----
# El código, sobre el árbol de dependencias ya instalado.
FROM deps AS source
COPY packages ./packages
COPY apps/api ./apps/api

# ------------------------------------------------------------ development -----
FROM source AS development
ENV NODE_ENV=development
RUN pnpm --filter @nodus/types build \
 && pnpm --filter @nodus/api exec prisma generate
EXPOSE 4000
CMD ["pnpm", "--filter", "@nodus/api", "dev"]

# ------------------------------------------------------------------ build -----
FROM source AS build
ENV NODE_ENV=production
RUN pnpm --filter @nodus/types build \
 && pnpm --filter @nodus/api exec prisma generate \
 && pnpm --filter @nodus/api build

# ------------------------------------------------------------- production -----
FROM base AS production
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S nodus -u 1001

COPY --from=build --chown=nodus:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nodus:nodejs /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=nodus:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=nodus:nodejs /app/apps/api/prisma ./apps/api/prisma
COPY --from=build --chown=nodus:nodejs /app/apps/api/package.json ./apps/api/
COPY --from=build --chown=nodus:nodejs /app/packages ./packages
COPY --from=build --chown=nodus:nodejs /app/package.json /app/pnpm-workspace.yaml ./

USER nodus
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/api/v1/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
CMD ["node", "apps/api/dist/main.js"]
