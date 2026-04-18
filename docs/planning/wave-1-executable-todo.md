# Roadboard 2.0 Wave 1 Executable TODO

> **Status: COMPLETED** — Wave 1 fully implemented as of Wave 3 completion (2026-04-15).
> Checklist updated retroactively. This document is now a historical reference.

## Goal
Turn Wave 1 into an executable technical checklist.

This document is meant to bridge design and implementation.
It focuses on concrete deliverables, folder creation, first modules, first schemas, first endpoints, first UI pages, and minimum tests.

## Execution Rule
Work top-down, but commit in small vertical slices.

That means:
- bootstrap the repo first
- create the domain backbone
- make one thin path work end-to-end
- expand only after the first path is alive

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

### A3. App folders
- [x] Create `apps/core-api/`
- [x] Create `apps/auth-access/`
- [x] Create `apps/web-app/`
- [x] Create `apps/mcp-service/`
- [x] Create `apps/local-sync-bridge/`
- [x] Create `apps/worker-jobs/`

### A4. Package folders
- [x] Create `packages/domain/`
- [x] Create `packages/database/`
- [x] Create `packages/auth/`
- [x] Create `packages/grants/`
- [x] Create `packages/config/`
- [x] Create `packages/mcp-contracts/`
- [x] Create `packages/api-contracts/`
- [x] Create `packages/observability/`

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
- [x] Add named volumes
- [x] Add health checks
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
- [x] Add shared domain constants
- [x] Add shared type exports index

### C2. `packages/database`
- [x] Initialize Prisma
- [x] Add PostgreSQL datasource config
- [x] Add first schema file(s)
- [x] Add migration commands
- [x] Add Prisma client generation setup

### C3. `packages/auth`
- [x] Add password hashing helper
- [x] Add password verification helper
- [x] Add session helper primitives
- [x] Add auth-related shared types

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

## Phase D - Database Schema Wave 1

### D1. Core domain tables
- [x] Define `projects`
- [x] Define `phases`
- [x] Define `milestones`
- [x] Define `tasks`

### D2. Auth/access tables
- [x] Define `users`
- [x] Define `teams`
- [x] Define `team_memberships`
- [x] Define `project_grants`
- [x] Define `sessions`

### D3. Relations
- [x] Project -> Phase
- [x] Project -> Milestone
- [x] Project -> Task
- [x] Phase -> Milestone
- [x] Milestone -> Task
- [x] Team -> Membership
- [x] User -> Membership
- [x] Project -> Grant

### D4. Migration
- [x] Generate initial migration
- [x] Apply migration locally
- [x] Verify schema in PostgreSQL

### D5. Seed basics
- [x] Create 4 initial users (development team)
- [x] Create one initial team
- [x] Add all 4 users as team members
- [x] Create one initial project (Roadboard)
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

### E7. Minimum `core-api` endpoints
- [x] `GET /health`
- [x] `POST /projects`
- [x] `GET /projects`
- [x] `GET /projects/:id`
- [x] `POST /projects/:id/phases`
- [x] `GET /projects/:id/phases`
- [x] `POST /projects/:id/milestones`
- [x] `GET /projects/:id/milestones`
- [x] `POST /projects/:id/tasks`
- [x] `GET /projects/:id/tasks`
- [x] `PATCH /tasks/:id`

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
- [x] `auth`
- [x] `sessions`

### F3. `users` module
- [x] Create module file
- [x] Create controller
- [x] Create service
- [x] Add current user endpoint support

### F4. `teams` module
- [x] Create module file
- [x] Create controller
- [x] Create service
- [x] Add create team endpoint
- [x] Add list teams endpoint

### F5. `memberships` module
- [x] Create module file
- [x] Create controller
- [x] Create service
- [x] Add add-member endpoint
- [x] Add list memberships endpoint

### F6. `grants` module
- [x] Create module file
- [x] Create controller
- [x] Create service
- [x] Add create grant endpoint
- [x] Add list project grants endpoint
- [x] Add effective permission check helper

