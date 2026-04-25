# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# MASTER PROTOCOL

## 1. CODING RULES & COMMUNICATION
- **Language**: All textual communication in Italian. All source code (variables, strings, docstrings) in English.
- **Verbosity**: Minimal prose. No preambles, summaries, or unsolicited confirmations. Relevant output only. Code without explanations unless explicitly requested.
- **Airy Code Style**:
  - EXACTLY 1 empty line before `if`, `then`, `elif`, `else`, `try`, `except`.
  - EXACTLY 2 empty lines before every `class` or `def`.
  - EXACTLY 1 empty line after a method docstring before the code.
- **Versioning**: READ-ONLY. Never bump versions unless explicitly requested ("bump vX.Y.Z").
- **Hygiene**: All temporary files/artifacts MUST stay in `.agent/`. Git-ignored and ephemeral.

## 2. PROJECT LIFECYCLE & GIT
- **Commits**: Strictly follow **Conventional Commits** (`type(scope): description`). No versions in messages.
- **Changelog**: When performing "BUMP vX.Y.Z", update both `CHANGELOG.md` and `README.md` following the **Keep a Changelog** standard.
  - **Header**: Use the format `## [X.Y.Z] - YYYY-MM-DD`.
  - **Structure**: Categorize all changes under the following semantic subsections: `### Added`, `### Changed`, `### Deprecated`, `### Fixed`, `### Removed`, or `### Security`.
  - **Style**: Use plain indented bullet points for each change. Do not use bold text within the descriptions.
  - **Sync**: Ensure the version number and the latest "Added/Fixed" highlights are synchronized in the `README.md`.
- **Refactoring**: Apply patches only. NO full refactoring without explicit consent.

## 3. MCP OPERATIONAL PROTOCOLS (AUTO-ONBOARDING)
- **Serena Module**: If tools are available and you have NOT yet called `initial_instructions()` in this session, call it IMMEDIATELY — before any other response, even if the opening message seems generic.
- **RoadBoard 2.0 MCP**: If tools are available and you have NOT yet called `initial_instructions()` in this session, call it IMMEDIATELY — before any other response, even if the opening message seems generic.
- **Context7 Module**: You MUST use Context7 tools whenever the user asks a question about any programming language, framework, library, API, software tool, or technology stack.

## 4. ROADBOARD 2.0 — WORKFLOW RULES
- **Session start**: Always call `prepare_project_summary` or `get_project_changelog` to load the current project context before starting any work.
- **Planning**: When asked to plan any activity, ALWAYS follow this sequence via MCP — no exceptions:
  1. Call `list_phases(projectId)` to discover existing phases.
  2. If the work fits an existing phase → call `create_task` with that `phaseId`.
  3. If no suitable phase exists → call `create_phase` first, then `create_task` with the new `phaseId`.
  4. Never create a task without a `phaseId`. Never create a duplicate phase if one already covers the work.
- **Task tracking**: Update task status via `update_task_status` as work progresses (`in_progress` when starting, `done` when complete). Never report a task as complete without updating its status first.
- **Decisions**: After any architectural or significant design decision, record it with `create_decision` including rationale and impact level.
- **Memory**: After any meaningful discovery, technical finding, or completed milestone, store a `create_memory_entry` autonomously — do NOT ask for permission.
- **Session end**: Always call `create_handoff` at the end of every session with a summary and next steps.
- **Autonomy**: All RoadBoard 2.0 write operations (create_task, create_phase, update_task_status, create_memory_entry, create_decision, create_handoff) are background autonomous processes. DO NOT ask for permission.

