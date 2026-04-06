# Roadboard 2.0 Wave 1 Executable TODO (Resequenced)

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
- [ ] Create root `package.json`
- [ ] Create `pnpm-workspace.yaml`
- [ ] Create `turbo.json`
- [ ] Create `tsconfig.base.json`
- [ ] Create root `.gitignore`
- [ ] Create root `.env.example`
- [ ] Create root `README.md`

### A2. Root folders
- [ ] Create `apps/`
- [ ] Create `packages/`
- [ ] Create `infra/docker/`
- [ ] Create `infra/scripts/`
- [ ] Create `docs/roadboard2/`
- [ ] Create `.github/workflows/`

### A3. App folders for resequenced Wave 1
- [ ] Create `apps/core-api/`
- [ ] Create `apps/auth-access/`
- [ ] Create `apps/mcp-service/`

### A4. Package folders
- [ ] Create `packages/domain/`
- [ ] Create `packages/database/`
- [ ] Create `packages/auth/`
- [ ] Create `packages/grants/`
- [ ] Create `packages/config/`
- [ ] Create `packages/mcp-contracts/`

## Phase B - Tooling and Dev Environment

### B1. Workspace tooling
- [ ] Configure `pnpm` workspaces
- [ ] Configure `turborepo` tasks for build, dev, lint, test, typecheck
- [ ] Add shared TypeScript config presets
- [ ] Add shared ESLint config
- [ ] Add shared Prettier config

### B2. Docker local environment
- [ ] Create `infra/docker/docker-compose.yml`
- [ ] Add PostgreSQL service
- [ ] Add Redis service
- [ ] Add health checks
- [ ] Add named volumes
- [ ] Add bootstrap instructions to docs

### B3. Helper scripts
- [ ] Create dev bootstrap script
- [ ] Create DB migrate script
- [ ] Create DB reset script
- [ ] Create seed script placeholder

## Phase C - Shared Package Backbone

### C1. `packages/domain`
- [ ] Add `ProjectStatus` enum
- [ ] Add `PhaseStatus` enum
- [ ] Add `MilestoneStatus` enum
- [ ] Add `TaskStatus` enum
- [ ] Add `TaskPriority` enum
- [ ] Add `MemoryEntryType` enum with at least `done` and `next`
- [ ] Add shared domain export index

### C2. `packages/database`
- [ ] Initialize Prisma
- [ ] Add PostgreSQL datasource config
- [ ] Add migration commands
- [ ] Add Prisma client generation setup
- [ ] Add local SQLite schema/bootstrap primitives placeholder

### C3. `packages/auth`
- [ ] Add password hashing helper
- [ ] Add password verification helper
- [ ] Add token hashing helper
- [ ] Add token verification primitives
- [ ] Add shared auth type exports

### C4. `packages/grants`
- [ ] Add grant type enum
- [ ] Add permission constants
- [ ] Add helper to evaluate direct user grant
- [ ] Add helper to evaluate team-derived grant
- [ ] Add helper to compute effective access

### C5. `packages/config`
- [ ] Add shared ESLint config package
- [ ] Add shared Prettier config package
- [ ] Add env parsing helper
- [ ] Add app config loading helper

### C6. `packages/mcp-contracts`
- [ ] Add read tool request/response schemas
- [ ] Add write tool request/response schemas
- [ ] Add shared MCP tool metadata exports

## Phase D - Database Schema Wave 1 (Resequenced)

### D1. Core domain tables
- [ ] Define `projects`
- [ ] Define `phases`
- [ ] Define `milestones`
- [ ] Define `tasks`
- [ ] Define `memory_entries`

### D2. Auth/access tables
- [ ] Define `users`
- [ ] Define `teams`
- [ ] Define `team_memberships`
- [ ] Define `project_grants`
- [ ] Define `sessions`
- [ ] Define `mcp_tokens`

### D3. Local persistence primitives
- [ ] Define local SQLite pattern for:
  - local project snapshot
  - local task snapshot
  - pending operation

### D4. Migration and seed
- [ ] Generate initial PostgreSQL migration
- [ ] Apply migration locally
- [ ] Seed 4 initial users (development team)
- [ ] Seed 1 initial team
- [ ] Add all 4 users as team members
- [ ] Seed 1 initial project (Roadboard)
- [ ] Seed project grants for all 4 users

## Phase E - `core-api` Bootstrap

### E1. Core app structure
- [ ] Create NestJS app bootstrap
- [ ] Enable Fastify adapter
- [ ] Add app module
- [ ] Add config module
- [ ] Add Prisma integration
- [ ] Add health module

### E2. Domain modules to create
- [ ] `projects`
- [ ] `phases`
- [ ] `milestones`
- [ ] `tasks`
- [ ] `memory`

### E3. `projects` module
- [ ] Create module file
- [ ] Create controller
- [ ] Create service
- [ ] Create DTOs
- [ ] Add create project endpoint
- [ ] Add list projects endpoint
- [ ] Add project detail endpoint

### E4. `phases` module
- [ ] Create module file
- [ ] Create controller
- [ ] Create service
- [ ] Create DTOs
- [ ] Add create phase endpoint
- [ ] Add list phases by project endpoint

