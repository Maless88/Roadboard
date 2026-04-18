# Roadboard 2.0 Wave 1 Executable TODO (Resequenced)

> **Status: COMPLETED** — Wave 1 fully implemented as of Wave 3 completion (2026-04-15).
> Checklist updated retroactively. This document is now a historical reference.

## Goal
Turn the resequenced Wave 1 into an executable technical checklist.

This version assumes:
**platform-first, MCP-first, human UI later.**

## Execution Rule
Build the first end-to-end path for LLM workflows, not for the human UI.

That means:
- bootstrap the repo first
- create the domain backbone
- create auth/grants/tokens backbone
- make one thin MCP path work end-to-end
- establish local/remote storage primitives
- postpone the web UI

## Phase A - Repository Bootstrap

### A1. Root workspace files
- [x] Create root `package.json`
- [x] Create `pnpm-workspace.yaml`
- [x] Create `turbo.json`
- [x] Create `tsconfig.base.json`
- [x] Create root `.gitignore`
- [x] Create root `.env.example`
- [x] Create root `README.md`

### A2. Root folders
- [x] Create `apps/`
- [x] Create `packages/`
- [x] Create `infra/docker/`
- [x] Create `infra/scripts/`
- [x] Create `docs/roadboard2/`
- [x] Create `.github/workflows/`

### A3. App folders for resequenced Wave 1
- [x] Create `apps/core-api/`
- [x] Create `apps/auth-access/`
- [x] Create `apps/mcp-service/`

### A4. Package folders
- [x] Create `packages/domain/`
- [x] Create `packages/database/`
- [x] Create `packages/auth/`
- [x] Create `packages/grants/`
- [x] Create `packages/config/`
- [x] Create `packages/mcp-contracts/`

## Phase B - Tooling and Dev Environment

### B1. Workspace tooling
- [x] Configure `pnpm` workspaces
- [x] Configure `turborepo` tasks for build, dev, lint, test, typecheck
- [x] Add shared TypeScript config presets
- [x] Add shared ESLint config
- [x] Add shared Prettier config

### B2. Docker local environment
- [x] Create `infra/docker/docker-compose.yml`
- [x] Add PostgreSQL service
- [x] Add Redis service
- [x] Add health checks
- [x] Add named volumes
- [x] Add bootstrap instructions to docs

### B3. Helper scripts
- [x] Create dev bootstrap script
- [x] Create DB migrate script
- [x] Create DB reset script
- [x] Create seed script placeholder

## Phase C - Shared Package Backbone

### C1. `packages/domain`
- [x] Add `ProjectStatus` enum
- [x] Add `PhaseStatus` enum
- [x] Add `MilestoneStatus` enum
- [x] Add `TaskStatus` enum
- [x] Add `TaskPriority` enum
- [x] Add `MemoryEntryType` enum with at least `done` and `next`
- [x] Add shared domain export index

### C2. `packages/database`
- [x] Initialize Prisma
- [x] Add PostgreSQL datasource config
- [x] Add migration commands
- [x] Add Prisma client generation setup
- [x] Add local SQLite schema/bootstrap primitives placeholder

### C3. `packages/auth`
- [x] Add password hashing helper
- [x] Add password verification helper
- [x] Add token hashing helper
- [x] Add token verification primitives
- [x] Add shared auth type exports

### C4. `packages/grants`
- [x] Add grant type enum
- [x] Add permission constants
- [x] Add helper to evaluate direct user grant
- [x] Add helper to evaluate team-derived grant
- [x] Add helper to compute effective access

### C5. `packages/config`
- [x] Add shared ESLint config package
- [x] Add shared Prettier config package
- [x] Add env parsing helper
- [x] Add app config loading helper

### C6. `packages/mcp-contracts`
- [x] Add read tool request/response schemas
- [x] Add write tool request/response schemas
- [x] Add shared MCP tool metadata exports

## Phase D - Database Schema Wave 1 (Resequenced)

### D1. Core domain tables
- [x] Define `projects`
- [x] Define `phases`
- [x] Define `milestones`
- [x] Define `tasks`
- [x] Define `memory_entries`

### D2. Auth/access tables
- [x] Define `users`
- [x] Define `teams`
- [x] Define `team_memberships`
- [x] Define `project_grants`
- [x] Define `sessions`
- [x] Define `mcp_tokens`

### D3. Local persistence primitives
- [x] Define local SQLite pattern for:
  - local project snapshot
  - local task snapshot
  - pending operation

### D4. Migration and seed
- [x] Generate initial PostgreSQL migration
- [x] Apply migration locally
- [x] Seed 4 initial users (development team)
- [x] Seed 1 initial team
- [x] Add all 4 users as team members
- [x] Seed 1 initial project (Roadboard)
- [x] Seed project grants for all 4 users

## Phase E - `core-api` Bootstrap

### E1. Core app structure
- [x] Create NestJS app bootstrap
- [x] Enable Fastify adapter
- [x] Add app module
- [x] Add config module
- [x] Add Prisma integration
- [x] Add health module

### E2. Domain modules to create
- [x] `projects`
- [x] `phases`
- [x] `milestones`
- [x] `tasks`
- [x] `memory`

### E3. `projects` module
- [x] Create module file
- [x] Create controller
- [x] Create service
- [x] Create DTOs
- [x] Add create project endpoint
- [x] Add list projects endpoint
- [x] Add project detail endpoint

### E4. `phases` module
- [x] Create module file
- [x] Create controller
- [x] Create service
- [x] Create DTOs
- [x] Add create phase endpoint
- [x] Add list phases by project endpoint

### E5. `milestones` module
- [x] Create module file
- [x] Create controller
- [x] Create service
- [x] Create DTOs
- [x] Add create milestone endpoint
- [x] Add list milestones by project endpoint

