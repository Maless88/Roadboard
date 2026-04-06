# Roadboard 2.0 Technology Stack Proposal

## Purpose
Define the most appropriate technology choice for each major Roadboard 2.0 component.

The goal is not to maximize novelty.
The goal is to choose technologies that are robust, debuggable, maintainable, and compatible with a multi-project, team-oriented, MCP-enabled platform.

## Guiding Principles
- Prefer boring, proven technology for core persistence and auth.
- Keep MCP integration explicit and inspectable.
- Keep the core platform API-first.
- Separate operational storage from search/retrieval concerns.
- Allow local workflows without breaking central consistency.
- Choose technologies that work well for both humans and agents.

## 1. Frontend Web Application
### Recommended
- React
- TypeScript
- Next.js (App Router)
- Tailwind CSS for UI foundation
- shadcn/ui or similar component system for admin/product interfaces

### Why
- Strong ecosystem
- Excellent TypeScript support
- Good fit for dashboards, admin views, project planning interfaces
- Easy API integration
- Good long-term maintainability

### Alternative
- Vue + Nuxt if team preference changes

### Recommendation strength
- Strong

## 2. Backend Application API
### Recommended
- TypeScript
- Node.js
- NestJS or Fastify-based modular backend

### Why
- Good fit for a domain-heavy product with users, projects, grants, tokens, dashboards, MCP endpoints
- Strong typing across API contracts
- Easy integration with frontend TypeScript stack
- Good ecosystem for auth, validation, OpenAPI, background jobs

### Decision
- Prefer NestJS if you want stronger architectural conventions
- Prefer Fastify + modular custom structure if you want lighter runtime and less framework weight

### Recommendation strength
- Strong

## 3. Primary Central Database
### Recommended
- PostgreSQL

### Why
- Best default choice for structured relational domain data
- Excellent for projects, tasks, memory, grants, audit, tokens, dashboards
- Strong transactional consistency
- Mature indexing and query capabilities
- Easy hosting and team-wide adoption

### Recommendation strength
- Very strong

## 4. Local Storage For MCP / Local Agent Workflows
### Recommended
- SQLite for local node storage

### Why
- Zero-friction local persistence
- Good for offline/local-first workflows
- Easy to embed in local MCP server or desktop-side component
- Natural staging layer before sync to central PostgreSQL

### Recommendation strength
- Strong

## 5. ORM / Data Access Layer
### Recommended
- Prisma for application-level data access

### Why
- Good developer experience
- Strong TypeScript support
- Clean schema management
- Useful for fast iteration across many entities

### Caveat
- For very advanced SQL or analytics-heavy dashboard queries, use raw SQL selectively

### Alternative
- Drizzle if you want lighter and closer-to-SQL control

### Recommendation strength
- Strong

## 6. Authentication
### Recommended
- OpenID Connect / OAuth 2.1 compatible architecture
- Auth.js or a dedicated auth module backed by PostgreSQL for MVP
- Support local auth first, with future SSO capability

### Why
- Roadboard 2.0 needs real user identity, not ad-hoc auth
- Future-proof for team and enterprise environments
- Compatible with token issuance and grant enforcement

### Recommendation strength
- Strong

## 7. Authorization / Grants
### Recommended
- Application-level RBAC with explicit project grants stored in PostgreSQL

### Why
- Grants are core domain entities, not just framework config
- You need project-scoped and team-scoped control
- Easier to audit and expose in UI

### Recommendation strength
- Very strong

## 8. MCP Server Layer
### Recommended
- Dedicated MCP server implemented in TypeScript
- Keep MCP server separate from core API process, but backed by the same domain services

### Why
- Clear separation between human API and agent tool surface
- Easier to evolve tool contracts independently
- Safer for audit, token scope enforcement, and rate limiting

### Recommendation strength
- Very strong

## 9. Local Sync Agent / Bridge
### Recommended
- Lightweight local service in TypeScript
- SQLite locally
- Sync protocol with central backend over HTTPS

### Why
- Same language as backend/MCP reduces fragmentation
- Easier code sharing for validation models and schemas
- Good fit for local agent workflows

### Alternative
- Rust for a later hardened local daemon if performance/distribution becomes critical

### Recommendation strength
- Strong for TypeScript MVP

## 10. Search
### Phase 1 Recommendation
- PostgreSQL full-text search + structured filters

### Phase 2 Recommendation
- OpenSearch or Meilisearch depending on scale and UX goals

### Why
- Do not introduce a search engine too early
- Structured filters + Postgres FTS are enough for MVP
- External search becomes useful when cross-project search and ranking complexity grow

### Recommendation strength
- Strong phased recommendation

## 11. Semantic Retrieval / Embeddings
### MVP Recommendation
- Do not make this a hard dependency

### Later Recommendation
- Add a retrieval module only after the structured memory model is working well
- Use pgvector first if experimentation begins

### Why
- Structured memory and links should solve much of the problem early
- Premature semantic retrieval risks noise and complexity

