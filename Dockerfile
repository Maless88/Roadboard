# syntax=docker/dockerfile:1
# Multi-stage Dockerfile for all service apps in the monorepo.
# Build arg APP_NAME selects which app to run
# (core-api, auth-access, mcp-service, worker-jobs, local-sync-bridge).
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
ARG APP_NAME
COPY . .
RUN pnpm --filter @roadboard/database db:generate
RUN test -n "$APP_NAME"
RUN pnpm --filter @roadboard/${APP_NAME}... build


# ── Workspace image for one-shot tasks (migrate/seed) ─────────────────────────
FROM deps AS workspace
COPY . .
RUN pnpm --filter @roadboard/database db:generate


# ── Assemble runtime filesystem for a specific service app ────────────────────
FROM builder AS packager
ARG APP_NAME
RUN test -n "$APP_NAME"
RUN mkdir -p /runtime/apps/${APP_NAME} \
  && cp -R /app/node_modules /runtime/node_modules \
  && cp -R /app/packages /runtime/packages \
  && cp -R /app/apps/${APP_NAME}/. /runtime/apps/${APP_NAME}/


# ── Lean runtime image ───────────────────────────────────────────────────────
FROM node:20-alpine AS runner
ARG APP_NAME
ARG GIT_SHA=unknown
ARG BUILD_TIME=unknown
WORKDIR /app
ENV NODE_ENV=production
ENV APP_NAME=${APP_NAME}
ENV BUILD_SHA=${GIT_SHA}
ENV BUILD_TIME=${BUILD_TIME}
COPY --from=packager /runtime .
WORKDIR /app/apps/${APP_NAME}
CMD ["node", "dist/main.js"]
