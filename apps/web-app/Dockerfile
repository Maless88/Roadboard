# syntax=docker/dockerfile:1
# Dockerfile for the Next.js web-app using standalone output.
# Must be built from the monorepo root:
#   docker build -f apps/web-app/Dockerfile -t roadboard-web-app .

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app


# ── Install all dependencies ─────────────────────────────────────────────────
# COPY --parents (BuildKit) preserves the directory structure and picks up
# every workspace package.json without manual enumeration.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --parents apps/*/package.json ./
COPY --parents packages/*/package.json ./

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
