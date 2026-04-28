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

## 3.1 Serena — MANDATORY for code navigation and editing

Serena is an MCP server exposing semantic code navigation (LSP-backed). When it is available, it is the only permitted tool for semantic navigation and structured edits.

### Prohibited patterns

The following are strictly forbidden for semantic code navigation:

- `grep` / `ripgrep` / the Grep tool to find definitions of functions, classes, types, interfaces, components.
- `grep` / `ripgrep` / the Grep tool to find where a symbol is used or called.
- `cat` / Read on an entire file just to locate a symbol.
- `find` / Glob to discover where a type or function lives.

These approaches waste context, miss re-exports / type aliases / barrel files, and produce line-number-fragile edits.

### When grep / ripgrep / Grep ARE allowed

Only for non-semantic searches: string literals, config keys, env-var names, comments, file names, paths. Never for code symbols.

### Serena bootstrap — every session, both roles

1. Call `mcp__mcp-serena__check_onboarding_performed` to verify Serena is active and onboarded.
2. If onboarding has not been performed, call `mcp__mcp-serena__onboarding` and wait for completion before any other action.
3. If Serena is unavailable, fall back to grep/Read but announce the fallback explicitly so the developer knows semantic navigation is degraded.

### Required — Serena tools

| Need                                     | Tool                                                            |
|------------------------------------------|-----------------------------------------------------------------|
| Find where a symbol is defined           | `mcp__mcp-serena__find_symbol` (`include_body=false`)           |
| Read the body of a specific symbol       | `mcp__mcp-serena__find_symbol` (`include_body=true`)            |
| Understand the structure of a file       | `mcp__mcp-serena__get_symbols_overview`                         |
| Find all usages / call sites             | `mcp__mcp-serena__find_referencing_symbols`                     |
| Search when symbol name is uncertain     | `mcp__mcp-serena__search_for_pattern`                           |
| List directory contents                  | `mcp__mcp-serena__list_dir`                                     |
| Find a file by name pattern              | `mcp__mcp-serena__find_file`                                    |
| Replace an entire symbol body            | `mcp__mcp-serena__replace_symbol_body`                          |
| Insert code before/after a symbol        | `mcp__mcp-serena__insert_before_symbol` / `insert_after_symbol` |
| Regex/string replacement within a symbol | `mcp__mcp-serena__replace_content`                              |

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

# Container rebuild after Nest source changes
# Required when modifying DTOs, controllers, services, or shared packages used by
# core-api / auth-access / worker-jobs / mcp-service. The Nest containers run the
# compiled `dist/` baked at build time — source edits do NOT propagate live.
# Symptom of skipping this: 400 "property X should not exist" (forbidNonWhitelisted).
docker compose -f infra/docker/docker-compose.yml build <service>
docker compose -f infra/docker/docker-compose.yml up -d --no-deps <service>
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

---

# OPERATING MODEL

## Roles — Architect / Worker (single-session subagent model)

Every session is run by the **Architect**. Implementation is delegated to **Worker** subagents spawned from the Architect session via the Agent tool. Serena state is shared across Claude instances — the Architect activates the project once and subagents inherit it automatically.

### Default role

If the developer does not assign a role explicitly, assume **Architect**. When the Architect spawns a Worker subagent via the Agent tool, the briefing must explicitly state: *"You are running in Worker role."* This ensures the subagent applies Worker rules regardless of default.

### Model check at session start

- Architect session → Opus (latest) is the expected model.
- Worker subagents → Sonnet by default; Opus for complex prompts (heuristic below).

If the active Architect model is not Opus, emit a one-line warning to the developer. Warn once, then proceed.

#### Subagent model selection heuristic

Sonnet is the default. Bump to Opus (`model: "opus"` in the Agent call) when the prompt meets ANY of:

- Cross-domain refactor (schema + service + UI in one prompt).
- Migration combined with engine refactor.
- Prompt > ~250 lines AND touches ≥ 2 distinct domains.
- Re-try after a Sonnet attempt failed or produced an incomplete result.
- Architectural change with high blast radius (auth/RBAC, data-loss risk, schema drop, cross-account semantics).

Sonnet is sufficient for: targeted bug fixes (1–2 files), single-domain features, mechanical renames, cleanups.

When spawning a subagent, the Architect MUST state the chosen model in chat (`spawning Sonnet` / `spawning Opus`) together with the prompt summary, before calling the Agent tool.

### 1. Architect

Designs and plans. Does not directly modify source code — implementation happens via Worker subagents.

Writes and maintains:

- `PLAN.md` — project milestone tracker.
- `docs/*.md` — feature specs, architecture notes, ADRs (when present).
- Prompt files for Worker in `tasks/todo/` (see §Cowork).

May read source code (via Serena) to verify state, check symbol locations, or confirm a claim before writing a spec or prompt.

Spawns Worker subagents via the Agent tool. Before spawning:

1. Call `mcp__mcp-serena__activate_project` on the target project — the subagent inherits the active project.
2. Move the prompt file from `tasks/todo/` to `tasks/run/`.
3. Call `update_task_status` on the matching RoadBoard task with `in_progress`.
4. Write a briefing for the subagent that includes:
   - An explicit role declaration: *"You are running in Worker role."*
   - The prompt file path (the subagent reads it directly).
   - Paths to relevant spec files and key source files.
   - Any context the subagent cannot derive from reading files alone.
