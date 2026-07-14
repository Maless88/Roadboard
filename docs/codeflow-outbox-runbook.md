# CodeFlow Outbox Runbook

Outbox table: `graph_sync_events`  
Worker: `apps/worker-jobs/src/modules/graph-projection/graph-projection.service.ts`  
Feature flag: `GRAPH_SYNC_USE_OUTBOX` (default `false`)

---

> **Update (CF-GDB-03b-E):** Memgraph is now the **single source of truth** for
> the CodeFlow architecture graph. The PostgreSQL graph mirror tables
> (`architecture_nodes`, `architecture_edges`, `architecture_links`,
> `architecture_annotations`) were dropped and `GraphService` writes directly to
> Memgraph (fail-closed) — there is no longer a dual-write path.
>
> As a result the Postgres↔Memgraph drift concept no longer exists:
> **`DriftService` and the `GET /projects/:projectId/codeflow/graph/drift`
> endpoint have been retired**, along with the scheduled `drift-check` systemd
> units. See `codeflow-drift-runbook.md` (also retired).
>
> The `graph_sync_events` outbox table and its worker remain for the
> repository/metadata projection paths; the one-shot scripts
> `migrate-to-memgraph` and `backfill-outbox` are obsolete (the source mirror
> tables they read no longer exist).

---

## 1. Inspect current state

```sql
-- Count per status
SELECT status, COUNT(*) as count,
       MAX(attempts) as max_attempts,
       AVG(attempts)::numeric(4,2) as avg_attempts
FROM graph_sync_events
GROUP BY status
ORDER BY status;

-- Oldest pending event
SELECT id, project_id, entity_type, entity_id, op, attempts, created_at,
       EXTRACT(EPOCH FROM (NOW() - created_at))/60 AS age_minutes
FROM graph_sync_events
WHERE status = 'pending'
ORDER BY created_at ASC
LIMIT 5;

-- Dead events
SELECT id, project_id, entity_type, entity_id, op, attempts, last_error, created_at
FROM graph_sync_events
WHERE status = 'dead'
ORDER BY created_at DESC
LIMIT 20;

-- High-attempt events (stuck)
SELECT id, project_id, entity_type, entity_id, op, attempts, status, last_error, next_attempt_at
FROM graph_sync_events
WHERE attempts > 3
ORDER BY attempts DESC
LIMIT 20;
```

Via Docker:

```bash
docker exec $(docker ps --format '{{.Names}}' | grep postgres) \
  psql -U roadboard -d roadboard -c "SELECT status, COUNT(*) FROM graph_sync_events GROUP BY status;"
```

---

## 2. Backlog alert

The worker emits a structured `WARN` log when `pending + dead > 50`:

```json
{
  "msg": "graph_sync_backlog_high",
  "pending": 60,
  "dead": 5,
  "backlog": 65,
  "threshold": 50,
  "hint": "Run the outbox runbook: docs/codeflow-outbox-runbook.md"
}
```

Alert fires at most once every 10 seconds (10 poll ticks). To adjust the threshold, edit `BACKLOG_THRESHOLD` in `graph-projection.service.ts`.

---

## 3. Retry a dead/stuck event

Reset a single `dead` or stuck (`in_progress`) event back to `pending`:

```sql
UPDATE graph_sync_events
SET status = 'pending',
    attempts = 0,
    next_attempt_at = NULL,
    last_error = NULL
WHERE id = '<event-id>';
```

Reset all `dead` events at once (use with caution):

```sql
UPDATE graph_sync_events
SET status = 'pending',
    attempts = 0,
    next_attempt_at = NULL,
    last_error = NULL
WHERE status = 'dead';
```

---

## 4. Clear dead events

After investigating root cause, delete dead events that are no longer recoverable:

```sql
-- Preview first
SELECT COUNT(*) FROM graph_sync_events WHERE status = 'dead';

-- Delete
DELETE FROM graph_sync_events WHERE status = 'dead';
```

---

## 5. Force-reprocess a project

If a whole project's graph is stale, reset all its events:

```sql
UPDATE graph_sync_events
SET status = 'pending', attempts = 0, next_attempt_at = NULL, last_error = NULL
WHERE project_id = '<project-id>'
  AND status IN ('dead', 'in_progress');
```

Or insert a `project:reset` event (worker will DETACH DELETE all nodes for the project in Memgraph then let subsequent upsert events rebuild):

```sql
INSERT INTO graph_sync_events (id, project_id, entity_type, entity_id, op, payload)
VALUES (gen_random_uuid()::text, '<project-id>', 'project', '<project-id>', 'reset', '{}');
```

---

## 6. Common root causes

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Dead events with "Memgraph unreachable" | Memgraph container down | `docker compose up -d memgraph` |
| `attempts > 3`, `last_error` mentions node not found | Edge upsert before nodes are created | Retry after ensuring node events are processed first |
| Backlog grows but worker never consumes | `GRAPH_SYNC_USE_OUTBOX=false` (flag off) | Enable flag or check worker-jobs container |
| `in_progress` rows stuck for > 5 min | Worker crashed mid-batch | Reset to `pending` via the query in §3 |

---

## 7. Enable/disable outbox mode

Set the env var in `.env` (then rebuild containers):

```bash
GRAPH_SYNC_USE_OUTBOX=true   # enable outbox + projection worker
GRAPH_SYNC_USE_OUTBOX=false  # disable (default): writes go directly to Memgraph, no outbox mirroring
```

Rebuild after env change:

```bash
docker compose -f infra/docker/docker-compose.yml build core-api worker-jobs
docker compose -f infra/docker/docker-compose.yml up -d --no-deps core-api worker-jobs
```

---

## 8. Baseline audit (2026-05-12)

Audit performed on 2026-05-12. State at that time:

- `graph_sync_events` table existed with correct schema and indexes.
- Total rows: **0** — outbox was empty, no stuck or dead events.
- `GRAPH_SYNC_USE_OUTBOX=false` — dual-write path active (fire-and-forget to Memgraph).
- Projection worker (`worker-jobs/GraphProjectionService`) correctly implements poll loop, claim-batch with `SELECT FOR UPDATE SKIP LOCKED`, exponential backoff, and dead-letter after 5 attempts.
- Alert wired in this task: `checkBacklogAlert()` runs every 10 ticks and emits structured `WARN` when `pending + dead > 50`.
