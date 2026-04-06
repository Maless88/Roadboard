# Roadboard 2.0 Wave 1 - Sprint 1 Day-by-Day (Resequenced)

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
- [ ] Create root `package.json`
- [ ] Create `pnpm-workspace.yaml`
- [ ] Create `turbo.json`
- [ ] Create `tsconfig.base.json`
- [ ] Create root `.gitignore`
- [ ] Create root `.env.example`
- [ ] Create root `README.md`

#### Folders
- [ ] Create `apps/`
- [ ] Create `packages/`
- [ ] Create `infra/docker/`
- [ ] Create `infra/scripts/`
- [ ] Create `.github/workflows/`

#### App folders for Sprint 1
- [ ] Create `apps/core-api/`
- [ ] Create `apps/auth-access/`
- [ ] Create `apps/mcp-service/`

#### Package folders for Sprint 1
- [ ] Create `packages/domain/`
- [ ] Create `packages/database/`
- [ ] Create `packages/auth/`
- [ ] Create `packages/grants/`
- [ ] Create `packages/config/`
- [ ] Create `packages/mcp-contracts/`

#### Docker local environment
- [ ] Create `infra/docker/docker-compose.yml`
- [ ] Add PostgreSQL service
- [ ] Add Redis service
- [ ] Add health checks
- [ ] Add persistent volumes

#### Basic scripts
- [ ] Add bootstrap script
- [ ] Add dev script placeholders
- [ ] Add migrate script placeholder

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
- [ ] Add `ProjectStatus` enum
- [ ] Add `PhaseStatus` enum
- [ ] Add `MilestoneStatus` enum
- [ ] Add `TaskStatus` enum
- [ ] Add `TaskPriority` enum
- [ ] Add `MemoryEntryType` enum with `done` and `next`
- [ ] Add shared domain export index

#### `packages/auth`
- [ ] Add password hash helper
- [ ] Add password verify helper
- [ ] Add token hash helper
- [ ] Add shared auth type exports

#### `packages/grants`
- [ ] Add grant enum/constants
- [ ] Add base permission helper signatures

#### `packages/config`
- [ ] Add env loading helper
- [ ] Add shared lint/format config placeholders

#### `packages/mcp-contracts`
- [ ] Add initial tool schema for `list_projects`
- [ ] Add shared MCP tool metadata export

#### `packages/database`
- [ ] Initialize Prisma
- [ ] Add PostgreSQL datasource
- [ ] Add initial schema for:
  - `users`
  - `teams`
  - `team_memberships`
  - `sessions`
  - `projects`
  - `project_grants`
  - `mcp_tokens`
- [ ] Generate initial migration
- [ ] Apply migration locally
- [ ] Generate Prisma client

#### Seed basics
- [ ] Add first seed script placeholder
- [ ] Seed 4 initial users
- [ ] Seed 1 initial team
- [ ] Add all 4 users as team members
- [ ] Seed 1 initial project (Roadboard)
- [ ] Seed base project grant for all 4 users, directly or through the team according to the first chosen grant path

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
- [ ] Initialize NestJS app in `apps/auth-access`
- [ ] Enable Fastify adapter
- [ ] Add app module
- [ ] Add config wiring
- [ ] Add Prisma integration
- [ ] Add health endpoint

#### Modules
- [ ] Create `auth` module
- [ ] Create `users` module
- [ ] Create `teams` module
- [ ] Create `memberships` module
- [ ] Create `sessions` module
- [ ] Create `grants` module
- [ ] Create `tokens` module

#### `auth` module
- [ ] Add login DTO
- [ ] Add login controller
- [ ] Add login service
- [ ] Validate seeded user credentials
- [ ] Create session record on login

#### `users` module
- [ ] Add `me` endpoint support
- [ ] Resolve current session user

#### `teams` module
- [ ] Add create/list team endpoints or service paths
- [ ] Add team detail read path

#### `memberships` module
- [ ] Add add/list membership endpoints or service paths
- [ ] Add team membership lookup path

#### `sessions` module
- [ ] Add logout flow
- [ ] Add session invalidation logic

#### `grants` module
- [ ] Add project grant lookup path
- [ ] Add effective permission helper
- [ ] Add team-aware grant resolution path

#### `tokens` module
- [ ] Add issue token endpoint/service
- [ ] Add validate token service path
- [ ] Add revoke token placeholder if low effort

#### Minimum endpoints
- [ ] `GET /health`
- [ ] `POST /auth/login`
- [ ] `POST /auth/logout`
- [ ] `GET /auth/me`
- [ ] `GET /teams`
- [ ] `GET /teams/:id`
- [ ] `GET /teams/:id/memberships`
- [ ] `POST /tokens`
- [ ] internal/service token validation path

#### Basic tests
- [ ] login success test
- [ ] login failure test
- [ ] team list or membership lookup test
- [ ] token issue test
- [ ] token validation test

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
- [ ] Initialize NestJS app in `apps/core-api`
- [ ] Enable Fastify adapter
- [ ] Add app module
- [ ] Add config wiring
- [ ] Add Prisma integration
- [ ] Add health endpoint

#### Modules
- [ ] Create `projects` module
- [ ] Create `health` module

#### `projects` module
- [ ] Add list projects endpoint
- [ ] Add project detail endpoint
- [ ] Add project create endpoint if low effort
- [ ] Add DTOs
- [ ] Add service and controller

#### Auth integration path
- [ ] Add minimal request identity propagation model
- [ ] Add grant-check call path to `auth-access`
- [ ] Add team-aware grant resolution support
- [ ] Protect project listing/detail if feasible in this sprint

#### Minimum endpoints
- [ ] `GET /health`
- [ ] `GET /projects`
- [ ] `GET /projects/:id`
- [ ] optional `POST /projects`

#### Basic tests
- [ ] project list integration test
- [ ] project detail integration test
- [ ] unauthorized or ungranted access test if feasible

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
- [ ] Create MCP service bootstrap
- [ ] Create MCP server bootstrap
- [ ] Create tool registry
- [ ] Wire `packages/mcp-contracts`

#### Clients
- [ ] Add `auth-access` client
- [ ] Add `core-api` client

#### Policies
- [ ] Add token scope guard
- [ ] Add basic tool usage guard

#### Tool implementation
- [ ] Implement `list_projects`
- [ ] Implement `get_project` if time permits
- [ ] Implement first narrow write tool placeholder or `create_task` if low effort

#### Audit basics
- [ ] Add MCP request logging
- [ ] Add denied action logging

#### Tests
- [ ] Add MCP contract test for `list_projects`
- [ ] Add integration test:
  - valid token -> `list_projects` works
  - invalid token -> denied

#### CI minimum
- [ ] Add one GitHub workflow for lint/typecheck/test skeleton

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
