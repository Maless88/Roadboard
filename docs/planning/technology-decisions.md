# Roadboard 2.0 Technology Decisions

## Confirmed Decisions

### 1. Architecture Style
Roadboard 2.0 will follow a TypeScript-first architecture.

Rationale:
- strong consistency across frontend, backend, MCP layer, and sync logic
- faster iteration on a domain-heavy product
- shared validation/schema potential across services
- better fit for agent-facing APIs and product UI developed together

### 2. Backend Framework
Recommended choice: **NestJS**

Decision:
Use NestJS as the core backend framework.

Rationale:
- better architectural discipline for a product with many modules
- natural fit for domain separation: projects, tasks, memory, auth, grants, MCP, dashboards, sync
- stronger long-term maintainability than a lighter but less opinionated stack
- good support for validation, guards, DI, modular boundaries, OpenAPI, and background integration

Why not Fastify as the main choice:
- Fastify is excellent and lighter, but Roadboard 2.0 is not a thin API
- the project will benefit more from structure than from minimal framework overhead
- Fastify can still be used underneath NestJS as the HTTP adapter if desired

### 3. Local + Central Storage Model
Decision:
Use **SQLite locally** and **PostgreSQL centrally**.

Rationale:
- SQLite is ideal for local MCP/agent workflows
- PostgreSQL is the central source of truth for team collaboration
- this model supports local productivity without losing central visibility

### 4. MCP Deployment Shape
Decision:
Use a **separate MCP service/process** from the main backend.

Rationale:
- clean separation between human-facing API and agent-facing tool surface
- better security and scope enforcement
- easier auditing and versioning of MCP tools
- better operational control over agent behavior and token usage

## Additional Recommendation
If possible, run NestJS with the Fastify adapter.

This gives:
- NestJS structure and modularity
- Fastify performance/runtime benefits

## Final Recommended Core Stack
- Frontend: Next.js + React + TypeScript
- Core backend: NestJS (preferably with Fastify adapter)
- Central database: PostgreSQL
- Local agent storage: SQLite
- ORM: Prisma
- MCP layer: dedicated TypeScript service
- Queue/cache: Redis + BullMQ
- Search (MVP): PostgreSQL full-text search + structured filters
