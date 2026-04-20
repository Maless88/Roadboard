# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Changed
- Unified the `/projects` list page into the Dashboard: the dashboard now hosts the "+ Crea progetto" button and uses swipeable project cards
- `SwipeableProjectCard`: card-layout version of the row component with swipe-left gesture to reveal a delete affordance
- `/projects` route now redirects to `/dashboard`; post-login redirect updated accordingly
- `deleteProjectAction` revalidates and redirects to `/dashboard`
- Sidebar "mostra altri" link points to `/dashboard`
- E2E tests updated to use the `[data-testid="project-card"]` selector with `data-project-href`

### Fixed
- Settings → Membri: native select dropdown options are now readable (solid dark background on both `<select>` and `<option>` elements)
- `SwipeableProjectCard`: delete overlay no longer "bleeds through" the translucent card background at rest; card stays fixed while the red overlay grows from the right during swipe
- `SwipeableProjectCard`: `setPointerCapture` on pointerdown keeps the drag tracked when the cursor leaves the card; navigation handled directly in `onPointerUp` so card click still works after capture
- `SwipeableProjectCard`: client component now uses `useDict()` instead of receiving the `Dictionary` as prop (dictionary contains functions, not serializable across the Server→Client boundary)

## [0.14.0] - 2026-04-19

### Added
- Phase–Decision link: `phases.decision_id` FK allows a phase to be marked as resolving a specific decision
- Migration `20260418180000_phase_decision_link`: adds nullable `decision_id` column to `phases` table
- `FindPhasesQueryDto` with optional `decisionId` filter on `GET /phases`
- Phase accordion in Roadmap tab: clicking a phase expands the list of tasks belonging to it
- Decision accordion in Decisions tab: clicking a decision expands the phases linked to it
- Expandable task rows in Tasks and Roadmap tabs: clicking a task with description/dueDate/completionNotes shows details inline
- Create-phase form now includes an optional "Decision" select to link the new phase at creation time
- `create_task` MCP tool now accepts `description`, `assigneeId`, and `dueDate`
- New MCP tool `update_task`: update title, description, phaseId, priority, assigneeId, dueDate of an existing task
- New MCP tool `create_phase`: create a roadmap phase with all fields including `decisionId` link
- New MCP tool `update_phase`: update any field of an existing phase (status, dates, linked decision)
- New MCP tool `update_decision`: record outcome, change status to accepted/rejected/superseded, set `resolvedAt`
- `initial_instructions` MCP bootstrap updated to document all 23 tools with required/optional args
- `Task` interface in web-app extended with `completionNotes` and `completedAt` fields

### Changed
- Roadmap tab now appears before Tasks in the project detail navigation
- "Decisioni" tab label renamed to "Decisions"
- `DecisionsTab` fetches phases and groups them by `decisionId` to feed the accordion
- `PhasesTab` fetches tasks and groups them by `phaseId` to feed the accordion

## [0.13.0] - 2026-04-14

### Added
- Semantic search over memory entries: `GET /memory?q=` with case-insensitive full-text search on title and body
- Memory search UI in the Memory tab with live URL-param-driven filtering
- `search_memory` MCP tool that delegates to the memory search endpoint
- Agent-readable project changelog via `get_project_changelog` MCP tool: aggregates tasks, phases, decisions, memory, and audit events into a structured snapshot
- `GET /projects/:id/audit` endpoint returning paginated activity events
- Richer decision model: `outcome` and `resolvedAt` fields on Decision records
- Auto-set `resolvedAt` when decision status transitions to accepted/rejected/superseded
- `outcome` field in decision create form and displayed in DecisionsTab UI
- Memory summarization background job: groups memory entries by type, lists titles per group, creates an `operational_note` summary per project
- `POST /jobs/summary-generation-all` bulk endpoint to trigger summaries across all projects

### Fixed
- `mcp-contracts` tool count updated to 14 (was 12 after adding changelog and search tools)

## [0.12.0] - 2026-04-14

### Added
- Project detail page with 6-tab UI: Overview, Tasks, Fasi, Decisioni, Memory, Audit
- Inline create forms for tasks, phases, milestones, decisions, memory entries, projects
- Dashboard snapshot tab with task counts, milestone progress, urgent tasks, recent decisions
- Audit log tab with paginated activity events per project
- Playwright e2e test suite: 19 tests covering auth, project list, project detail tabs, all create flows
- Unit tests for all shared packages: domain, auth, grants, config, mcp-contracts
- CI enforcement: both typecheck+unit and e2e jobs required on every push and PR
- GitHub Actions artifact upload for Playwright reports on failure

### Fixed
- Memory entry type validation: aligned form options with backend allowed values
- Tab navigation: scoped to `header` to avoid RSC payload duplicate link elements
- E2E selector stability: strict mode violations resolved with `.first()` on repeated-data assertions

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
