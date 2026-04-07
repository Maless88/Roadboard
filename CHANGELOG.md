# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
- FASE 12: unit tests for shared packages, Playwright e2e for web-app, CI enforcement

## [0.10.0] - 2026-04-07

### Added
- `apps/local-sync-bridge`: offline-first SQLite journal with sync engine to core-api
- Journal REST API: POST /tasks, PATCH /tasks/:id/status, POST /memory
- Sync endpoints: GET /sync/status, GET /sync/journal, POST /sync/trigger
- Cron-based automatic sync every 30 seconds via @nestjs/schedule

## [0.9.0] - 2026-04-07

### Added
- `apps/worker-jobs`: async job service with BullMQ and Redis
- Three job processors: dashboard-refresh, summary-generation, cleanup
- REST endpoints for manual trigger and queue stats
- Redis added to docker-compose (already present)

## [0.8.0] - 2026-04-07

### Added
- Three MCP workflow tools: `prepare_task_context`, `prepare_project_summary`, `create_handoff`
- Updated mcp-contracts with new tool schemas
- Integration tests covering all 10 MCP tools

## [0.7.0] - 2026-04-07

### Added
- `apps/web-app`: Next.js 15 App Router frontend
- Login page with session-based auth via Server Actions
- Projects dashboard with status badges
- Project detail page with task status update (client component + revalidatePath) and memory entries

## [0.6.0] - 2026-04-07

### Added
- Self-hosting loop: project RB tracked inside itself via MCP tools
- AuthGuard extended to accept both session tokens and MCP tokens
- CoreApiClient URL patterns fixed to match actual API routes

## [0.5.0] - 2026-04-07

### Added
- mcp-contracts: completed all 7 tool schemas
- Integration tests for auth-access (auth, sessions, teams, memberships, grants, tokens)
- Integration tests for mcp-service (all 7 tools via JSON-RPC stdio, invalid token denial)

### Fixed
- Build system: all workspace packages set to CommonJS output
- Package main/types fields pointing to dist/ instead of src/
- Turbo added as explicit devDependency

## [0.4.0] - 2026-04-07

### Added
- `apps/mcp-service`: MCP stdio server with 7 tools
- `packages/mcp-contracts`: tool schema definitions
- MCP token issuance and validation in auth-access

## [0.3.0] - 2026-04-07

### Added
- `apps/core-api`: memory entries and decisions endpoints
- Memory-aware read tools in mcp-service

## [0.2.0] - 2026-04-07

### Added
- `apps/auth-access`: users, teams, memberships, grants, sessions
- `packages/auth`: password hashing, token utilities
- `packages/grants`: permission logic

## [0.1.0] - 2026-04-07

### Added
- Monorepo bootstrap with pnpm workspaces and Turborepo
- `apps/core-api`: projects, phases, milestones, tasks with REST API
- `packages/domain`, `packages/database`, `packages/config`
- PostgreSQL 16 + Redis 7 via docker-compose
- Prisma schema, migrations, seed
- GitHub Actions CI workflow
