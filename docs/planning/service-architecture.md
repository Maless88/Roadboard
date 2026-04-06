# Roadboard 2.0 Service Architecture

## Decision
Roadboard 2.0 will use a **multi-service architecture** rather than a single modular monolith.

This does **not** mean starting with many tiny microservices.
It means defining a small number of clear service boundaries from the beginning.

## Recommended Service Set For V1

### 1. Web Application Service
**Purpose:** human-facing UI

Responsibilities:
- dashboards
- project views
- task views
- memory and decision views
- team/admin screens
- token management screens

Recommended technology:
- Next.js
- React
- TypeScript

Notes:
- UI only
- should consume backend APIs, not hold domain logic

---

### 2. Core API Service
**Purpose:** central domain backend and source of truth

Responsibilities:
- projects
- phases
- milestones
- tasks
- memory entries
- decisions
- session handoffs
- teams
- grants
- dashboards query endpoints
- audit events

Recommended technology:
- NestJS with Fastify adapter
- Prisma
- PostgreSQL

Notes:
- this is the primary business domain service
- central source of truth for team-visible state

---

### 3. Auth and Access Service
**Purpose:** identity, grants, and token lifecycle

Responsibilities:
- user login
- session/auth flows
- token issuance
- token revocation
- grant resolution
- permission checks support
- future SSO integration

Recommended technology:
- NestJS module/service or separate NestJS service
- PostgreSQL
- OIDC/OAuth-compatible design

Notes:
- for MVP, this can be deployed separately but kept logically close to Core API
- long term, separation is valuable because auth and token concerns will grow

---

### 4. MCP Service
**Purpose:** agent-facing tool surface

Responsibilities:
- expose MCP tools
- validate token scope
- translate MCP calls into backend domain operations
- enforce agent-specific workflows
- audit agent operations
- expose read/write/workflow tools safely

Recommended technology:
- dedicated TypeScript service
- thin orchestration layer over Core API and Auth/Access service

Notes:
- must remain separate from the main backend
- should not duplicate core business logic
- should orchestrate, validate, and constrain

---

### 5. Local Sync / Agent Bridge Service
**Purpose:** local-first agent workflows with central sync

Responsibilities:
- local SQLite persistence
- local MCP-side working state
- synchronization to central services
- conflict/status tracking
- offline/local workflow support

Recommended technology:
- TypeScript service
- SQLite locally
- HTTPS sync to central services

Notes:
- not necessarily a server in the same sense as central services
- may run as a local daemon/bridge on developer machines

---

### 6. Background Jobs / Processing Service
**Purpose:** asynchronous work

Responsibilities:
- dashboard materialization
- summary generation
- handoff generation support
- token cleanup
- sync processing
- activity aggregation
- future notifications

Recommended technology:
- Node.js / TypeScript worker
- BullMQ
- Redis

Notes:
- should consume queue jobs from core services
- keeps heavy async work out of request path

## Datastores

### Central
- PostgreSQL -> source of truth
- Redis -> queue/cache/ephemeral coordination
- optional object storage -> exports/reports/artifacts

### Local
- SQLite -> local agent/MCP workflow state

## Communication Model

### Human UI path
Web App -> Core API / Auth Service

### Agent path
Agent -> MCP Service -> Core API + Auth Service

### Local-first path
Local Agent / Local Bridge -> SQLite -> Sync -> Core API

### Async path
Core API / MCP / Sync -> Queue -> Background Worker

## Why This Is Better Than A Monolith For Roadboard 2.0
- clean separation between human and agent surfaces
- auth/token concerns stay isolated
- local/central sync becomes a first-class concept
- async processing does not pollute request logic
- easier future scaling of MCP and sync behavior independently

## Why This Is Better Than Many Tiny Microservices
- avoids operational fragmentation
- preserves clear domain boundaries
- simpler to build and deploy in early phases
- keeps service count aligned with real product capabilities

## Recommended V1 Deployment Shape
Keep the architecture multi-service, but start with a **small service count**.

### Wave 1 priority services
- Core API
- Auth and Access Service
- MCP Service

These are the services that should be prioritized for the resequenced MVP, because the first useful slice is platform-first and MCP-first.

### Introduced later as product layers or post-MVP services
- Web App -> introduced later as the human-facing visualization and interaction layer
- Background Worker -> post-MVP / later operational reliability phase
- Local Sync / Agent Bridge -> post-MVP / later local-first phase

This means the earliest practical deployment can focus on:
- 1 core backend service
- 1 auth/access service
- 1 MCP service
- plus central PostgreSQL and Redis

The full six-service architecture remains valid, but the implementation order is intentional.

## Implementation Order Note
For the updated implementation order, refer to:
- `implementation-roadmap.md`
- `mvp-resequencing-decision.md`

## Final Recommendation
Use a **bounded multi-service architecture**.

That means:
- not a monolith
- not uncontrolled microservice sprawl
- but a deliberate set of services with clear responsibilities

## Initial Service Boundaries To Lock In
- `web-app`
- `core-api`
- `auth-access`
- `mcp-service`
- `local-sync-bridge`
- `worker-jobs`
