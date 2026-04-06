# Roadboard 2.0 Worker Jobs Structure

## Goal
Define the internal structure of the `worker-jobs` service.

This service is responsible for asynchronous processing in Roadboard 2.0.

It exists to keep heavy, delayed, or derived work out of request/response paths for:
- `core-api`
- `auth-access`
- `mcp-service`
- `local-sync-bridge`

It is not the owner of canonical product entities.

## Architectural Role
The `worker-jobs` service is a **background execution and projection layer**.

It owns:
- async job execution
- derived summaries
- dashboard refresh/materialization
- handoff/summary generation support
- cleanup jobs
- reconciliation support jobs

It does **not** own:
- project/task/memory canonical truth
- user/team/grant/token canonical truth
- MCP protocol/tool definitions

Those remain owned by their respective services.

## Recommended Technology
- Node.js
- TypeScript
- BullMQ
- Redis
- thin clients/adapters toward central services

## Suggested Internal Layout

```text
apps/worker-jobs/
  src/
    main.ts
    app/
      worker.bootstrap.ts
      worker.module.ts
    common/
      guards/
      pipes/
      filters/
      dto/
      utils/
      jobs/
    queue/
      queue.names.ts
      queue.factory.ts
      job.registry.ts
    jobs/
      dashboards/
      summaries/
      handoffs/
      sync/
      cleanup/
      audit/
    clients/
      core-api/
      auth-access/
      mcp-service/
    policies/
      retries/
      idempotency/
      scheduling/
    config/
  test/
    integration/
    jobs/
  package.json
  tsconfig.json
```

## High-Level Design

### 1. `queue/`
Contains queue configuration and job registration.

Responsibilities:
- define queue names
- configure BullMQ queues/workers
- register processors
- centralize queue bootstrap

Suggested queue families:
- `dashboard.refresh`
- `summary.generate`
- `handoff.generate`
- `sync.reconcile`
- `token.cleanup`
- `activity.aggregate`

### 2. `jobs/dashboards`
Responsible for dashboard-oriented async work.

Possible responsibilities:
- refresh derived dashboard data
- precompute expensive project snapshots
- build milestone progress aggregates
- cache recent activity views

Important:
This module should produce read models or derived projections, not rewrite canonical task/project state silently.

### 3. `jobs/summaries`
Responsible for summary generation support.

Possible responsibilities:
- generate project summaries
- generate active work snapshots
- generate recent memory summaries
- assemble decision digests

This can support both dashboards and MCP workflow tools.

### 4. `jobs/handoffs`
Responsible for handoff-oriented async work.

Possible responsibilities:
- create structured session handoff drafts
- aggregate recent work into handoff-friendly bundles
- prepare continuity summaries for review

Important:
Handoff generation may create candidate artifacts, but should not replace human review if the workflow requires approval.

### 5. `jobs/sync`
Responsible for sync-related background work.

Possible responsibilities:
- reconciliation jobs
- periodic refresh jobs
- retry-safe sync support tasks
- stale state cleanup support

This complements `local-sync-bridge`, but does not replace the local bridge’s own runtime behavior.

### 6. `jobs/cleanup`
Responsible for cleanup and maintenance.

Possible responsibilities:
- expired token cleanup
- stale session cleanup
- temporary artifact cleanup
- old derived snapshot cleanup

### 7. `jobs/audit`
Responsible for audit-adjacent aggregation work.

Possible responsibilities:
- activity compaction
- audit projection building
- usage metric aggregation

This area should produce derived insights, not alter canonical audit truth.

## Clients Layer

### `clients/core-api`
Contains typed clients for:
- project reads
- task/memory/decision reads where needed for summaries
- dashboard projection writes if explicitly allowed
- handoff-related reads/writes if that contract exists

### `clients/auth-access`
Contains typed clients for:
- token metadata queries
- cleanup-related auth/session/token operations
- grant-aware access checks where necessary

### `clients/mcp-service`
Contains typed clients only if worker-generated outputs need to notify or refresh MCP-oriented caches/workflows.

Important rule:
The worker should not directly touch another service’s DB tables.
Use service APIs or explicit internal contracts.

## Policies Layer

### `policies/retries`
Contains:
- retry strategies
- backoff rules
- max attempts by job family

### `policies/idempotency`
Contains:
- job deduplication logic
- safe reprocessing rules
- idempotency keys where appropriate

### `policies/scheduling`
Contains:
- cron-like scheduling rules
- periodic refresh windows
- maintenance timing policies

Important rule:
Async systems become dangerous when retries and idempotency are vague.
These policies must be explicit.

## Recommended Job Design Principles

### Principle 1
Jobs should be narrow and purposeful.

### Principle 2
Derived work belongs here; canonical business ownership does not.

### Principle 3
Jobs must be safe to retry.

### Principle 4
Every job family should have observable status and error reporting.

### Principle 5
Do not hide critical product behavior in background jobs if users/agents expect immediate consistency.

## Suggested Initial Jobs For MVP

### Dashboard jobs
- refresh project dashboard snapshot
- refresh milestone progress view

### Summary jobs
- generate project summary bundle
- generate recent activity summary

### Handoff jobs
- generate handoff draft from recent activity

### Cleanup jobs
- revoke/expire stale tokens cleanup
- remove stale temp bundles

### Sync jobs
- reconcile pending local sync support queues if central support is needed

## Request vs Async Boundary Recommendation
Use `worker-jobs` only when the work is:
- expensive
- delayed
- derived
- retryable
- non-essential for immediate request completion

Do **not** move ordinary CRUD or permission decisions here.

## Data Handling Recommendation
The worker may:
- read canonical data through service APIs
- build derived summaries/projections
- write projection/read-model data if explicitly allowed
- emit activity/status updates

The worker must **not**:
- mutate canonical project/task/memory entities arbitrarily
- bypass service ownership rules
- invent hidden business workflows

## Observability Requirements
Must include:
- queue depth visibility
- job success/failure metrics
- retries and dead-letter visibility
- correlation IDs where possible
- per-job-family logging

This is essential because async failures are otherwise easy to miss.

## Testing Strategy
Must include:
- job processor tests
- retry/idempotency tests
- downstream failure handling tests
- projection correctness tests
- cleanup safety tests

## Rules To Lock In

### Rule 1
`worker-jobs` handles derived asynchronous work, not ownership of source-of-truth entities.

### Rule 2
Every job family must have explicit retry and idempotency rules.

### Rule 3
The worker must call owning services, not write directly into their canonical tables.

### Rule 4
If a behavior must be immediately visible and transactionally consistent, it probably does not belong only in a worker.

### Rule 5
Async complexity should be introduced gradually, not all at once.

## Final Recommendation
The `worker-jobs` service should be a dedicated background processing layer that keeps Roadboard 2.0 responsive and maintainable.

Its main job is to support:
- dashboard visibility
- summary/handoff generation
- cleanup
- reconciliation support

through safe, observable, retryable background execution.
