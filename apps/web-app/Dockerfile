# syntax=docker/dockerfile:1
# Dockerfile for the Next.js web-app using standalone output.
# Must be built from the monorepo root:
#   docker build -f apps/web-app/Dockerfile -t roadboard-web-app .

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app


# ── Install all dependencies ─────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

COPY apps/core-api/package.json         apps/core-api/
COPY apps/auth-access/package.json      apps/auth-access/
COPY apps/mcp-service/package.json      apps/mcp-service/
COPY apps/worker-jobs/package.json      apps/worker-jobs/
COPY apps/local-sync-bridge/package.json apps/local-sync-bridge/
COPY apps/web-app/package.json          apps/web-app/

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


# ── Build ────────────────────────────────────────────────────────────────────
FROM deps AS builder
ARG GIT_SHA=unknown
ARG BUILD_TIME=unknown
ENV NEXT_PUBLIC_BUILD_SHA=${GIT_SHA}
ENV NEXT_PUBLIC_BUILD_TIME=${BUILD_TIME}
COPY . .
RUN pnpm --filter @roadboard/database db:generate
RUN pnpm --filter @roadboard/web-app... build


# ── Lean runtime image (Next.js standalone) ──────────────────────────────────
FROM node:20-alpine AS runner
ARG GIT_SHA=unknown
ARG BUILD_TIME=unknown
WORKDIR /app
ENV NODE_ENV=production
ENV BUILD_SHA=${GIT_SHA}
ENV BUILD_TIME=${BUILD_TIME}
ENV NEXT_PUBLIC_BUILD_SHA=${GIT_SHA}
ENV NEXT_PUBLIC_BUILD_TIME=${BUILD_TIME}

COPY --from=builder /app/apps/web-app/.next/standalone ./
COPY --from=builder /app/apps/web-app/.next/static     ./apps/web-app/.next/static

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "apps/web-app/server.js"]