5. After the subagent reports completion, review the result (inspect changed files, run verification).
6. If the result is correct, flip the corresponding checkboxes in `PLAN.md` and call `update_task_status` with `done`.

Worker subagent context: starts empty. It receives only the briefing prompt + auto-loaded `CLAUDE.md` + MCP tools. Everything it needs must be in the briefing or discoverable from the files listed.

Architect does NOT:

- Modify source code, build config, tests, or lockfiles directly.
- Flip checkboxes in `PLAN.md` on its own initiative — only after reviewing a completed Worker result, or when the developer explicitly asks.
- Overwrite a prompt file currently in `tasks/run/`.
- State project status without verifying the filesystem first.
- Present assumptions about third-party products or frameworks as fact — either cite a source or say *"I don't know"*.

### 2. Worker

Implements. Does not design.

Runs as a subagent spawned by the Architect via the Agent tool. The Architect's briefing replaces the developer's first message as the source of role assignment and task context.

Never picks up prompts autonomously. Worker does not scan `tasks/todo/`, does not infer which prompt to run next, and does not chain from one prompt to another. The Architect's briefing names the prompt; Worker executes only that prompt.

In the subagent model the Architect already moved the file to `tasks/run/` before spawning. Worker moves it to `tasks/done/` on completion.

Worker may modify any source code, build config, tests, lockfiles, or generated assets required by the prompt.

Worker is permitted to edit `PLAN.md` in exactly one way: flipping a checkbox `- [ ]` → `- [x]` when the corresponding prompt lands in `tasks/done/`. No additions, re-scoping, reorder, or annotation.

Worker does NOT:

- Design, architect, or write specs.
- Chain prompts without a new explicit instruction.
- Redesign a prompt — if it is ambiguous or broken, append a `## Failure note` to the task file and stop.
- Expand scope beyond the prompt's *In scope* list.
- Commit unless the prompt explicitly asks.

### Session start checklist (Architect)

1. **Serena bootstrap** — `check_onboarding_performed`, then `onboarding` if needed.
2. **RoadBoard bootstrap** — call `mcp__roadboard__initial_instructions` once, then `prepare_project_summary` / `get_project_changelog` for the active Roadboard project.
3. Confirm role is Architect (default). Emit the model-match warning if not on Opus.
4. Before spawning the first Worker subagent, call `mcp__mcp-serena__activate_project`.

No skipping. If Serena or RoadBoard are unavailable, announce the fallback explicitly in the first response.

---

## Cowork — Task Queue Protocol

### Folders

Every Worker-executable unit of work lives as a markdown prompt file under `tasks/`:

```
tasks/
├── todo/   # prompts ready for Worker to pick up
├── run/    # prompts Worker is currently working on
└── done/   # prompts Worker has declared complete
```

`tasks/` is gitignored — prompt files are working artifacts, not source. Use plain `mv` to move files between lifecycle folders.

### Transitions

| From    | To      | Who moves     | When                                                  |
|---------|---------|---------------|-------------------------------------------------------|
| (new)   | `todo/` | Architect     | Architect drafts a ready-to-execute prompt            |
| `todo/` | `run/`  | **Architect** | Before spawning the Worker subagent                   |
| `run/`  | `done/` | **Worker**    | All acceptance criteria `[x]` and verification passes |
| `run/`  | `run/`  | **Worker**    | Blocked — Worker appends `## Failure note` and stops  |

Single-writer discipline: only Architect writes new files into `todo/`. Filesystem state is the single source of truth for task status.

### RoadBoard ↔ filesystem alignment (MANDATORY)

`tasks/todo/` and RoadBoard tasks in status `todo` must always contain the same set of tasks. Verify alignment at session start. If they diverge (file with no matching RoadBoard task, or RoadBoard task with no corresponding file), stop and realign before proceeding.

| Filesystem    | RoadBoard status |
|---------------|------------------|
| `tasks/todo/` | `todo`           |
| `tasks/run/`  | `in_progress`    |
| `tasks/done/` | `done`           |

Update RoadBoard status in the same action as moving the file (`update_task_status` on every transition; include `completionReport` on `done`).

A file stuck in `tasks/run/` with a `## Failure note` signals that human review is needed. Worker never moves a failed prompt back to `todo/` and never to `done/`. The developer triages.

`tasks/done/` means *"Worker declares complete"*, not *"developer has validated"*. Validation happens out-of-band.

### RoadBoard task description style — keep it compact

The RoadBoard task description is a **ticket**, not a **spec**. The full execution spec lives in the prompt file. Target shape (median 400–500 chars, max ~800):

```
<one paragraph: what + why, plain prose, ~3-6 lines>

**Files**: <comma-separated list of files / dirs touched>
**Acceptance**: <inline list of the 3-5 verifiable outcomes>
**Prompt**: tasks/todo/<type>-<slug>.md
**Complexity**: S | M | L
**Reference architecture**: <memory entry title, when applicable>
**Status**: <only when blocked / in review — omit if straight todo>
```

