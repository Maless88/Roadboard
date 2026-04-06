# Roadboard 2.0 Core API Structure

## Goal
Define the internal structure of the `core-api` service.

This service is the central owner of the Roadboard 2.0 work domain:
- projects
- phases
- milestones
- tasks
- memory
- decisions
- handoffs
- dashboards
- audit events (domain-side)

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

## Suggested Internal Layout

```text
apps/core-api/
  src/
    main.ts
    app.module.ts
    common/
      auth/
      guards/
      interceptors/
      pipes/
      filters/
      decorators/
      dto/
      utils/
    modules/
      projects/
      phases/
      milestones/
      tasks/
      task-dependencies/
      memory/
      decisions/
      handoffs/
      dashboards/
      audit/
      health/
    integrations/
      auth-access/
      worker-jobs/
    prisma/
    config/
  test/
    integration/
    e2e/
  package.json
  tsconfig.json
```

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

### 3. `milestones`
Owns:
- milestone CRUD
- due dates
- linkage to phase/project
- milestone progress input queries

### 4. `tasks`
Owns:
- task CRUD
- status transitions
- priority
- assignee references
- task context retrieval
- links to related memory/decision records

This will likely become one of the richest modules.

### 5. `task-dependencies`
Owns:
- dependency creation/removal
- dependency validation
- dependency queries
- blockers computation support

Keep separate from `tasks` if the logic becomes non-trivial.
If still small early on, it can remain nested inside `tasks` and split later.

### 6. `memory`
Owns:
- memory entry CRUD
- category handling
- durable vs temporary memory
- linking memory to tasks/projects/decisions
- recent memory and search-oriented retrieval endpoints

### 7. `decisions`
Owns:
- decision record CRUD
- rationale and impact metadata
- linkage to tasks and memory entries
- decision timelines/recent decisions

### 8. `handoffs`
Owns:
- session handoff creation
- handoff retrieval
- next-step packaging
- continuity summaries for humans/agents

### 9. `dashboards`
Owns:
- dashboard-specific read endpoints
- aggregated status views
- milestone progress views
- recent activity summaries
- work snapshot DTOs

Important:
this module should mainly expose read/query composition, not canonical writes.

### 10. `audit`
Owns:
- domain-side activity event recording
- event query endpoints where needed
- structured activity metadata from core domain operations

### 11. `health`
Owns:
- health checks
- readiness/liveness
- dependency status where appropriate

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

### `integrations/auth-access`
Contains clients/adapters for:
- user identity lookup
- team/project grant checks
- token or principal context resolution

### `integrations/worker-jobs`
Contains clients/publishers for:
- background jobs
- dashboard refresh jobs
- summary/handoff jobs
- cleanup triggers

Important rule:
external service calls should be isolated in integrations, not scattered across domain modules.

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

Examples:
- `/projects`
- `/projects/:id/phases`
- `/projects/:id/milestones`
- `/projects/:id/tasks`
- `/tasks/:id`
- `/tasks/:id/memory`
- `/tasks/:id/decisions`
- `/projects/:id/memory`
- `/projects/:id/decisions`
- `/projects/:id/handoffs`
- `/projects/:id/dashboard`

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
3. `milestones`
4. `tasks`
5. `memory`
6. `decisions`
7. `dashboards`
8. `health`

Then add:
9. `handoffs`
10. `audit`
11. `task-dependencies`

## Final Recommendation
The `core-api` should be a **modular domain backend**, not a generic CRUD server.

Its internal structure should make it easy to evolve Roadboard 2.0 around:
- execution planning
- memory continuity
- dashboard visibility
- safe interaction with auth, workers, and MCP through clear boundaries
