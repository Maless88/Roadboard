# Roadboard 2.0 Initial Monorepo Layout

## Goal
Define the real initial monorepo structure to create in the first implementation wave.

This layout is intentionally practical.
It includes only what is needed to start the platform correctly without creating empty folders and fake complexity everywhere.

## Initial Repository Layout

```text
RoadBoard/
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
    config/
    observability/
  infra/
    docker/
    scripts/
  docs/
    roadboard2/
  .github/
    workflows/
  package.json
  pnpm-workspace.yaml
  turbo.json
  tsconfig.base.json
  .env.example
  README.md
```

## Apps To Create From Day One

### `apps/web-app`
Purpose:
- human-facing UI
- dashboards
- project/milestone/task views
- memory/decision views
- token/admin views

Suggested sub-structure:

```text
apps/web-app/
  src/
  public/
  package.json
  next.config.js
  tsconfig.json
```

### `apps/core-api`
Purpose:
- central business domain
- projects, phases, milestones, tasks
- memory, decisions, handoffs
- dashboard queries
- audit event creation

Suggested sub-structure:

```text
apps/core-api/
  src/
    modules/
      projects/
      phases/
      milestones/
      tasks/
      memory/
      decisions/
      handoffs/
      dashboards/
      audit/
    common/
  test/
  package.json
  tsconfig.json
```

### `apps/auth-access`
Purpose:
- users
- teams
- memberships
- grants
- login/session flows
- MCP token lifecycle

Suggested sub-structure:

```text
apps/auth-access/
  src/
    modules/
      users/
      teams/
      memberships/
      grants/
      tokens/
      sessions/
    common/
  test/
  package.json
  tsconfig.json
```

### `apps/mcp-service`
Purpose:
- MCP protocol server
- read/write/workflow tools
- token scope validation
- agent request audit
- orchestration toward central services

Suggested sub-structure:

```text
apps/mcp-service/
  src/
    tools/
      read/
      write/
      workflow/
    clients/
    guards/
    audit/
  package.json
  tsconfig.json
```

### `apps/local-sync-bridge`
Purpose:
- local SQLite storage
- local agent working state
- pending sync journal
- central synchronization

Suggested sub-structure:

```text
apps/local-sync-bridge/
  src/
    storage/
    sync/
    journal/
    api/
  package.json
  tsconfig.json
```

### `apps/worker-jobs`
Purpose:
- async jobs
- dashboard refresh
- summary/handoff generation
- sync reconciliation
- cleanup jobs

Suggested sub-structure:

```text
apps/worker-jobs/
  src/
    jobs/
      dashboards/
      summaries/
      handoffs/
      sync/
      cleanup/
    queue/
  package.json
  tsconfig.json
```

## Packages To Create From Day One

### `packages/domain`
Contains:
- shared enums
- shared domain constants
- canonical cross-service vocabulary
- lightweight entity-level types that are truly shared

Do not put service-specific business logic here.

### `packages/database`
Contains:
- Prisma schema
- migrations
- DB helpers
- connection utilities

Important:
central PostgreSQL and local SQLite concerns should be clearly separated inside this package.

### `packages/auth`
Contains:
- shared auth primitives
- token helpers
- session utilities
- hashing/verification helpers

### `packages/grants`
Contains:
- permission enums
- grant resolution helpers
- shared grant-check building blocks

### `packages/mcp-contracts`
Contains:
- MCP tool schemas
- request/response definitions
- tool metadata
- workflow contracts

### `packages/api-contracts`
Contains:
- DTO contracts
- generated API types/clients where useful
- shared schema definitions for central services

### `packages/config`
Contains:
- eslint config
- prettier config
- shared TypeScript presets
- env helpers
- shared build config where useful

### `packages/observability`
Contains:
- logger setup
- tracing helpers
- metrics helpers
- error-reporting adapters

## Things To Avoid In The First Layout
Do not create these too early:
- `packages/ui` unless there is already real shared UI
- `packages/search` before search has enough logic to justify extraction
- `packages/sync` unless sync logic is genuinely shared in more than one app
- many empty domain packages split too finely from day one

## Initial Service Priority
Build order should be:

### Wave 1
- `apps/core-api`
- `apps/auth-access`
- `packages/domain`
- `packages/database`
- `packages/grants`
- `packages/auth`
- `packages/config`

### Wave 2
- `apps/web-app`
- `apps/mcp-service`
- `packages/mcp-contracts`
- `packages/api-contracts`

### Wave 3
- `apps/worker-jobs`
- `apps/local-sync-bridge`
- `packages/observability`

## Initial Infra Layout

### `infra/docker`
Should contain:
- local docker compose
- service definitions for postgres/redis
- dev bootstrap

### `infra/scripts`
Should contain:
- repo bootstrap
- dev run helpers
- migration helpers
- seed helpers

## Initial Docs Layout

### `docs/roadboard2`
Move the current planning files here over time:
- vision
- entities
- mvp-scope
- technology-stack
- technology-decisions
- service-architecture
- service-communication-and-data-ownership
- repository-structure

This keeps product/design docs clearly separated from source code.

## Final Recommendation
Start the monorepo with:
- all 6 app folders defined
- only the 8 shared packages that already have a clear role
- infra and docs folders immediately
- no speculative package explosion

The rule is:
**create the structure that matches the chosen architecture, but only populate the parts that already have real responsibility.**
