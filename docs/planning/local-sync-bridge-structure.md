# Roadboard 2.0 Local Sync Bridge Structure

## Goal
Define the internal structure of the `local-sync-bridge` service.

This service is the local-first execution bridge between agent workflows running on a developer machine and the central Roadboard 2.0 platform.

It is responsible for:
- local SQLite persistence
- local working state for agent interactions
- pending write journaling
- synchronization with central services
- sync status, reconciliation, and failure visibility

It is not the canonical owner of team-shared project state.

## Architectural Role
The `local-sync-bridge` is a **local state and transport layer**.

It owns:
- local transient state
- local cached snapshots
- local pending operations
- local sync journal
- local sync metadata
- local agent-side working context bundles

It does **not** own:
- canonical project/task/memory truth
- user identity truth
- central grants/tokens truth

Those remain owned by `core-api` and `auth-access`.

## Recommended Technology
- TypeScript
- SQLite
- lightweight local daemon/service
- HTTPS sync to central services
- structured local operation journal

## Suggested Internal Layout

```text
apps/local-sync-bridge/
  src/
    main.ts
    app/
      bridge.server.ts
      bridge.module.ts
    common/
      guards/
      pipes/
      filters/
      dto/
      utils/
      context/
    storage/
      sqlite/
      repositories/
      migrations/
    journal/
      operations/
      reconciliation/
      retries/
    sync/
      clients/
        core-api/
        auth-access/
      engine/
      mapping/
      policies/
      status/
    context-bundles/
    api/
      local-state/
      sync-status/
      bundles/
    config/
  test/
    integration/
    sync/
  package.json
  tsconfig.json
```

## High-Level Design

### 1. `storage/`
Contains local SQLite persistence concerns.

Responsibilities:
- local schema definition support
- local repositories
- local migrations
- local snapshot storage
- local working note storage
- local pending-operation storage

Recommended local storage categories:
- project snapshots
- task snapshots
- local working notes
- pending writes
- sync metadata
- local context bundles

Important rule:
SQLite is a local cache/staging layer, not the central truth.

### 2. `journal/`
Contains the local operation journal.

Responsibilities:
- record pending writes before sync
- store retry state
- preserve ordering metadata where needed
- support reconciliation
- support visibility into failed or blocked operations

This is one of the most important areas of the service.

Suggested journal item kinds:
- create task
- update task status
- create memory entry
- create decision
- create handoff
- refresh snapshot

### 3. `sync/`
Contains synchronization logic with the central platform.

Responsibilities:
- call central services
- map local journal items to central API operations
- resolve success/failure outcomes
- mark journal entries applied
- refresh local snapshots after sync
- expose sync health/status

Subareas:

#### `sync/clients`
Typed clients for:
- `core-api`
- `auth-access`

#### `sync/engine`
Core sync orchestration.

Possible responsibilities:
- process pending queue
- backoff and retry
- refresh local state after successful writes
- schedule reconciliation pulls

#### `sync/mapping`
Responsible for translating:
- local journal operations -> central API calls
- central API responses -> local state updates

#### `sync/policies`
Rules such as:
- when sync may start
- which operation types require fresh auth
- safe retry rules
- conflict handling policy

#### `sync/status`
Keeps observable sync state for local dashboards/inspection.

### 4. `context-bundles/`
Contains local assembly/storage of context bundles for agents.

Responsibilities:
- store locally useful task/project context
- package recent activity for agent reuse
- cache selected central summaries locally

This area is useful because local agent workflows may want quick access without central roundtrips every time.

### 5. `api/`
Exposes local APIs if needed by local tools or local MCP clients.

Suggested endpoints:
- local state inspection
- pending journal inspection
- sync trigger
- sync status
- local bundle retrieval

Important rule:
this should remain a local operational API, not a second product backend.

## Suggested Local Data Model

### `local_project_snapshot`
Stores:
- project metadata snapshot
- last refreshed at

### `local_task_snapshot`
Stores:
- task metadata snapshot
- task status snapshot
- assignment and priority snapshot
- last refreshed at

### `local_memory_snapshot`
Stores:
- selected recent memory entries
- last refreshed at

### `local_decision_snapshot`
Stores:
- selected recent decisions
- last refreshed at

### `pending_operation`
Stores:
- operation id
- operation type
- payload
- target project
- created at
- status
- retry count
- last error

### `sync_run`
Stores:
- sync run id
- started at
- finished at
- status
- summary stats

### `local_context_bundle`
Stores:
- bundle id
- bundle type
- target reference
- content blob or structured content ref
- created at

## Sync Strategy Recommendation

### Phase 1 Strategy
Keep sync simple and explicit:
- local writes go to journal first
- sync engine pushes them centrally
- successful sync updates local status
- periodic pull refresh updates local snapshots

### Important constraint
Do not attempt a highly sophisticated bi-directional conflict resolution engine in v1.

### Recommended model
- central platform remains source of truth
- local bridge acts as a reliable staging and cache layer
- conflicts are surfaced explicitly, not hidden magically

## Conflict Handling Recommendation
For v1:
- prefer explicit conflict/error status
- retry safe idempotent operations
- require fresh pull when needed
- avoid silent merges of semantic content

In particular:
- memory/decision writes should not be silently merged if they conflict semantically
- task status updates should use predictable last-known-state checks when appropriate

## Token / Auth Interaction
The local bridge should not invent auth rules.

Recommended flow:
1. local operation is created
2. sync engine obtains/uses valid local auth context or MCP token context
3. sync call is made to central service
4. denial or expiration is recorded clearly
5. user/agent can inspect the sync failure reason

## Rules To Lock In

### Rule 1
Local SQLite is not the team source of truth.

### Rule 2
Every write should be journaled before sync.

### Rule 3
Sync failures must be inspectable.

### Rule 4
Conflict handling should prefer clarity over hidden automation.

### Rule 5
The local bridge should remain operationally simple in v1.

## Recommended Initial Features
For the earliest version, prioritize:
- local SQLite setup
- project/task snapshot tables
- pending operation journal
- sync engine for a few core operations
- sync status visibility
- local context bundle cache

Suggested first synced operations:
- create task
- update task status
- create memory entry
- create decision

## Testing Strategy
Must include:
- journal write tests
- retry/backoff tests
- sync success/failure tests
- denial/expired token tests
- snapshot refresh tests
- local persistence integrity tests

## Final Recommendation
The `local-sync-bridge` should be a small but reliable local daemon/service that makes Roadboard 2.0 usable in local agent workflows without pretending to replace the central platform.

Its strength should be:
- predictable journaling
- clear sync state
- useful local caching
- explicit reconciliation

not over-ambitious distributed systems complexity.
