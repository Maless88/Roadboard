# Roadboard 2.0 Wave 1 - Sprint 1 Day-by-Day (Resequenced)

> **Status: COMPLETED** — Sprint 1 fully executed. All success criteria met.
> Checklist updated retroactively. This document is now a historical reference.

## Sprint 1 Goal
Create the first live LLM-usable vertical slice of Roadboard 2.0:
- mono-repo bootstrap
- local dev environment
- central PostgreSQL schema bootstrap
- minimal `auth-access`
- minimal `core-api`
- minimal `mcp-contracts`
- minimal `mcp-service`
- first end-to-end flow: authenticate -> validate token -> list projects via MCP

This sprint is intentionally narrow.
It should produce the first running platform skeleton for agent workflows, not a full human-facing product.

## Sprint 1 Success Criteria
Sprint 1 is successful when all of the following are true:
- the mono-repo boots correctly
- PostgreSQL is running locally through Docker
- Prisma can migrate the database
- `auth-access` can authenticate seeded users
- `auth-access` can issue and validate an MCP token
- `core-api` can list projects
- `mcp-service` can expose at least one working read tool
- one integration/contract test covers the flow

## Sprint Duration Assumption
This plan assumes a short focused sprint, roughly **5 working days**.

If needed, Day 5 can be split into Day 5 and Day 6.

---

## Day 1 - Repo and Environment Bootstrap

### Goal
Create the repo skeleton and make the local environment runnable.

### Main outputs
- monorepo root files
- workspace wiring
- Docker setup for PostgreSQL and Redis
- initial apps/packages folders

### Tasks

#### Root workspace
- [x] Create root `package.json`
- [x] Create `pnpm-workspace.yaml`
- [x] Create `turbo.json`
- [x] Create `tsconfig.base.json`
- [x] Create root `.gitignore`
- [x] Create root `.env.example`
- [x] Create root `README.md`

#### Folders
- [x] Create `apps/`
- [x] Create `packages/`
- [x] Create `infra/docker/`
- [x] Create `infra/scripts/`
- [x] Create `.github/workflows/`

#### App folders for Sprint 1
- [x] Create `apps/core-api/`
- [x] Create `apps/auth-access/`
- [x] Create `apps/mcp-service/`

#### Package folders for Sprint 1
- [x] Create `packages/domain/`
- [x] Create `packages/database/`
- [x] Create `packages/auth/`
- [x] Create `packages/grants/`
- [x] Create `packages/config/`
- [x] Create `packages/mcp-contracts/`

#### Docker local environment
- [x] Create `infra/docker/docker-compose.yml`
- [x] Add PostgreSQL service
- [x] Add Redis service
- [x] Add health checks
- [x] Add persistent volumes

#### Basic scripts
- [x] Add bootstrap script
- [x] Add dev script placeholders
- [x] Add migrate script placeholder

### End-of-day checkpoint
By the end of Day 1, you should be able to:
- install workspace dependencies
- run Docker compose
- see PostgreSQL and Redis alive locally

---

## Day 2 - Shared Packages and Database Backbone

### Goal
Create the minimum shared packages and get PostgreSQL schema management working.

### Main outputs
- shared domain enums
- Prisma setup
- first DB schema
- first migration
- seed users, team, and project

### Tasks

#### `packages/domain`
- [x] Add `ProjectStatus` enum
- [x] Add `PhaseStatus` enum
- [x] Add `MilestoneStatus` enum
- [x] Add `TaskStatus` enum
- [x] Add `TaskPriority` enum
- [x] Add `MemoryEntryType` enum with `done` and `next`
- [x] Add shared domain export index

#### `packages/auth`
- [x] Add password hash helper
- [x] Add password verify helper
- [x] Add token hash helper
- [x] Add shared auth type exports

#### `packages/grants`
- [x] Add grant enum/constants
- [x] Add base permission helper signatures

#### `packages/config`
- [x] Add env loading helper
- [x] Add shared lint/format config placeholders

#### `packages/mcp-contracts`
- [x] Add initial tool schema for `list_projects`
- [x] Add shared MCP tool metadata export

#### `packages/database`
- [x] Initialize Prisma
- [x] Add PostgreSQL datasource
- [x] Add initial schema for:
  - `users`
  - `teams`
  - `team_memberships`
  - `sessions`
  - `projects`
  - `project_grants`
  - `mcp_tokens`
- [x] Generate initial migration
- [x] Apply migration locally
- [x] Generate Prisma client

#### Seed basics
- [x] Add first seed script placeholder
- [x] Seed 4 initial users
- [x] Seed 1 initial team
- [x] Add all 4 users as team members
- [x] Seed 1 initial project (Roadboard)
- [x] Seed base project grant for all 4 users, directly or through the team according to the first chosen grant path

### End-of-day checkpoint
By the end of Day 2, you should be able to:
- migrate the DB locally
- inspect tables in PostgreSQL
- verify that 4 users, 1 team, memberships, and 1 project exist
- verify that the initial development team has project access configured

---

## Day 3 - `auth-access` Minimal Vertical Slice

### Goal
Make authentication, team collaboration basics, and token issuance work end-to-end at backend level.

### Main outputs
- `auth-access` bootstrapped
- seeded users can log in
- current user endpoint works
- team and membership basics exist
- MCP token can be issued and validated

### Tasks

#### App bootstrap
- [x] Initialize NestJS app in `apps/auth-access`
- [x] Enable Fastify adapter
- [x] Add app module
- [x] Add config wiring
- [x] Add Prisma integration
- [x] Add health endpoint

#### Modules
- [x] Create `auth` module
- [x] Create `users` module
- [x] Create `teams` module
- [x] Create `memberships` module
- [x] Create `sessions` module
- [x] Create `grants` module
- [x] Create `tokens` module

