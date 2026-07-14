# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
- Agent rooms: delete and clear-history actions on agent chat rooms
- Photorealistic agent avatars (Cloudflare FLUX) replacing the illustrated set, with matching full-body images in the agent Scheda modal (in-scene layout with floating card)
- Roadboard logomark, browser tab favicon (`icon.svg`) and login banner
- Scheduled activities module: self-scheduling MCP tool, calendar view with run history
- Agent skills catalog: `list_skills`, `attach_skill`, `detach_skill` MCP tools and skill visibility in the agent Scheda
- Durable agent memory (pgvector + Ollama embeddings) with automatic fact extraction
- Telegram bridge: inbound/outbound messages, notification hub, per-agent identity
- Email integration for Cleo: IMAP inbox reading, mark-read, drafts, multi-account Gmail
- Output gate in the AI workflow CLI: `review-output` (diff vs Scope/Acceptance verdict) and `promote` (build + tests + evidence gated run→done transition)

### Changed
- CodeFlow storage fully cut over to Memgraph (CF-GDB-03b-D/E): write path Memgraph-direct, Postgres architecture_* tables and GraphSyncService retired, `GRAPH_WRITE_USE_MEMGRAPH`/`GRAPH_READ_USE_MEMGRAPH_IMPACT` flags removed (only `GRAPH_SYNC_USE_OUTBOX` remains)
- Navigation rework: Ops/System merged into Agent Office, Guida moved to bottom, collapsible sidebar
- Agent card redesign (image/name/task + Scheda/Chat/Log actions) and avatars shown in Home and Chat sidebar
- Chat streaming performance: memoized markdown rendering and instant auto-scroll (removes stutter while agent replies stream)
- AI workflow docs rewritten for the in-prompt review-gate model; retired templates for the old briefs/proposals folder model removed

### Fixed
- Postgres/Redis/Memgraph ports bound to 127.0.0.1 instead of 0.0.0.0
- Prisma migration checksum drift and stale thumbnail index (schema↔DB alignment)
- White edge halo and color fringe on agent full-body cutout images

### Security
- Rotated exposed production MCP token and hardened the allow-list
- Sandboxed the agent CLI bridge (claude-code executor)
- Agent guardrails: anti-hallucination system prompts, meta-leak response cleaning, delegation loop hardening (per-room lock, sanitize markers, cap 12)

## [0.15.0] - 2026-05-21

### Added
- Domain groups CRUD: `ArchitectureNode` can be assigned to named domain groups; CRUD on `GET/POST/PATCH/DELETE /codeflow/domain-groups`; drag-and-drop assignment in Atlas canvas
- Project thumbnails: auto-refresh from project home URL (screenshot via BullMQ job) and manual upload via `POST /projects/:id/thumbnail`; displayed as card background in dashboard
- Chatbot config per project: multi-provider AI assistant (Anthropic, OpenAI, Ollama) configurable per project; settings tab "AI assistant"
- Deep Code Map schema: `File`, `Symbol`, `ExternalPackage` node types added to `@roadboard/graph-db` Cypher schema
- Drift validation baseline for CodeFlow: `graph-sync.service` records a graph hash baseline and validates on each sync cycle; operational runbook in `docs/codeflow-drift-runbook.md`
- Atlas: agent context view (`?cf=agent-context`) and domain groups panel in the canvas sub-nav
- Tab Attività: unified with former Audit tab — full filter form (eventType, actorType, dateFrom/dateTo) + pagination; Audit tab removed from navigation; `?tab=audit` redirects to activity
- Settings: AI assistant tab for chatbot configuration
- Teams page at `/teams`
- Dashboard: skeleton loader (`ProjectCardSkeleton`) and async `ProjectsGrid` component
- MCP guide: extended snippet generator supporting all 4 runtimes; Step 3 and Step 5 content expanded
- Feature flag `GRAPH_READ_USE_MEMGRAPH_IMPACT`: gates Memgraph Cypher read path for impact analysis (enabled 2026-05-20)
- `docs/AI-WORKFLOW.md`: Architect/Worker/Analyst operating model documentation
- `docs/task-naming-convention.md`: RoadBoard task title convention and area map
- `docs/i18n-glossary.md`: IT/EN terminology glossary with coherence pass notes
- Scripts: `rename-active-tasks.ts`, `tasks-list.ts`, `dev-light.sh`
- `AGENTS.md`: Codex/ChatGPT Analyst startup guide

### Changed
- Unified the `/projects` list page into the Dashboard: swipeable project cards, "+ Crea progetto" button; `/projects` redirects to `/dashboard`
- `projects.service`: `recordForUser` audit calls added to create, update, delete, archive, unarchive
- `graph.service`: `recordForUser` audit calls added to all node, edge, link, and annotation writes
- `audit.service`: `findByProject` now accepts `actorType`, `dateFrom`, `dateTo` filters
- `activity-timeline.tsx`: rewritten to use `listAuditEvents` with filter form and pagination
- i18n: 7 value fixes in `it.ts`, 2 in `en.ts`; new keys for audit filters, thumbnails, chatbot config
- CLAUDE.md: Architect/Worker/Analyst model, task queue protocol (Cowork), verification discipline

### Fixed
- `SwipeableProjectCard`: archive button not clickable — reveal panel had `z-index: auto` while inner card content had `z-index: 1`; fixed by adding `zIndex: 2` to the reveal panel
- Atlas (`?tab=codeflow`): crash on page load — `dict.codeflow.decisionAware.nodeBadge` was a function in the i18n dictionary, not serializable across the Next.js Server→Client boundary; converted to string template `'{n} decisioni'` with `.replace('{n}', ...)` at call site
- Settings → Membri: native select dropdown options readable (solid dark background on `<select>` and `<option>`)
- `SwipeableProjectCard`: delete overlay bleed, pointer capture tracking, useDict() instead of Dictionary prop

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