### E6. `tasks` module
- [x] Create module file
- [x] Create controller
- [x] Create service
- [x] Create DTOs
- [x] Add create task endpoint
- [x] Add list tasks by project endpoint
- [x] Add patch task endpoint
- [x] Add status update handling
- [x] Add priority handling

### E7. `memory` module
- [x] Create module file
- [x] Create controller
- [x] Create service
- [x] Create DTOs
- [x] Add create memory entry endpoint
- [x] Add list project memory endpoint
- [x] Support `done` / `next` types

## Phase F - `auth-access` Bootstrap

### F1. Core app structure
- [x] Create NestJS app bootstrap
- [x] Enable Fastify adapter
- [x] Add app module
- [x] Add config module
- [x] Add Prisma integration
- [x] Add health module

### F2. Modules to create
- [x] `users`
- [x] `teams`
- [x] `memberships`
- [x] `grants`
- [x] `tokens`
- [x] `auth`
- [x] `sessions`

### F3. `auth` module
- [x] Add login DTO
- [x] Add login controller
- [x] Add login service
- [x] Validate seeded user credentials
- [x] Create session record on login

### F4. `users` module
- [x] Add current user endpoint support

### F5. `teams` module
- [x] Create module file
- [x] Create controller
- [x] Create service
- [x] Add create team endpoint
- [x] Add list teams endpoint

### F6. `memberships` module
- [x] Create module file
- [x] Create controller
- [x] Create service
- [x] Add add-membership endpoint
- [x] Add list memberships endpoint

### F7. `grants` module
- [x] Create module file
- [x] Create controller
- [x] Create service
- [x] Add create grant endpoint
- [x] Add list project grants endpoint
- [x] Add effective permission check helper

### F8. `tokens` module
- [x] Create module file
- [x] Create controller
- [x] Create service
- [x] Add issue MCP token endpoint
- [x] Add revoke token endpoint
- [x] Add token validation service path

### F9. `sessions`
- [x] Add logout flow
- [x] Add session invalidation logic
- [x] Add `me` endpoint

## Phase G - Service Integration (Resequenced Wave 1)

### G1. Identity and permission propagation
- [x] Define request identity contract between `auth-access` and `core-api`
- [x] Add grant-check call path from `core-api` to `auth-access`
- [x] Add team-aware grant resolution path
- [x] Protect project/task/memory mutations by grant checks

### G2. Token path
- [x] Define token validation contract for `mcp-service`
- [x] Add scope evaluation rules
- [x] Add clean denial behavior for invalid/revoked tokens

## Phase H - `mcp-service` Minimum Slice

### H1. MCP app bootstrap
- [x] Create service bootstrap
- [x] Create MCP server bootstrap
- [x] Create tool registry
- [x] Wire shared MCP contracts

### H2. Clients
- [x] Add `core-api` client
- [x] Add `auth-access` client

### H3. Policies
- [x] Add token scope guard
- [x] Add tool usage guard
- [x] Add basic workflow rules

### H4. First read tools
- [x] `list_projects`
- [x] `get_project`
- [x] `list_active_tasks`
- [x] `get_project_memory`

### H5. First narrow write tools
- [x] `create_task`
- [x] `update_task_status`
- [x] `create_memory_entry`

### H6. Audit basics
- [x] add MCP request logging
- [x] add denied action logging

## Phase I - Local / Remote Storage Pattern Checkpoint

### I1. Local primitives
- [x] define SQLite bootstrap file/module
- [x] define `pending_operation` structure
- [x] define local snapshot structure for project/task

### I2. Pattern proof
- [x] document what is remote truth
- [x] document what is local staged state
- [x] prove one local operation can be journaled structurally

Important:
This phase is about proving the architecture, not full sync behavior.

## Phase J - Test Minimum

### J1. Shared package tests
- [x] test auth hashing helpers
- [x] test token hashing helpers
- [x] test grant evaluation helpers
- [x] test MCP contract schema validity

### J2. `core-api` integration tests
- [x] create/list project
- [x] create/list task
- [x] create/list memory entry

### J3. `auth-access` integration tests
- [x] login success/failure
- [x] create team
- [x] add membership
- [x] create project grant
- [x] issue/revoke token
- [x] token validation path

### J4. `mcp-service` contract/integration tests
- [x] valid token can use read tool
- [x] invalid token is denied
- [x] valid token can use narrow write tool
- [x] denied action is audited

## Phase K - CI Minimum

### K1. GitHub workflow
- [x] lint job
- [x] typecheck job
- [x] package unit test job
- [x] `core-api` integration job
- [x] `auth-access` integration job
- [x] `mcp-service` contract/integration job

## Suggested First Vertical Slice (Updated)
If you want the smartest first implementation slice now, do this first:

1. bootstrap repo
2. PostgreSQL + Prisma
3. `users/auth` in `auth-access`
4. `projects` in `core-api`
5. `mcp-contracts`
6. `mcp-service` with `list_projects`

Then extend to:
- teams
- memberships
- grants
- tokens
- tasks
- memory
- write tools
- local persistence primitives

This gets an LLM-usable path alive quickly without losing the architecture.

## Definition Of Done
Resequenced Wave 1 executable plan is complete when:
- all platform-first Wave 1 folders and tooling exist
- central DB schema is working
- `core-api` and `auth-access` are alive and integrated
- `mcp-service` can read and write selected project context safely
- local/remote persistence pattern is established
- the initial 4-person development team is represented correctly in the platform
- minimum tests and CI are running

## Immediate Next Step
The immediate next execution step after this TODO is:
- create the mono-repo skeleton and root tooling
- then implement the first vertical slice: auth + projects + MCP read path
