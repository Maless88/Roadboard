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
- **Serena Module**: If tools are available, you MUST execute `initial_instructions()` at the start of every session to inject the operational protocol.
- **Memento Module**: If tools are available, you MUST execute `memento_onboarding()` at the start of every session to inject the memory management protocol.
- **RoadBoard 2.0 MCP**: If tools are available, you MUST execute `initial_instructions()` at the start of every session to load the operational protocol, tool catalog, and workflow rules.
- **Context7 Module**: You MUST use Context7 tools whenever the user asks a question about any programming language, framework, library, API, software tool, or technology stack.

## 4. ROADBOARD 2.0 — WORKFLOW RULES
- **Session start**: Always call `prepare_project_summary` or `get_project_changelog` to load the current project context before starting any work.
- **Planning**: Before proposing or starting any implementation, verify existing tasks on RoadBoard 2.0 with `list_active_tasks`. If the planned work has no corresponding task, create one with `create_task` before proceeding.
- **Task tracking**: Update task status via `update_task_status` as work progresses (`in_progress` when starting, `done` when complete). Never report a task as complete without updating its status first.
- **Decisions**: After any architectural or significant design decision, record it with `create_decision` including rationale and impact level.
- **Memory**: After any meaningful discovery, technical finding, or completed milestone, store a `create_memory_entry` autonomously — do NOT ask for permission.
- **Session end**: Always call `create_handoff` at the end of every session with a summary and next steps.
- **Autonomy**: All RoadBoard 2.0 write operations (create_task, update_task_status, create_memory_entry, create_decision, create_handoff) are background autonomous processes. DO NOT ask for permission.

## 5. EXECUTION GUIDELINES
- **Syntax**: Always use language markers in code blocks (e.g., ```typescript).
- **Autonomy**: For Memento storage, DO NOT ask for permission. It is a background autonomous process.
- **Performance**: Target 1-3 tool calls for simple info, max 5 for complex tasks.

---

# Roadboard 2.0 — Development Rules

## Project Overview
Roadboard 2.0 is a multi-project execution, memory, and collaboration platform for humans and AI agents.
Monorepo TypeScript-first: NestJS backend services, Next.js frontend, PostgreSQL central DB, SQLite local.

## Architecture
- `apps/core-api` — NestJS, domain CRUD (projects, phases, milestones, tasks, memory)
- `apps/auth-access` — NestJS, users, teams, memberships, grants, sessions, MCP tokens
- `apps/mcp-service` — MCP server, read/write tools for agents
- `apps/web-app` — Next.js frontend (post-MVP)
- `packages/domain` — shared enums and domain types
- `packages/database` — Prisma schema, migrations, seed
- `packages/auth` — password hashing, token utilities
- `packages/grants` — permission logic
- `packages/mcp-contracts` — MCP tool schemas
- `packages/config` — env helpers

## Stack & Tooling
- pnpm workspaces + Turborepo
- NestJS with Fastify adapter
- Prisma ORM with PostgreSQL
- Vitest for testing
- TypeScript strict mode everywhere

## Code Conventions
- Language: TypeScript strict, no `any`
- Modules: NestJS module pattern (controller + service + DTOs)
- Naming: camelCase for variables/functions, PascalCase for classes/types/enums
- DB columns: snake_case (Prisma `@map`)
- API style: REST, JSON
- Imports: use workspace aliases (`@roadboard/domain`, `@roadboard/database`, etc.)
- No barrel exports in app code — only in shared packages `index.ts`

## Patterns
- Each NestJS module has its own folder under `src/modules/<name>/`
- DTOs are colocated with their module
- Guards/interceptors go in `src/common/`
- Integration tests go in `test/` at app root
- Unit tests colocated with source files (`*.spec.ts`)

## Commit Messages
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`
- Scope by package/app: `feat(core-api): add project CRUD`

## Current Phase
Wave 1, Sprint 1 — API/MCP-first approach (no web UI yet).
Priority: monorepo bootstrap → shared packages → core-api → auth-access → mcp-service.

## Do NOT
- Add web UI code until explicitly asked
- Use `any` types
- Skip Prisma migrations (always migrate, never push)
- Put business logic in controllers — keep it in services
- Create unnecessary abstractions or premature optimizations