### F7. `auth` and `sessions`
- [x] Add login endpoint
- [x] Add logout endpoint
- [x] Add `me` endpoint
- [x] Add session creation logic
- [x] Add session invalidation logic

### F8. Minimum `auth-access` endpoints
- [x] `GET /health`
- [x] `POST /auth/login`
- [x] `POST /auth/logout`
- [x] `GET /auth/me`
- [x] `POST /teams`
- [x] `GET /teams`
- [x] `POST /teams/:id/memberships`
- [x] `POST /projects/:id/grants`
- [x] `GET /projects/:id/grants`

## Phase G - Service Integration (Wave 1)

### G1. Identity propagation
- [x] Define request identity contract between `auth-access` and `core-api`
- [x] Add grant-check call path from `core-api` to `auth-access`
- [x] Protect project/task mutations by grant checks

### G2. Minimum protected behavior
- [x] Only authorized users can create/update project content
- [x] Unauthorized access returns clean denial
- [x] Project list only returns visible projects for current user if ready in this wave

## Phase H - `web-app` Minimum Slice

### H1. Web app bootstrap
- [x] Initialize Next.js app
- [x] Add TypeScript config
- [x] Add shared lint/config wiring
- [x] Add base layout
- [x] Add env config wiring

### H2. Pages to create
- [x] Login page
- [x] Project list page
- [x] Project detail page
- [x] Task create/edit view or modal

### H3. Minimum flows
- [x] User can log in
- [x] User can list projects
- [x] User can open one project
- [x] User can see phases, milestones, tasks
- [x] User can create a task
- [x] User can update task status/priority

### H4. Minimum UI requirements
- [x] clear project list
- [x] clear project detail structure
- [x] visible phase/milestone grouping
- [x] simple task editing
- [x] no design overreach in Wave 1

## Phase I - Seed and Self-Hosting Checkpoint

### I1. Seed / bootstrap data
- [x] Create 4 initial users
- [x] Create one initial team with all 4 users
- [x] Create Roadboard project record
- [x] Create first phases for Roadboard
- [x] Create first milestones for Roadboard
- [x] Create first tasks for Roadboard

### I2. Success checkpoint
- [x] Log in to Roadboard with all 4 users
- [x] Open Roadboard project with all 4 users
- [x] Manage its tasks from UI
- [x] Verify grants work for all 4 users

## Phase J - Test Minimum

### J1. Shared package tests
- [x] test auth hashing helpers
- [x] test grant evaluation helpers

### J2. `core-api` integration tests
- [x] create project
- [x] create phase
- [x] create milestone
- [x] create task
- [x] update task

### J3. `auth-access` integration tests
- [x] login success/failure
- [x] create team
- [x] add membership
- [x] create project grant

### J4. `web-app` e2e smoke
- [x] login
- [x] open project
- [x] create or update task

## Phase K - CI Minimum

### K1. GitHub workflow
- [x] lint job
- [x] typecheck job
- [x] package unit test job
- [x] `core-api` integration job
- [x] `auth-access` integration job
- [x] `web-app` smoke e2e job

## Suggested First Vertical Slice
If you want the smartest first implementation slice, do this first:

1. bootstrap repo
2. PostgreSQL + Prisma
3. `projects` in `core-api`
4. `users/auth` in `auth-access`
5. login page in `web-app`
6. project list page in `web-app`

Then extend to:
- phases
- milestones
- tasks
- grants

This gets something alive quickly without losing the architecture.

## Definition Of Done
Wave 1 executable plan is complete when:
- all core Wave 1 folders and tooling exist
- central DB schema is working
- `core-api` and `auth-access` are alive and integrated
- minimal `web-app` works end-to-end
- Roadboard project is tracked inside Roadboard
- minimum tests and CI are running

## Immediate Next Step
The immediate next execution step after this TODO is:
- create the mono-repo skeleton and root tooling
- then implement the first vertical slice: auth + projects + project list UI
