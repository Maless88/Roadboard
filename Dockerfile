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


# ── Install all dependencies (layer cached until any package.json changes) ──
# COPY --parents (BuildKit) preserves the directory structure and picks up
# every workspace package.json without manual enumeration. Adding a new
# workspace no longer requires editing this Dockerfile.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --parents apps/*/package.json ./
COPY --parents packages/*/package.json ./

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

# core-api needs git + docker CLI (+ compose plugin) to run self-hosted deploy.
# Installing unconditionally adds ~40 MB to every image; acceptable for now,
# can be scoped to APP_NAME=core-api later with a conditional stage.
RUN apk add --no-cache bash git docker-cli docker-cli-compose

COPY --from=packager /runtime .
WORKDIR /app/apps/${APP_NAME}
CMD ["node", "dist/main.js"]