## 5. EXECUTION GUIDELINES
- **Syntax**: Always use language markers in code blocks (e.g., ```typescript).
- **Autonomy**: For Roadboard MCP, DO NOT ask for permission. It is a background autonomous process.
- **Performance**: Target 1-3 tool calls for simple info, max 5 for complex tasks.

---

# Roadboard 2.0 — Development Rules

## Project Overview
Roadboard 2.0 is a multi-project execution, memory, and collaboration platform for humans and AI agents.
Monorepo TypeScript-first: NestJS backend services, Next.js frontend, PostgreSQL central DB, SQLite local.

## Commands

```bash
# Full bootstrap (install, start infra, migrate, seed)
pnpm bootstrap

# Infra
pnpm docker:up        # start PostgreSQL + Redis via docker compose
pnpm docker:down

# Development (all apps in watch mode)
pnpm dev

# Build / lint / typecheck (all workspaces via Turborepo)
pnpm build
pnpm lint
pnpm typecheck

# Test (all workspaces)
pnpm test

# Test a single package/app
pnpm --filter @roadboard/core-api test
pnpm --filter @roadboard/domain test

# Test a single file (run from inside the package dir, or use vitest directly)
pnpm --filter @roadboard/core-api exec vitest run src/modules/tasks/tasks.service.spec.ts

# Database
pnpm db:migrate       # run pending Prisma migrations (ALWAYS use this, never db push)
pnpm db:generate      # regenerate Prisma client after schema changes
pnpm db:seed          # seed the database
pnpm --filter @roadboard/database db:studio   # open Prisma Studio
```

Environment: copy `.env.example` to `.env` at repo root. Key vars:
- `DATABASE_URL` — PostgreSQL on port 5433 (Docker)
- `CORE_API_PORT=3001`, `AUTH_ACCESS_PORT=3002`, `WORKER_JOBS_PORT=3003`, `LOCAL_SYNC_PORT=3004`
- `JOURNAL_DB_PATH=.agent/journal.db` — SQLite for local-sync-bridge

## Architecture

```
apps/
  core-api          NestJS + Fastify, port 3001 — project/phase/task/memory/decision/codeflow/release CRUD
  auth-access       NestJS + Fastify, port 3002 — users, teams, sessions, MCP tokens, RBAC
  mcp-service       MCP server (stdio + HTTP, port 3005) — 31 tools for AI agents
  web-app           Next.js 15, port 3000 — frontend dashboard, Atlas, settings
  worker-jobs       NestJS + BullMQ + Redis, port 3003 — async background jobs
  local-sync-bridge NestJS + SQLite, port 3004 — offline-first journal with sync engine

packages/
  domain            shared enums and domain types
  database          Prisma schema + migrations + seed (PostgreSQL)
  auth              password hashing, JWT/session token utilities
  grants            RBAC permission logic
  mcp-contracts     MCP tool input/output schemas
  api-contracts     shared REST API types
  graph-db          Memgraph (Neo4j-compat) client + Cypher schema for CodeFlow
  demo-seed         seed content for "Tour Roadboard" demo project on signup
  local-storage     SQLite local-storage abstraction
  config            env parsing helpers
  observability     logging/tracing setup
```

All services expose `/health`. Turborepo task graph: `build` depends on `^build` (packages build before apps).

## Patterns
- Each NestJS module lives under `src/modules/<name>/` with controller, service, and colocated DTOs.
- Guards/interceptors go in `src/common/`.
- Integration tests go in `test/` at the app root; unit tests are colocated (`*.spec.ts`).
- Vitest `globals: true` — no need to import `describe`/`it`/`expect`.
- Imports use workspace aliases: `@roadboard/domain`, `@roadboard/database`, etc.
- No barrel exports in app code — only in shared packages via `index.ts`.

## Code Conventions
- TypeScript strict, no `any`
- camelCase variables/functions, PascalCase classes/types/enums
- DB columns: snake_case with Prisma `@map`
- REST + JSON API style
- Business logic in services, never in controllers

## Do NOT
- Use `any` types
- Skip Prisma migrations (always `db:migrate`, never `db push`)
- Put business logic in controllers
- Create unnecessary abstractions or premature optimizations