### Recommendation strength
- Strong: defer

## 12. Background Jobs / Async Processing
### Recommended
- BullMQ with Redis, or equivalent job queue

### Why
- Useful for sync jobs, context bundle generation, dashboard materialization, activity processing, token cleanup
- Mature and common in Node ecosystems

### Recommendation strength
- Strong

## 13. Cache / Ephemeral Coordination
### Recommended
- Redis

### Why
- Good for queue backend, cache, token/session short-lived coordination, rate limiting
- Useful but should not become the source of truth

### Recommendation strength
- Strong

## 14. API Style
### Recommended
- REST or REST-first JSON API for core product API
- OpenAPI contract generation

### Why
- Clear and easy for dashboards, admins, integrations, MCP bridge
- Better inspectability than over-complicated GraphQL for early versions

### Recommendation strength
- Strong

## 15. Realtime Updates
### Recommended
- WebSockets or Server-Sent Events for dashboard updates and activity streams

### Why
- Good for project state updates, recent activity, sync monitoring
- Keep optional in MVP if polling is enough initially

### Recommendation strength
- Moderate for MVP, stronger later

## 16. Dashboards / Analytics Queries
### Recommended
- PostgreSQL materialized views or optimized SQL queries
- Backend-computed dashboard DTOs

### Why
- Dashboards should be explicit and predictable
- Avoid premature BI stack complexity

### Recommendation strength
- Strong

## 17. Audit Trail
### Recommended
- Dedicated ActivityEvent table in PostgreSQL
- Append-only where possible

### Why
- Needed for team work, agent actions, token use, grant changes, sync tracing
- Core compliance/debuggability feature

### Recommendation strength
- Very strong

## 18. File / Artifact Storage
### Recommended
- S3-compatible object storage for exported bundles, generated reports, attachments

### Why
- Do not overload the relational DB with heavier artifacts
- Keeps architecture clean for handoff exports and large snapshots

### Recommendation strength
- Strong, but can be deferred if artifacts are small in MVP

## 19. Observability
### Recommended
- OpenTelemetry instrumentation
- Prometheus + Grafana for metrics
- Structured logs (JSON)
- Sentry for application errors

### Why
- Particularly important because Roadboard 2.0 includes agent and sync behavior
- Debuggability matters more than novelty here

### Recommendation strength
- Strong

## 20. Deployment
### Recommended
- Dockerized services
- Central deployment on Linux server or Kubernetes later
- Managed PostgreSQL where possible

### Why
- Straightforward team deployment path
- Keeps local development and central environment close enough

### Recommendation strength
- Strong

## 21. Testing Strategy
### Recommended
- Unit tests: Vitest or Jest
- API/integration tests: Playwright for UI + API integration tests
- Contract tests for MCP tools and token scopes

### Why
- MCP behavior and permission handling must be tested explicitly
- Dashboard correctness also needs integration coverage

### Recommendation strength
- Very strong

## 22. Recommended MVP Stack Summary
### Frontend
- Next.js
- React
- TypeScript
- Tailwind

### Backend
- Node.js
- TypeScript
- NestJS or Fastify
- Prisma

### Data
- PostgreSQL (central)
- SQLite (local)
- Redis (queue/cache)

### Agent Layer
- Dedicated TypeScript MCP server
- Token-based scoped access

### Search / Retrieval
- PostgreSQL FTS + structured filters

### Ops
- BullMQ
- Docker
- Prometheus/Grafana
- Sentry

## 23. Technology Fit By Component
| Component | Recommended Technology | Notes |
|---|---|---|
| Web UI | Next.js + React + TypeScript | Best fit for dashboards/admin/product UI |
| Core API | NestJS or Fastify + TypeScript | Domain-heavy backend |
| Central DB | PostgreSQL | Source of truth |
| Local Store | SQLite | Local agent workflow |
| ORM | Prisma | Fast iteration |
| Auth | OIDC/OAuth-compatible auth module | Future SSO-ready |
| Grants | App-level RBAC | Domain-native permissions |
| MCP Server | Dedicated TypeScript service | Separate agent surface |
| Sync | TypeScript local bridge + HTTPS | Local/central model |
| Search | PostgreSQL FTS initially | External engine later |
| Jobs | BullMQ + Redis | Async tasks |
| Cache | Redis | Ephemeral only |
| Dashboards | SQL/materialized views + DTOs | Predictable reporting |
| Audit | ActivityEvent in PostgreSQL | Critical for trust |
| Artifacts | S3-compatible storage | Exported bundles/reports |
| Observability | OpenTelemetry + Prometheus/Grafana + Sentry | Required for ops |

## 24. Final Recommendation
Build Roadboard 2.0 on a TypeScript-first architecture with:
- Next.js on the frontend
- modular Node backend
- PostgreSQL as central source of truth
- SQLite for local MCP workflows
- dedicated MCP service
- explicit grants, audit, and dashboard layers

This is the stack most likely to balance speed, clarity, team collaboration, agent integration, and long-term maintainability.