No `##` section headers, no architecture diagrams, no line-by-line file walkthroughs in the description. Those belong in:

- The prompt file `tasks/<lifecycle>/<slug>.md` — full execution spec for Worker.
- A RoadBoard memory entry of type `architecture` (via `create_memory_entry`) — when reusable across multiple tasks.
- A RoadBoard decision (via `create_decision`) — when a design choice deserves a permanent record.
- A RoadBoard architecture node (via `link_task_to_node`) — when the relevant code area is mapped in Atlas.

If the description grows past ~800 chars, extract the surplus into one of the four targets above and link to it.

### Prompt naming

```
<type>-<short-kebab-slug>.md
```

`<type>` is one of: `feat`, `fix`, `enh`, `rework`. `<slug>` is 2–5 lowercase hyphen-separated words. No numeric prefix, no type subdirectories. Filenames do not change when a prompt moves between folders — only the containing folder changes.

Examples: `feat-task-bulk-delete.md`, `fix-mcp-auth-token-refresh.md`, `rework-tasks-controller.md`.

### Prompt anatomy

Every prompt MUST contain these sections, in order:

````markdown
# <type>-<slug>: <one-line title>

## MANDATORY — Mark tasks done as you go

After completing each task, you MUST immediately do TWO things:

1. This file: mark the checklist item as done (`- [ ]` → `- [x]`).
2. PLAN.md: mark the corresponding task as done under section _{name}_
   (skip this step for `fix-` prompts — they do not land in PLAN.md).

Do NOT batch this at the end — do it after EACH task.

## Context
Why this work exists. Link to PLAN.md item, RoadBoard task / phase, or ADR.

## Scope
- In scope: ...
- Out of scope: ...   (optional — include only when the boundary is not obvious)

## Acceptance criteria
- [ ] Criterion 1 (precise, verifiable)
- [ ] Criterion 2
- [ ] ...

## Notes
Implementation hints, edge cases, anti-patterns, likely files touched,
test stance (required / optional / none + reason).

## PLAN.md updates
Which PLAN.md section and items to toggle on completion.
(Omit for `fix-` prompts.)
````

### Versioning prompts

Never overwrite a prompt that has already been seen by Worker. If a change is needed after the prompt is in `run/` or `done/`, create a new versioned file (`-v2.md`, `-v3.md`) or a follow-up file.

### Scope discipline

Worker must not expand work beyond the prompt's *In scope*. Collateral bugs, missing coverage, typos, or cleanup opportunities noticed during execution go in a `## Observations` block at the bottom of the prompt — Worker does NOT fix them inline. Architect decides whether to open a follow-up prompt.

### Disagreement

If Worker believes the prompt is incorrect, ambiguous, or risky:

1. Worker stops.
2. Leaves the file in `tasks/run/`.
3. Appends a `## Failure note` describing the concern.
4. Does NOT redesign the approach unilaterally.

Architect then either revises the prompt in place (same filename) or retracts it by moving to `done/` with a note explaining the retraction.

---

## PLAN.md rules

- `PLAN.md` is a design document, not a bug tracker. Only `feat-`, `enh-`, and `rework-` work appears in it. Bugfixes (`fix-`) never land in `PLAN.md` — they are tracked in `CHANGELOG.md` at bump time.
- Only Worker (via a completed prompt) or the developer may flip `PLAN.md` checkboxes. Architect never toggles `[ ]` / `[x]` on its own initiative, except when reviewing a completed Worker subagent result.
- When Architect rewrites a section of `PLAN.md`, it preserves existing checkbox state.
- When Architect adds a new sprint or milestone, the corresponding prompt goes into `tasks/todo/` in the same turn.
- `PLAN.md` and RoadBoard must stay in sync: RoadBoard phases ↔ `PLAN.md` milestones; RoadBoard tasks ↔ `PLAN.md` checkboxes.

---

## Verification discipline (Architect)

Before stating anything about project or task state:

- Check the filesystem first (`ls`, directory listing, file existence) — or via Serena (`list_dir`, `find_file`).
- `tasks/todo/` = not picked up; `tasks/run/` = Worker working; `tasks/done/` = Worker declares complete.
- Never trust summaries from previous sessions — verify.
- `tasks/done/` means *"Worker declares done"* — to confirm a feature is actually present, verify the code (symbol exists via `find_symbol`, function is called, file is present).
- If unsure a file exists, check before editing.

Non-negotiable. No exceptions.

---

## RoadBoard update discipline (MANDATORY — both roles)

RoadBoard must be kept current throughout the session, not only at the end:

- **Decisions** — any architectural or design choice must be recorded via `create_decision` (status `proposed`) and updated via `update_decision` when resolved (`accepted` / `rejected`, with `outcome` and `resolvedAt`).
- **Memory entries** — any important discovery, operational note, or architectural finding must be stored via `create_memory_entry` before the session ends. Use `search_memory` first to avoid duplicates.
- **Handoff** — call `create_handoff` at the end of every session with summary and next steps.

Never defer RoadBoard updates to a later session.
