# Roadboard 2.0 Implementation Roadmap

## Guiding Principle
Roadboard 2.0 should be built in an order that allows the platform to start helping build itself as early as possible.

This means the roadmap should not begin with isolated polish work.
It should begin with the foundational pieces that make Roadboard useful for its own development:
- planning
- memory
- access control
- context continuity
- safe agent access

## Strategic Idea
The first implementation waves should produce a **minimum self-hosting development loop**.

In practice, that means building the pieces that allow the Roadboard project itself to be tracked inside Roadboard as soon as possible.

## Phase 0 - Foundation Blueprint
### Goal
Lock the design and prepare the repository for implementation.

### Deliverables
- monorepo bootstrap
- workspace tooling
- base TypeScript config
- pnpm + Turborepo setup
- initial service folders
- shared package skeletons
- Docker local dev setup for PostgreSQL and Redis
- base documentation index

### Why first
Without this, every later step is slower and less consistent.

## Phase 1 - Core Domain Backbone
### Goal
Build the minimum central model of work.

### Implement first
- `packages/domain`
- `packages/database`
- `packages/config`
- `apps/core-api`
  - projects
  - phases
  - milestones
  - tasks
  - health

### Deliverables
- project CRUD
- phase CRUD
- milestone CRUD
- task CRUD
- central PostgreSQL schema
- initial API contracts

### Why first
This is the minimum structure needed to model Roadboard work inside Roadboard.

## Phase 2 - Access Backbone
### Goal
Make the platform safely usable by real users and future agents.

### Implement
- `packages/auth`
- `packages/grants`
- `apps/auth-access`
  - users
  - teams
  - memberships
  - grants
  - auth
  - sessions
  - health

### Deliverables
- login/session flow
- initial 4-person team model
- team memberships
- project grants
- permission checks

### Why this comes early
Because Roadboard is intended for team sharing and controlled agent access.
The initial development team is already 4 people, so teams and memberships are first-phase requirements, not a later addition.
Access rules must exist before deeper automation is trusted.

## Phase 3 - MCP Foundation
### Goal
Expose a controlled agent surface early enough to help develop the platform.

### Implement
- `packages/mcp-contracts`
- `apps/mcp-service`
  - token validation via `auth-access`
  - read tools
  - first narrow write tools
- `auth-access`
  - MCP tokens

### MVP MCP tools to prioritize
#### Read
- `list_projects`
- `get_project`
- `list_active_tasks`
- `get_task_context`
- `get_project_memory`

#### Write
- `create_task`
- `update_task_status`
- `create_memory_entry`
- `create_decision`

### Deliverables
- agents can safely read project/task/memory context
- agents can perform limited structured writes
- Roadboard can start supporting its own development via MCP

### Why here
This is the earliest point where Roadboard can become directly useful for LLM-driven workflows.
The first self-hosting loop should begin through MCP/API, not through the human UI.

## Phase 4 - Memory Backbone
### Goal
Add the first real context continuity layer through the platform backbone.

### Implement
- `core-api`
  - memory
  - decisions
- `mcp-service`
  - memory-aware read tools
  - first continuity-oriented write paths

### Deliverables
- memory entries linked to project/task
- explicit decision records
- distinction between what was done and what happens next
- memory accessible through MCP/API flows

### Why now
Once planning, access, and MCP exist, memory becomes the next capability that materially improves development continuity.
This is the point where Roadboard starts becoming more than a task tracker for agents as well as humans.

## Phase 5 - Roadboard Builds Roadboard (First Self-Use Loop)
### Goal
Enable the Roadboard project itself to be managed inside the product through API/MCP-first workflows.

### Implement
- project/task tracking through MCP and API paths
- first project/task context retrieval loops
- first memory/decision usage in real project work
- minimal self-hosting operational usage without requiring UI-first flows

### Deliverables
- Roadboard project can be entered into the system
- development tasks can be tracked in the system
- agents can retrieve and update selected project context safely
- the product starts helping build itself through MCP/API

### Why this matters
This is the first moment where the product starts becoming useful for building itself.
The self-hosting loop begins as a platform capability, and the UI can then arrive as a visualization and interaction layer on top.

