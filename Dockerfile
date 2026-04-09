# syntax=docker/dockerfile:1
# Multi-stage Dockerfile for all NestJS apps.
# Build arg APP_NAME selects which app to run (core-api, auth-access, worker-jobs, local-sync-bridge).
#
# Build example:
#   docker build --build-arg APP_NAME=core-api -t roadboard-core-api .

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app


# ── Install all dependencies (layer cached until lock file changes) ──────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

COPY apps/core-api/package.json         apps/core-api/
COPY apps/auth-access/package.json      apps/auth-access/
COPY apps/mcp-service/package.json      apps/mcp-service/
COPY apps/worker-jobs/package.json      apps/worker-jobs/
COPY apps/local-sync-bridge/package.json apps/local-sync-bridge/

COPY packages/api-contracts/package.json  packages/api-contracts/
COPY packages/auth/package.json           packages/auth/
COPY packages/config/package.json         packages/config/
COPY packages/database/package.json       packages/database/
COPY packages/domain/package.json         packages/domain/
COPY packages/grants/package.json         packages/grants/
COPY packages/local-storage/package.json  packages/local-storage/
COPY packages/mcp-contracts/package.json  packages/mcp-contracts/
COPY packages/observability/package.json  packages/observability/

RUN pnpm install --frozen-lockfile


# ── Build all packages and apps ──────────────────────────────────────────────
FROM deps AS builder
COPY . .
RUN pnpm --filter @roadboard/database db:generate
RUN pnpm -r build


# ── Deploy a specific app (resolves workspace deps into a standalone dir) ────
FROM builder AS deployer
ARG APP_NAME
RUN pnpm --filter @roadboard/${APP_NAME} deploy --prod /out


# ── Lean runtime image ───────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deployer /out .
CMD ["node", "dist/main.js"]