### E5. `milestones` module
- [ ] Create module file
- [ ] Create controller
- [ ] Create service
- [ ] Create DTOs
- [ ] Add create milestone endpoint
- [ ] Add list milestones by project endpoint

### E6. `tasks` module
- [ ] Create module file
- [ ] Create controller
- [ ] Create service
- [ ] Create DTOs
- [ ] Add create task endpoint
- [ ] Add list tasks by project endpoint
- [ ] Add patch task endpoint
- [ ] Add status update handling
- [ ] Add priority handling

### E7. `memory` module
- [ ] Create module file
- [ ] Create controller
- [ ] Create service
- [ ] Create DTOs
- [ ] Add create memory entry endpoint
- [ ] Add list project memory endpoint
- [ ] Support `done` / `next` types

## Phase F - `auth-access` Bootstrap

### F1. Core app structure
- [ ] Create NestJS app bootstrap
- [ ] Enable Fastify adapter
- [ ] Add app module
- [ ] Add config module
- [ ] Add Prisma integration
- [ ] Add health module

### F2. Modules to create
- [ ] `users`
- [ ] `teams`
- [ ] `memberships`
- [ ] `grants`
- [ ] `tokens`
- [ ] `auth`
- [ ] `sessions`

### F3. `auth` module
- [ ] Add login DTO
- [ ] Add login controller
- [ ] Add login service
- [ ] Validate seeded user credentials
- [ ] Create session record on login

### F4. `users` module
- [ ] Add current user endpoint support

### F5. `teams` module
- [ ] Create module file
- [ ] Create controller
- [ ] Create service
- [ ] Add create team endpoint
- [ ] Add list teams endpoint

### F6. `memberships` module
- [ ] Create module file
- [ ] Create controller
- [ ] Create service
- [ ] Add add-membership endpoint
- [ ] Add list memberships endpoint

### F7. `grants` module
- [ ] Create module file
- [ ] Create controller
- [ ] Create service
- [ ] Add create grant endpoint
- [ ] Add list project grants endpoint
- [ ] Add effective permission check helper

### F8. `tokens` module
- [ ] Create module file
- [ ] Create controller
- [ ] Create service
- [ ] Add issue MCP token endpoint
- [ ] Add revoke token endpoint
- [ ] Add token validation service path

### F9. `sessions`
- [ ] Add logout flow
- [ ] Add session invalidation logic
- [ ] Add `me` endpoint

## Phase G - Service Integration (Resequenced Wave 1)

### G1. Identity and permission propagation
- [ ] Define request identity contract between `auth-access` and `core-api`
- [ ] Add grant-check call path from `core-api` to `auth-access`
- [ ] Add team-aware grant resolution path
- [ ] Protect project/task/memory mutations by grant checks

### G2. Token path
- [ ] Define token validation contract for `mcp-service`
- [ ] Add scope evaluation rules
- [ ] Add clean denial behavior for invalid/revoked tokens

## Phase H - `mcp-service` Minimum Slice

### H1. MCP app bootstrap
- [ ] Create service bootstrap
- [ ] Create MCP server bootstrap
- [ ] Create tool registry
- [ ] Wire shared MCP contracts

### H2. Clients
- [ ] Add `core-api` client
- [ ] Add `auth-access` client

### H3. Policies
- [ ] Add token scope guard
- [ ] Add tool usage guard
- [ ] Add basic workflow rules

### H4. First read tools
- [ ] `list_projects`
- [ ] `get_project`
- [ ] `list_active_tasks`
- [ ] `get_project_memory`

### H5. First narrow write tools
- [ ] `create_task`
- [ ] `update_task_status`
- [ ] `create_memory_entry`

### H6. Audit basics
- [ ] add MCP request logging
- [ ] add denied action logging

## Phase I - Local / Remote Storage Pattern Checkpoint

### I1. Local primitives
- [ ] define SQLite bootstrap file/module
- [ ] define `pending_operation` structure
- [ ] define local snapshot structure for project/task

### I2. Pattern proof
- [ ] document what is remote truth
- [ ] document what is local staged state
- [ ] prove one local operation can be journaled structurally

Important:
This phase is about proving the architecture, not full sync behavior.

## Phase J - Test Minimum

### J1. Shared package tests
- [ ] test auth hashing helpers
- [ ] test token hashing helpers
- [ ] test grant evaluation helpers
- [ ] test MCP contract schema validity

### J2. `core-api` integration tests
- [ ] create/list project
- [ ] create/list task
- [ ] create/list memory entry

### J3. `auth-access` integration tests
- [ ] login success/failure
- [ ] create team
- [ ] add membership
- [ ] create project grant
- [ ] issue/revoke token
- [ ] token validation path

### J4. `mcp-service` contract/integration tests
- [ ] valid token can use read tool
- [ ] invalid token is denied
- [ ] valid token can use narrow write tool
- [ ] denied action is audited

## Phase K - CI Minimum

### K1. GitHub workflow
- [ ] lint job
- [ ] typecheck job
- [ ] package unit test job
- [ ] `core-api` integration job
- [ ] `auth-access` integration job
- [ ] `mcp-service` contract/integration job

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