## Phase 6 - Human Web UI Layer
### Goal
Add the first human-facing visualization and interaction layer on top of the platform backbone.

### Implement
- project detail UI in `web-app`
- phase/milestone/task views
- task status updates
- basic dashboard snapshot
- memory and decision views

### Deliverables
- humans can browse and manage project structure through the UI
- milestone progress becomes visible in a human-friendly way
- memory and decisions become easier to inspect visually

### Why here
The UI now sits on top of a platform that already works for LLM workflows.
This makes the web application a real product layer instead of a premature shell over incomplete foundations.

## Phase 7 - Self-Hosting Workflow Layer
### Goal
Make Roadboard materially useful as the operational tool for building Roadboard.

### Implement
- MCP workflow tools
- session handoffs
- project summary bundles
- recent work summaries
- dashboard improvements

### Priority workflow tools
- `prepare_task_context`
- `prepare_project_summary`
- `create_handoff_from_recent_activity`

### Deliverables
- structured handoff support
- task-focused context bundles
- better agent continuity
- better human visibility

### Why this is critical
This phase turns Roadboard from a set of modules into a tool that actually improves the engineering process building it.

## Phase 8 - Async and Operational Reliability
### Goal
Introduce background processing where it meaningfully improves the platform.

### Implement
- `apps/worker-jobs`
- Redis + BullMQ flows
- dashboard refresh jobs
- summary generation jobs
- cleanup jobs

### Deliverables
- better dashboard responsiveness
- generated summaries/handoff support
- cleanup automation

### Why later
Async work is important, but the product should first prove its direct synchronous workflow value.

## Phase 9 - Local Sync Bridge
### Goal
Enable local-first agent workflows with central visibility.

### Implement
- `apps/local-sync-bridge`
- local SQLite
- local journal
- first sync engine operations
- sync status inspection

### First synced operations
- create task
- update task status
- create memory entry
- create decision

### Why after MCP foundation
Because local sync is more valuable once the central system and MCP patterns are already stable.

## Phase 10 - GitHub Publication Readiness
### Goal
Make the repository public-ready.

### Implement
- standard public root docs
- license decision
- contributing guide
- security policy
- code of conduct
- changelog
- public roadmap
- issue/PR templates

### Why not first
Because publication quality should reflect a coherent platform direction, not a half-formed codebase.

## Phase 11 - Test Automation Hardening
### Goal
Build confidence and public credibility.

### Implement
- unit tests across shared packages
- integration tests for core services
- MCP contract tests
- auth/grant tests
- sync bridge tests
- Playwright end-to-end flows
- CI enforcement

### Why this must be a continuous workstream
Testing should begin early, but this phase represents the point where automation becomes broad, structured, and public-facing.

## Cross-Cutting Rule
Testing and documentation should not wait until the end.
They should be added continuously during all phases.

## Recommended First Practical Sequence
If the goal is to start as soon as possible in a way that helps Roadboard build itself, then the first execution sequence should be:

1. bootstrap mono-repo
2. implement `core-api` project/phase/milestone/task backbone
3. implement `auth-access` users/teams/memberships/grants backbone
4. implement MCP tokens and first read/write tools
5. let agents start interacting with Roadboard through controlled MCP
6. implement memory and decisions
7. start tracking Roadboard work inside Roadboard through API/MCP
8. add the first human web UI views
9. add workflow tools and handoffs
10. add worker jobs and local sync bridge

## Definition Of Early Success
The early roadmap is successful when:
- the Roadboard project itself is tracked inside Roadboard
- developers and agents can use Roadboard to manage Roadboard milestones/tasks
- memory and decisions reduce repeated context loss
- agents can safely retrieve and update selected project context
- the UI can be added as a visualization layer on top of an already useful platform backbone

At that point, the platform is beginning to help build itself in the intended way.

## Final Recommendation
Yes: it is not only possible, it is the right strategy.

Roadboard 2.0 should be built so that the earliest useful slices become tools for building the later slices.

That means starting with:
- core planning
- access control
- MCP foundation
- memory

before moving into the human UI layer, heavier sync, async, and publication hardening work.
