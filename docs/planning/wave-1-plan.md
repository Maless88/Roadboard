# Roadboard 2.0 Wave 1 Plan

## Goal
Define the first real implementation wave for Roadboard 2.0.

Wave 1 must create the minimum backbone that allows the project to start existing inside Roadboard itself.

This wave is intentionally focused on:
- structure
- core planning domain
- access backbone
- the smallest useful UI slice
- a first self-hosting development loop

It is **not** meant to deliver the full platform.
It is meant to create the foundation that helps build the rest correctly.

## Wave 1 Outcome
At the end of Wave 1, Roadboard should be able to:
- run as a mono-repo with core services bootstrapped
- persist projects, phases, milestones, and tasks centrally
- authenticate users
- support teams and project grants
- expose a minimal web UI for project/task management
- track the Roadboard project itself inside Roadboard

This is the first meaningful self-use milestone.

## Wave 1 Scope

### Included
- mono-repo bootstrap
- shared package backbone
- central database bootstrap
- `core-api` initial modules
- `auth-access` initial modules
- minimal `web-app`
- local Docker/dev environment
- basic CI and basic tests

### Excluded
- memory
- decisions
- MCP tools
- local sync bridge behavior
- worker jobs
- public GitHub publication polish
- advanced dashboards

## Wave 1 Build Order

### Step 1 - Monorepo bootstrap
Create and wire:
- `pnpm-workspace.yaml`
- `turbo.json`
- root `package.json`
- `tsconfig.base.json`
- `.env.example`
- `.github/workflows/`
- `infra/docker/`
- `infra/scripts/`

Create initial folders:
- `apps/core-api`
- `apps/auth-access`
- `apps/web-app`
- `packages/domain`
- `packages/database`
- `packages/auth`
- `packages/grants`
- `packages/config`

### Step 2 - Central infrastructure bootstrap
Bring up:
- PostgreSQL
- Redis (even if not heavily used yet, prepare the base)

Deliverables:
- local Docker Compose
- DB connection config
- environment setup docs

### Step 3 - Shared package backbone
Implement initial contents for:

#### `packages/domain`
- shared enums
- project/task status enums
- priority enums
- canonical domain vocabulary

#### `packages/database`
- Prisma setup
- central PostgreSQL schema bootstrap
- migration commands

#### `packages/auth`
- password hashing helpers
- auth primitives

#### `packages/grants`
- grant enums
- permission constants
- basic grant evaluation helpers

#### `packages/config`
- lint config
- formatting config
- env helpers
- shared tsconfig helpers

### Step 4 - `core-api` MVP domain modules
Implement first modules:
- `health`
- `projects`
- `phases`
- `milestones`
- `tasks`

Deliverables:
- REST endpoints for CRUD/basic listing
- project -> phase -> milestone -> task structure persisted in PostgreSQL
- status and priority handling
- simple query endpoints for project detail and task lists

Minimum endpoints to have:
- `GET /health`
- `POST /projects`
- `GET /projects`
- `GET /projects/:id`
- `POST /projects/:id/phases`
- `POST /projects/:id/milestones`
- `POST /projects/:id/tasks`
- `PATCH /tasks/:id`
- `GET /projects/:id/tasks`

### Step 5 - `auth-access` MVP modules
Implement first modules:
- `health`
- `users`
- `teams`
- `memberships`
- `grants`
- `auth`
- `sessions`

Deliverables:
- login/session flow
- user creation/bootstrap path
- team creation
- membership assignment
- project-scoped grants
- permission check helpers for service use

Minimum endpoints to have:
- `GET /health`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`
- `POST /teams`
- `POST /teams/:id/memberships`
- `POST /projects/:id/grants`
- `GET /projects/:id/grants`

### Step 6 - connect `core-api` and `auth-access`
Implement the minimum integration needed for:
- request identity propagation
- grant checks on project/task operations
- authorized read/write behavior

Important:
This should be enough to protect project/task CRUD by project grant rules.

### Step 7 - `web-app` minimum usable UI
Implement minimum pages:
- login page
- project list page
- project detail page
- phase/milestone/task overview
- task create/update flow

Minimum UX goal:
A user can log in, open the Roadboard project, and manage its structure and tasks.

### Step 8 - use Roadboard to track Roadboard
Create inside the system:
- the Roadboard 2.0 project
- at least the first phases/milestones/tasks

This is the success checkpoint of Wave 1.

## Suggested Initial Data Model For Wave 1

### Core domain tables
- `projects`
- `phases`
- `milestones`
- `tasks`

### Auth/access tables
- `users`
- `teams`
- `team_memberships`
- `project_grants`
- `sessions`

Do **not** introduce memory, decisions, MCP tokens, handoffs, or sync tables yet in Wave 1.

## Suggested First UI Screens

### 1. Login
- email/username + password
- authenticated session bootstrap

### 2. Project list
- list projects visible to the user
- basic status

### 3. Project detail
- project metadata
- phases
- milestones
- tasks

### 4. Task editor
- title
- description
- status
- priority
- assignee (optional if ready)

## Testing Scope For Wave 1

### Required now
- unit tests for shared auth/grant helpers
- integration tests for `core-api` project/task flows
- integration tests for `auth-access` login/team/grant flows
- one end-to-end UI test:
  - login
  - create/open project
  - create/update task

### Not required yet
- MCP contract tests
- sync bridge tests
- worker job tests
- publication-oriented test polish

## CI Scope For Wave 1
Run on PR:
- lint
- typecheck
- package unit tests
- `core-api` integration tests
- `auth-access` integration tests
- minimal `web-app` e2e smoke test

## Architecture Rules For Wave 1
- keep service boundaries clean even if functionality is minimal
- do not sneak memory or MCP behavior into Wave 1 modules
- do not prematurely optimize dashboard complexity
- do not create empty packages/services without immediate responsibility
- keep schemas and contracts explicit

## Definition Of Done For Wave 1
Wave 1 is done when all of the following are true:
- mono-repo is bootstrapped and runnable
- PostgreSQL-backed core planning domain is working
- authentication and project grants are working
- minimal web UI exists
- Roadboard 2.0 project is being tracked inside Roadboard
- the first implementation work can now be organized through the platform itself

## What Wave 2 Should Unlock
Wave 2 should begin immediately after Wave 1 with:
- memory
- decisions
- stronger dashboard visibility
- the first MCP token + read tool foundation

That is the point where Roadboard becomes more than a planning tool and starts becoming a context continuity system.

## Final Recommendation
Wave 1 should be treated as the **minimum self-hosting product slice**.

Its purpose is not to impress externally.
Its purpose is to create the first version of Roadboard that is useful enough to help structure the rest of Roadboard's own development.
