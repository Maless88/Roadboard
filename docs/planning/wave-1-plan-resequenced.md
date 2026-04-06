# Roadboard 2.0 Wave 1 Plan (Resequenced)

## Purpose
This document supersedes the original Wave 1 sequencing for execution priority.

The new priority is:
**platform backbone for LLM workflows first, human web UI later.**

## Wave 1 Goal
Create the first working Roadboard backbone that supports:
- central storage of project/work information
- basic access control
- grants and token model
- MCP read/write operations for LLM workflows
- initial local/remote storage pattern

Wave 1 no longer aims to deliver the first human-facing product slice.
It aims to deliver the first **LLM-usable platform slice**.

## Wave 1 Outcome
At the end of Wave 1, Roadboard should be able to:
- run as a mono-repo with core services bootstrapped
- persist projects, phases, milestones, tasks, and basic memory centrally
- authenticate users
- support basic project grants
- support a basic 4-person team model through teams and memberships
- issue and validate MCP tokens
- expose an MCP surface with read and narrow write tools
- establish the first local/remote storage model and local persistence primitives

## Wave 1 Scope

### Included
- mono-repo bootstrap
- shared package backbone
- central database bootstrap
- local persistent storage primitives
- `core-api` initial modules
- `auth-access` initial modules
- `mcp-contracts`
- `mcp-service` initial tools
- basic tests and CI for platform services

### Excluded
- full `web-app`
- dashboard UI for humans
- advanced local sync bridge behavior
- worker-job heavy async flows
- public GitHub publication polish
- advanced dashboards
- advanced collaboration UX beyond the first team model

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
- `apps/mcp-service`
- `packages/domain`
- `packages/database`
- `packages/auth`
- `packages/grants`
- `packages/config`
- `packages/mcp-contracts`

### Step 2 - Central and local infrastructure bootstrap
Bring up:
- PostgreSQL
- Redis
- local SQLite pattern/bootstrap for agent-side persistence

Deliverables:
- local Docker Compose
- DB connection config
- environment setup docs
- local storage initialization approach

### Step 3 - Shared package backbone
Implement initial contents for:
- `packages/domain`
- `packages/database`
- `packages/auth`
- `packages/grants`
- `packages/config`
- `packages/mcp-contracts`

### Step 4 - `core-api` MVP domain modules
Implement first modules:
- `health`
- `projects`
- `phases`
- `milestones`
- `tasks`
- `memory` (basic only)

Deliverables:
- REST endpoints for CRUD/basic listing
- central PostgreSQL schema for work domain
- basic memory entries with `done` / `next` categories

### Step 5 - `auth-access` MVP modules
Implement first modules:
- `health`
- `users`
- `teams`
- `memberships`
- `grants`
- `auth`
- `sessions`
- `tokens`

Deliverables:
- login/session flow
- user creation/bootstrap path
- team model for the initial 4-person development group
- membership management
- project-scoped grants, including team-scoped grant support
- token creation/validation/revocation primitives

### Step 6 - connect `core-api` and `auth-access`
Implement the minimum integration needed for:
- request identity propagation
- grant checks on project/task/memory operations
- team-aware grant resolution
- token validation support for MCP

### Step 7 - `mcp-service` foundation
Implement:
- MCP server bootstrap
- token validation through `auth-access`
- typed contracts from `packages/mcp-contracts`
- initial read tools
- initial narrow write tools

Priority tools:
- `list_projects`
- `get_project`
- `list_active_tasks`
- `get_project_memory`
- `create_task`
- `update_task_status`
- `create_memory_entry`

### Step 8 - local/remote pattern checkpoint
Implement the first usable local persistence pattern:
- local SQLite storage bootstrap
- local operation journaling primitive
- explicit local vs remote data rules

This does not need the full bridge service yet, but it must prove the architecture.

## Suggested Initial Data Model For Wave 1

### Core domain tables
- `projects`
- `phases`
- `milestones`
- `tasks`
- `memory_entries`

### Auth/access tables
- `users`
- `teams`
- `team_memberships`
- `project_grants`
- `sessions`
- `mcp_tokens`

### Local storage primitives
- local project/task snapshot tables
- local pending operation table

## Testing Scope For Wave 1

### Required now
- unit tests for shared auth/grant helpers
- integration tests for `core-api` project/task/memory flows
- integration tests for `auth-access` login/grant/token flows
- integration tests for basic team and membership flows
- contract tests for MCP tools
- one end-to-end MCP flow:
  - authenticate
  - validate token
  - list projects
  - create/update task or memory

### Not required yet
- human UI end-to-end tests
- local sync bridge full reliability suite
- worker-job tests
- publication-oriented test polish

## CI Scope For Wave 1
Run on PR:
- lint
- typecheck
- package unit tests
- `core-api` integration tests
- `auth-access` integration tests
- `mcp-service` contract/integration tests

## Definition Of Done For Wave 1
Wave 1 is done when all of the following are true:
- mono-repo is bootstrapped and runnable
- PostgreSQL-backed core work domain is working
- authentication, teams, memberships, project grants, and MCP tokens are working
- MCP can read and perform limited writes safely
- a minimal local/remote storage pattern exists
- the initial 4-person development team can be represented correctly in the platform backbone
- Roadboard can start supporting LLM-driven workflows before the full human UI exists

## What Wave 2 Should Unlock
Wave 2 should begin immediately after Wave 1 with:
- full `web-app`
- dashboard views for humans
- stronger local sync bridge
- worker-jobs
- richer memory and decision model

## Final Recommendation
Wave 1 should now be treated as the **minimum LLM-usable platform slice**.

Its purpose is to create the first Roadboard foundation that agents can use safely and productively, before the human-facing application is prioritized.
