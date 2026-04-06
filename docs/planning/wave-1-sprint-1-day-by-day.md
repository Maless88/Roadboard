# Roadboard 2.0 Wave 1 Executable TODO

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

### A3. App folders
- [ ] Create `apps/core-api/`
- [ ] Create `apps/auth-access/`
- [ ] Create `apps/web-app/`
- [ ] Create `apps/mcp-service/`
- [ ] Create `apps/local-sync-bridge/`
- [ ] Create `apps/worker-jobs/`

### A4. Package folders
- [ ] Create `packages/domain/`
- [ ] Create `packages/database/`
- [ ] Create `packages/auth/`
- [ ] Create `packages/grants/`
- [ ] Create `packages/config/`
- [ ] Create `packages/mcp-contracts/`
- [ ] Create `packages/api-contracts/`
- [ ] Create `packages/observability/`

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
- [ ] Add named volumes
- [ ] Add health checks
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
- [ ] Add shared domain constants
- [ ] Add shared type exports index

### C2. `packages/database`
- [ ] Initialize Prisma
- [ ] Add PostgreSQL datasource config
- [ ] Add first schema file(s)
- [ ] Add migration commands
- [ ] Add Prisma client generation setup

### C3. `packages/auth`
- [ ] Add password hashing helper
- [ ] Add password verification helper
- [ ] Add session helper primitives
- [ ] Add auth-related shared types

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

## Phase D - Database Schema Wave 1

### D1. Core domain tables
- [ ] Define `projects`
- [ ] Define `phases`
- [ ] Define `milestones`
- [ ] Define `tasks`

### D2. Auth/access tables
- [ ] Define `users`
- [ ] Define `teams`
- [ ] Define `team_memberships`
- [ ] Define `project_grants`
- [ ] Define `sessions`

### D3. Relations
- [ ] Project -> Phase
- [ ] Project -> Milestone
- [ ] Project -> Task
- [ ] Phase -> Milestone
- [ ] Milestone -> Task
- [ ] Team -> Membership
- [ ] User -> Membership
- [ ] Project -> Grant

### D4. Migration
- [ ] Generate initial migration
- [ ] Apply migration locally
- [ ] Verify schema in PostgreSQL

### D5. Seed basics
- [ ] Create 4 initial users (development team)
- [ ] Create one initial team
- [ ] Add all 4 users as team members
- [ ] Create one initial project (Roadboard)
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

### E7. Minimum `core-api` endpoints
- [ ] `GET /health`
- [ ] `POST /projects`
- [ ] `GET /projects`
- [ ] `GET /projects/:id`
- [ ] `POST /projects/:id/phases`
- [ ] `GET /projects/:id/phases`
- [ ] `POST /projects/:id/milestones`
- [ ] `GET /projects/:id/milestones`
- [ ] `POST /projects/:id/tasks`
- [ ] `GET /projects/:id/tasks`
- [ ] `PATCH /tasks/:id`

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
- [ ] `auth`
- [ ] `sessions`

### F3. `users` module
- [ ] Create module file
- [ ] Create controller
- [ ] Create service
- [ ] Add current user endpoint support

### F4. `teams` module
- [ ] Create module file
- [ ] Create controller
- [ ] Create service
- [ ] Add create team endpoint
- [ ] Add list teams endpoint

### F5. `memberships` module
- [ ] Create module file
- [ ] Create controller
- [ ] Create service
- [ ] Add add-member endpoint
- [ ] Add list memberships endpoint

### F6. `grants` module
- [ ] Create module file
- [ ] Create controller
- [ ] Create service
- [ ] Add create grant endpoint
- [ ] Add list project grants endpoint
- [ ] Add effective permission check helper

### F7. `auth` and `sessions`
- [ ] Add login endpoint
- [ ] Add logout endpoint
- [ ] Add `me` endpoint
- [ ] Add session creation logic
- [ ] Add session invalidation logic

### F8. Minimum `auth-access` endpoints
- [ ] `GET /health`
- [ ] `POST /auth/login`
- [ ] `POST /auth/logout`
- [ ] `GET /auth/me`
- [ ] `POST /teams`
- [ ] `GET /teams`
- [ ] `POST /teams/:id/memberships`
- [ ] `POST /projects/:id/grants`
- [ ] `GET /projects/:id/grants`

## Phase G - Service Integration (Wave 1)

### G1. Identity propagation
- [ ] Define request identity contract between `auth-access` and `core-api`
- [ ] Add grant-check call path from `core-api` to `auth-access`
- [ ] Protect project/task mutations by grant checks

### G2. Minimum protected behavior
- [ ] Only authorized users can create/update project content
- [ ] Unauthorized access returns clean denial
- [ ] Project list only returns visible projects for current user if ready in this wave

## Phase H - `web-app` Minimum Slice

### H1. Web app bootstrap
- [ ] Initialize Next.js app
- [ ] Add TypeScript config
- [ ] Add shared lint/config wiring
- [ ] Add base layout
- [ ] Add env config wiring

### H2. Pages to create
- [ ] Login page
- [ ] Project list page
- [ ] Project detail page
- [ ] Task create/edit view or modal

### H3. Minimum flows
- [ ] User can log in
- [ ] User can list projects
- [ ] User can open one project
- [ ] User can see phases, milestones, tasks
- [ ] User can create a task
- [ ] User can update task status/priority

### H4. Minimum UI requirements
- [ ] clear project list
- [ ] clear project detail structure
- [ ] visible phase/milestone grouping
- [ ] simple task editing
- [ ] no design overreach in Wave 1

## Phase I - Seed and Self-Hosting Checkpoint

### I1. Seed / bootstrap data
- [ ] Create 4 initial users
- [ ] Create one initial team with all 4 users
- [ ] Create Roadboard project record
- [ ] Create first phases for Roadboard
- [ ] Create first milestones for Roadboard
- [ ] Create first tasks for Roadboard

### I2. Success checkpoint
- [ ] Log in to Roadboard with all 4 users
- [ ] Open Roadboard project with all 4 users
- [ ] Manage its tasks from UI
- [ ] Verify grants work for all 4 users

## Phase J - Test Minimum

### J1. Shared package tests
- [ ] test auth hashing helpers
- [ ] test grant evaluation helpers

### J2. `core-api` integration tests
- [ ] create project
- [ ] create phase
- [ ] create milestone
- [ ] create task
- [ ] update task

### J3. `auth-access` integration tests
- [ ] login success/failure
- [ ] create team
- [ ] add membership
- [ ] create project grant

### J4. `web-app` e2e smoke
- [ ] login
- [ ] open project
- [ ] create or update task

## Phase K - CI Minimum

### K1. GitHub workflow
- [ ] lint job
- [ ] typecheck job
- [ ] package unit test job
- [ ] `core-api` integration job
- [ ] `auth-access` integration job
- [ ] `web-app` smoke e2e job

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
