# Roadboard 2.0 Repository Structure

## Decision
Roadboard 2.0 will use a **mono-repo**.

## Rationale
A mono-repo is the best fit for Roadboard 2.0 because the platform has:
- a shared domain model
- multiple tightly related services
- shared contracts between human-facing and agent-facing systems
- a TypeScript-first architecture
- common validation, auth, grant, token, and MCP concepts

Using multiple repositories too early would increase friction in:
- schema sharing
- contract evolution
- coordinated releases
- refactors across services
- local development
- CI/CD management

## Why Mono-Repo Fits This Project
Roadboard 2.0 includes several bounded services, but they are still part of one product:
- `web-app`
- `core-api`
- `auth-access`
- `mcp-service`
- `local-sync-bridge`
- `worker-jobs`

These services will likely share:
- TypeScript types
- validation schemas
- API contracts
- domain vocabulary
- auth/grant/token rules
- MCP tool contracts
- local development workflows

A mono-repo makes this much easier to manage coherently.

## Recommended Mono-Repo Shape

```text
roadboard/
  apps/
    web-app/
    core-api/
    auth-access/
    mcp-service/
    local-sync-bridge/
    worker-jobs/
  packages/
    domain/
    database/
    auth/
    grants/
    mcp-contracts/
    api-contracts/
    ui/
    config/
    observability/
  infra/
    docker/
    k8s/
    scripts/
  docs/
    roadboard2/
```

## Package Strategy
Use shared packages only for things that are truly shared.

Recommended package categories:
- `domain`: entity definitions, enums, shared domain concepts
- `database`: Prisma schema, migrations, DB utilities
- `auth`: shared auth helpers and token primitives
- `grants`: permission logic shared where appropriate
- `mcp-contracts`: tool schemas, request/response contracts
- `api-contracts`: DTOs or generated clients where useful
- `ui`: reusable frontend components
- `config`: lint, tsconfig, env helpers
- `observability`: logging/metrics/tracing helpers

Important rule:
Do not turn `packages/` into a dumping ground.
Only extract what is truly cross-service.

## Build Tooling Recommendation
Use a mono-repo build system such as:
- Turborepo

Alternative:
- Nx

Recommended choice:
- **Turborepo** for simplicity and strong fit with TypeScript/Next.js ecosystems

## Dependency Management Recommendation
Use:
- pnpm workspaces

Why:
- efficient workspace handling
- good mono-repo ergonomics
- strong TypeScript ecosystem compatibility

## CI/CD Recommendation
Run CI per changed app/package where possible.

Suggested pipeline structure:
- lint
- typecheck
- unit tests
- app-specific integration tests
- build only affected services where possible

## Local Development Recommendation
Mono-repo should support:
- running all central services together
- running only selected services during focused work
- local bridge development independently
- shared environment examples and scripts

## Architectural Guardrail
Mono-repo must not mean service boundaries disappear.

Important rule:
- one repository
- many clear services
- explicit ownership boundaries

## Final Recommendation
Use a mono-repo with:
- `pnpm` workspaces
- `Turborepo`
- `apps/` for deployable services
- `packages/` for shared contracts and utilities
- strict service boundaries despite shared codebase

This is the best balance between coordination speed and architectural clarity for Roadboard 2.0.
