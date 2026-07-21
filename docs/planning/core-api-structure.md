# Roadboard 2.0 Core API Structure

## Goal
Define the internal structure of the `core-api` service.

This service is the central owner of the Roadboard 2.0 work domain:
- projects
- phases
- tasks
- memory
- decisions
- dashboards
- audit events (domain-side)
- agents (rooms/skills/credentials), chatbot, codeflow, notifications, ops, release, scheduling

The structure should favor:
- strong module boundaries
- predictable growth
- explicit ownership
- clean API contracts
- maintainability over time

## Recommended Framework
- NestJS
- Fastify adapter
- Prisma
- PostgreSQL

## Architectural Style
Use a **modular domain-oriented structure**.

Do not organize the service primarily by technical layers only.
Do not make one giant `services/` folder with everything mixed together.

Each domain module should contain its own:
- controller(s)
- service(s)
- DTOs
- policies/validators where needed
- repository/query logic wrappers when useful

## Actual Current Layout

The real `apps/core-api/src/modules/` (verified) has more modules than originally scoped here, and none of `milestones`, `task-dependencies`, `handoffs`, or a dedicated `integrations/` directory exist:

```text
apps/core-api/
  src/
    main.ts
    app.module.ts
    common/
    types/
    modules/
      agents/          # agents.controller, rooms.controller, skills.controller, credentials.controller
      audit/
      chatbot/
      codeflow/        # graph, repositories, domain-groups controllers
      dashboards/
      decisions/
      health/
      memory/
      notifications/
      ops/
      phases/
      projects/        # projects.controller, thumbnails.controller
      release/
      scheduling/
      tasks/
  package.json
  tsconfig.json
```

Service-to-service calls toward `auth-access`/`worker-jobs` live inside the relevant module (e.g. `common/`), not in a separate `integrations/` directory.

## Module Breakdown

### 1. `projects`
Owns:
- project CRUD
- project metadata
- project state transitions
- project summary queries

Typical files:

```text
modules/projects/
  projects.module.ts
  projects.controller.ts
  projects.service.ts
  projects.query.service.ts
  dto/
  policies/
```

### 2. `phases`
Owns:
- phase CRUD
- ordering within a project
- lifecycle status

### 3. `tasks`
Owns:
- task CRUD
- status transitions
- priority
- assignee references
- task context retrieval
- links to related memory/decision records

This will likely become one of the richest modules.

Task dependencies/blockers are not a separate module today; if that logic grows non-trivial it should live in its own `task-dependencies` module rather than being bolted onto `tasks`.

### 4. `memory`
Owns:
- memory entry CRUD
- category handling
- durable vs temporary memory
- linking memory to tasks/projects/decisions
- recent memory and search-oriented retrieval endpoints

### 5. `decisions`
Owns:
- decision record CRUD
- rationale and impact metadata
- linkage to tasks and memory entries
- decision timelines/recent decisions

Session handoffs (the `create_handoff` MCP tool) are not backed by a dedicated `handoffs` module today — if a distinct handoff domain emerges, give it its own module rather than overloading `memory`/`decisions`.

### 6. `dashboards`
Owns:
- dashboard-specific read endpoints
- aggregated status views
- recent activity summaries
- work snapshot DTOs

Important:
this module should mainly expose read/query composition, not canonical writes.

### 7. `audit`
Owns:
- domain-side activity event recording
- event query endpoints where needed
- structured activity metadata from core domain operations

### 8. `health`
Owns:
- health checks
- readiness/liveness
- dependency status where appropriate

The service today also has `agents` (agent rooms/skills/credentials), `chatbot`, `codeflow` (Atlas/CodeFlow graph, repositories, domain groups), `notifications`, `ops`, `release`, and `scheduling` modules, which were not part of the original scope of this document.

## Common Layer

### `common/auth`
Contains:
- service-to-service auth helpers
- grant-aware request context extraction
- shared request identity primitives

### `common/guards`
Contains:
- request guards
- project access guards
- permission guards

### `common/interceptors`
Contains:
- response shaping if needed
- logging/tracing interceptors

### `common/pipes`
Contains:
- DTO validation helpers
- parsing/normalization helpers

### `common/filters`
Contains:
- exception mapping
- domain error -> HTTP response mapping

### `common/decorators`
Contains:
- current user/project decorators
- permission decorators

Important rule:
`common/` should remain truly common.
Do not dump domain-specific logic there.

## Integration Layer

There is no dedicated `integrations/` directory in the real service. Calls toward `auth-access` (identity lookup, grant checks, principal resolution) and toward `worker-jobs` (background/dashboard-refresh/cleanup triggers) live inside the relevant domain module today.

Important rule:
external service calls should be isolated in adapters/clients, not scattered ad-hoc across domain modules — extracting a shared `integrations/` layer is a reasonable next step if this duplication grows.

## Data Access Strategy
Use Prisma as the main ORM and DB access tool.

Recommended split:
- simple write flows can live in module services
- richer queries and dashboard aggregations should be placed in dedicated query services
- complex reporting queries may use raw SQL when justified

Example:
- `tasks.service.ts` -> write/update logic
- `tasks.query.service.ts` -> list/filter/context queries
- `dashboards.query.service.ts` -> aggregated dashboard reads

## API Design Recommendation
Expose REST endpoints grouped by domain.

Real controllers today expose flat, top-level routes rather than nested `/projects/:id/...` paths (project scoping happens via query/body, not the URL), except for `dashboards` and `codeflow`:
- `/projects`
- `/phases`
- `/tasks`
- `/memory`
- `/decisions`
- `/projects/:projectId/dashboard` (+ `/projects/:projectId/dashboard/tasks-summary`)
- `/projects/:projectId/codeflow/graph`, `/projects/:projectId/codeflow/repositories`, `/projects/:projectId/domain-groups`

## Write vs Read Separation
Inside the core API, strongly separate:
- command/write logic
- query/read logic

This does not require full CQRS complexity.
It just means keeping query-heavy dashboard/report code separate from mutation code.

## Recommended Rules

### Rule 1
Modules own their domain behavior.

### Rule 2
Cross-module orchestration should be explicit and limited.

### Rule 3
Dashboard logic should not leak into canonical write modules.

### Rule 4
Integrations with other services should go through adapters/clients.

### Rule 5
Do not let `core-api` become aware of MCP-specific behavior.
That belongs to `mcp-service`.

## Likely First Modules To Implement
For the earliest wave, prioritize:
1. `projects`
2. `phases`
3. `tasks`
4. `memory`
5. `decisions`
6. `dashboards`
7. `health`

Then add (all now implemented, plus `agents`, `chatbot`, `codeflow`, `notifications`, `ops`, `release`, `scheduling`):
8. `audit`

## Final Recommendation
The `core-api` should be a **modular domain backend**, not a generic CRUD server.

Its internal structure should make it easy to evolve Roadboard 2.0 around:
- execution planning
- memory continuity
- dashboard visibility
- safe interaction with auth, workers, and MCP through clear boundaries