#### `auth` module
- [x] Add login DTO
- [x] Add login controller
- [x] Add login service
- [x] Validate seeded user credentials
- [x] Create session record on login

#### `users` module
- [x] Add `me` endpoint support
- [x] Resolve current session user

#### `teams` module
- [x] Add create/list team endpoints or service paths
- [x] Add team detail read path

#### `memberships` module
- [x] Add add/list membership endpoints or service paths
- [x] Add team membership lookup path

#### `sessions` module
- [x] Add logout flow
- [x] Add session invalidation logic

#### `grants` module
- [x] Add project grant lookup path
- [x] Add effective permission helper
- [x] Add team-aware grant resolution path

#### `tokens` module
- [x] Add issue token endpoint/service
- [x] Add validate token service path
- [x] Add revoke token placeholder if low effort

#### Minimum endpoints
- [x] `GET /health`
- [x] `POST /auth/login`
- [x] `POST /auth/logout`
- [x] `GET /auth/me`
- [x] `GET /teams`
- [x] `GET /teams/:id`
- [x] `GET /teams/:id/memberships`
- [x] `POST /tokens`
- [x] internal/service token validation path

#### Basic tests
- [x] login success test
- [x] login failure test
- [x] team list or membership lookup test
- [x] token issue test
- [x] token validation test

### End-of-day checkpoint
By the end of Day 3, you should be able to:
- start `auth-access`
- log in with a seeded user
- inspect the initial team and its 4 memberships
- issue an MCP token
- validate that token for a service call

---

## Day 4 - `core-api` Minimal Vertical Slice

### Goal
Make project listing work behind authenticated and grant-aware access.

### Main outputs
- `core-api` bootstrapped
- project listing endpoint works
- project detail endpoint works
- basic grant-aware access path exists

### Tasks

#### App bootstrap
- [x] Initialize NestJS app in `apps/core-api`
- [x] Enable Fastify adapter
- [x] Add app module
- [x] Add config wiring
- [x] Add Prisma integration
- [x] Add health endpoint

#### Modules
- [x] Create `projects` module
- [x] Create `health` module

#### `projects` module
- [x] Add list projects endpoint
- [x] Add project detail endpoint
- [x] Add project create endpoint if low effort
- [x] Add DTOs
- [x] Add service and controller

#### Auth integration path
- [x] Add minimal request identity propagation model
- [x] Add grant-check call path to `auth-access`
- [x] Add team-aware grant resolution support
- [x] Protect project listing/detail if feasible in this sprint

#### Minimum endpoints
- [x] `GET /health`
- [x] `GET /projects`
- [x] `GET /projects/:id`
- [x] optional `POST /projects`

#### Basic tests
- [x] project list integration test
- [x] project detail integration test
- [x] unauthorized or ungranted access test if feasible

### End-of-day checkpoint
By the end of Day 4, you should be able to:
- start `core-api`
- retrieve the seeded Roadboard project
- confirm `auth-access` and `core-api` can work together with basic access control for the seeded 4-person team

---

## Day 5 - `mcp-service` Minimal MCP Path

### Goal
Create the first visible Roadboard product slice for LLM workflows.

### Main outputs
- `mcp-service` running
- `list_projects` MCP tool working end-to-end
- one narrow write path placeholder or first implementation if time permits
- one integration/contract test for the MCP path

### Tasks

#### MCP bootstrap
- [x] Create MCP service bootstrap
- [x] Create MCP server bootstrap
- [x] Create tool registry
- [x] Wire `packages/mcp-contracts`

#### Clients
- [x] Add `auth-access` client
- [x] Add `core-api` client

#### Policies
- [x] Add token scope guard
- [x] Add basic tool usage guard

#### Tool implementation
- [x] Implement `list_projects`
- [x] Implement `get_project` if time permits
- [x] Implement first narrow write tool placeholder or `create_task` if low effort

#### Audit basics
- [x] Add MCP request logging
- [x] Add denied action logging

#### Tests
- [x] Add MCP contract test for `list_projects`
- [x] Add integration test:
  - valid token -> `list_projects` works
  - invalid token -> denied

#### CI minimum
- [x] Add one GitHub workflow for lint/typecheck/test skeleton

### End-of-day checkpoint
By the end of Day 5, you should be able to:
- run `mcp-service`
- authenticate a user from the seeded team
- issue a token
- call `list_projects` through MCP
- see the seeded Roadboard project via MCP

---

## Suggested Tactical Simplifications For Sprint 1
To keep Sprint 1 realistic, accept these temporary simplifications:
- only one initial team with 4 users
- only one seeded project
- grants can stay minimal and project-scoped only
- memory can wait until Sprint 2 if it threatens the first MCP path
- no web UI in Sprint 1
- no full local sync bridge runtime yet
- no advanced workflow tools yet

The goal is **a live LLM-usable slice**, not a complete Wave 1 in one sprint.

## What Sprint 1 Should Unlock Next
Sprint 1 should make Sprint 2 straightforward.

Sprint 2 can then add:
- phases
- milestones
- tasks
- memory
- richer MCP read/write tools
- local persistence primitives

## Sprint 1 Definition Of Done
Sprint 1 is done when:
- mono-repo root works
- PostgreSQL and Redis run locally
- DB migrations work
- 4 seeded users exist
- 1 seeded team and memberships exist
- seeded project exists
- `auth-access` login works
- token issuance and validation work
- `core-api` project list works
- `mcp-service` can list projects through MCP
- one integration/contract test exists and passes

## Final Recommendation
Do not try to finish all of resequenced Wave 1 in Sprint 1.

Sprint 1 should prove one thing:
**Roadboard 2.0 can already serve as a safe platform backbone for a real 4-person team using LLM workflows.**
