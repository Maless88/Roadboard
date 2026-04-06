# Roadboard 2.0 Service Communication and Data Ownership

## Decision Goal
Define:
- how services communicate
- which service owns which data
- how to avoid a distributed mess

The key principle is:
**clear ownership, simple synchronous flows, async only where it adds real value**.

## Core Principles
- Each core domain object must have a clear owner service.
- Cross-service writes should be minimized.
- Human-facing reads should go through explicit API/query boundaries.
- Agent-facing operations should go through MCP, not bypass it.
- Async messaging should be used for derived work, not for core transactional consistency.
- Central PostgreSQL is the source of truth for shared team state.
- Local SQLite is only the source of truth for local transient agent workflow state.

## Recommended Communication Model

### 1. Synchronous communication
Use synchronous HTTP/JSON APIs between central services for:
- authentication and authorization checks
- normal CRUD operations
- dashboard reads when freshness matters
- MCP tool execution that needs immediate feedback
- token validation and grant resolution

### 2. Asynchronous communication
Use queue/event-driven processing only for:
- activity fan-out
- dashboard materialization
- summary generation
- notification-like behavior
- token cleanup
- sync reconciliation jobs
- expensive derived projections

### 3. Local bridge communication
Use HTTPS API sync between `local-sync-bridge` and central services.

Do not introduce distributed eventing between local developer machines and the central system for v1.

## Service Ownership Model

### `core-api` owns
- Project
- Phase
- Milestone
- Task
- TaskDependency
- MemoryEntry
- Decision
- SessionHandoff
- FileReference
- ActivityEvent (domain-side creation)
- dashboard source queries

This service is the owner of the main product domain.

### `auth-access` owns
- User identity
- Team
- TeamMembership
- ProjectGrant
- MCPToken
- auth sessions
- access resolution rules

This service is the owner of identity and authorization.

### `mcp-service` owns
- MCP protocol surface
- tool definitions
- workflow orchestration rules
- agent-specific guardrails
- MCP request audit metadata

This service does **not** own project data.
It mediates agent access to domain data.

### `local-sync-bridge` owns
- local SQLite cache/state
- local sync journal
- local pending writes
- local agent-side working context

This service does **not** own team-shared truth.
It owns local staging and transport concerns.

### `worker-jobs` owns
- background execution logic
- derived projections
- async processing jobs
- materialized summaries

This service does **not** own canonical business entities.

### `web-app` owns
- UI state only
- no domain ownership

## Database Ownership

### Central PostgreSQL
Use separate schemas or clearly separated table namespaces by domain responsibility.

Recommended ownership split:
- `core-api` schema/domain tables
- `auth-access` schema/domain tables
- shared read models only when explicitly generated

Important rule:
**Only the owning service should write its canonical tables.**

### Local SQLite
Owned by `local-sync-bridge`.

Recommended contents:
- local project/task snapshots
- local working notes
- pending sync operations
- sync metadata
- local context bundles

Important rule:
Local SQLite is not the canonical team database.

## Recommended Request Flows

### Human UI flow
`web-app` -> `core-api`
`web-app` -> `auth-access`

Use frontend composition for ordinary screens.
Do not make the frontend call too many services directly if a backend-for-frontend pattern becomes necessary later.

### Agent flow
`agent` -> `mcp-service` -> `auth-access` for token/grant validation -> `core-api` for domain reads/writes

This keeps agent behavior constrained and auditable.

### Local-first agent flow
`agent` -> `local-sync-bridge` -> local SQLite
Then:
`local-sync-bridge` -> central services via HTTPS sync

### Async flow
`core-api` and `auth-access` emit jobs -> `worker-jobs` processes -> updates derived read models / summaries / cleanup state

## Write Rules

### Rule 1
No service should directly write another service's canonical domain tables.

### Rule 2
If a workflow needs data from another service, call that service's API.

### Rule 3
If a workflow needs combined data, compose it at the API/workflow layer, not by sharing table ownership.

### Rule 4
The MCP service should never become a hidden second backend with duplicated business rules.

### Rule 5
Async processing may produce read models, summaries, and aggregates, but should not silently mutate canonical entities without explicit ownership rules.

## Read Model Strategy
For dashboards and overview pages, use one of these two patterns:

### Pattern A: live query composition
- simplest to start
- useful when data volume is small/moderate

### Pattern B: derived read models
- materialized tables/views for dashboard speed
- built asynchronously by `worker-jobs`

Recommendation:
Start with A for MVP, move selected dashboards to B when needed.

## API Boundary Recommendation

### `core-api`
Expose APIs for:
- projects
- phases
- milestones
- tasks
- memory
- decisions
- handoffs
- dashboard snapshots

### `auth-access`
Expose APIs for:
- login/session
- current user/team context
- grant checks
- token create/revoke/list

### `mcp-service`
Expose:
- MCP tools only
- no general human product API

### `local-sync-bridge`
Expose:
- local APIs only if needed by local tools/agent clients
- central sync endpoints consumed from central services

## Queue/Event Recommendation
Use Redis + BullMQ.

Recommended event/job families:
- `activity.recorded`
- `dashboard.refresh`
- `summary.generate`
- `handoff.generate`
- `sync.reconcile`
- `token.cleanup`

Important rule:
Treat these as internal jobs/events, not as a public event contract between many independent teams.

## MVP Simplicity Rules
For v1:
- synchronous HTTP for most central service calls
- queue only for async/derived work
- no Kafka
- no event sourcing
- no distributed sagas unless absolutely forced later

## Why This Proposal Fits Roadboard 2.0
It supports:
- multiple services
- clean human vs agent separation
- safe ownership of auth and grants
- local-first MCP workflows
- central team visibility
- dashboards without premature platform complexity

## Final Recommendation
### Communication
- HTTP/JSON for core service-to-service operations
- Redis/BullMQ for async jobs
- HTTPS sync from local bridge to central services

### Data ownership
- `core-api` owns project/work/memory domain data
- `auth-access` owns identity/grants/tokens
- `mcp-service` owns protocol/tooling layer, not business entities
- `local-sync-bridge` owns local transient state
- `worker-jobs` owns derived processing, not source-of-truth entities

This is the architecture most likely to remain understandable while still being powerful enough for Roadboard 2.0.
