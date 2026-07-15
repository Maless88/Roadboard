# CodeFlow Drift Runbook

**Audience**: on-call engineers, Architect agents  
**Last updated**: 2026-06-08  
**Status**: RETIRED (CF-GDB-03b-E)

---

> ## ⚠️ RETIRED — drift no longer exists
>
> As of **CF-GDB-03b-E**, Memgraph is the **single source of truth** for the
> CodeFlow architecture graph. The PostgreSQL mirror tables
> (`architecture_nodes`, `architecture_edges`, `architecture_links`,
> `architecture_annotations`) were dropped, so there are no longer two
> projections that can diverge — the concept of Postgres↔Memgraph drift is gone.
>
> Consequently:
>
> - **`DriftService` has been removed** (`drift.service.ts` deleted).
> - **The diagnostic endpoint `GET /projects/:projectId/codeflow/graph/drift`
>   has been retired** (deliberate internal/admin breaking change — it was never
>   part of the public API contract).
> - **The scheduled drift check has been removed**: `scripts/drift-check.sh`,
>   `infra/systemd/roadboard-drift-check.service`, and
>   `infra/systemd/roadboard-drift-check.timer` are deleted.
>
> The remaining relational tables under CodeFlow are scan metadata only
> (`architecture_snapshots`, `code_repositories`); they are not graph data and
> are not subject to drift.
>
> The content below is preserved for historical reference only and no longer
> reflects the running system.

---

## What is drift? (historical)

The CodeFlow graph stores two projections of the same architectural data:

- **Postgres** — the system of record (`architecture_nodes`, `architecture_edges`, `architecture_links`, `architecture_annotations`, `code_repositories`).
- **Memgraph** — the in-memory graph used for fast traversal and impact analysis.

*Drift* occurs when the two projections diverge: entities present in Postgres are missing in Memgraph, or vice-versa. The drift detector (`DriftService`) computes an md5 fingerprint of sorted IDs for each entity type and reports mismatches.

Tracked entity types (each must hit `inSync: true` for a clean baseline):

| Entity type   | Postgres source                                          | Memgraph label        |
|---------------|----------------------------------------------------------|-----------------------|
| `node`        | `architecture_nodes` (filtered by `isCurrent=true`)      | `(n)` excluding `Link`/`Annotation`/`Repository` |
| `edge`        | `architecture_edges` (filtered by `isCurrent=true`)      | typed relationships excl. `LINKED_TO`/`ANNOTATES` |
| `link`        | `architecture_links`                                     | `:Link`               |
| `annotation`  | `architecture_annotations`                               | `:Annotation`         |
| `repository`  | `code_repositories`                                      | `:Repository`         |

`Link` and `Annotation` mirror parity was added in CF-GDB-03b-A together with the extended node attributes (`description`, `metadata`, `ownerUserId`, `ownerTeamId`, `isManual`, `isCurrent`). Both direct-sync (`GraphSyncService`) and outbox (`GraphProjectionService`) write the same shape.

---

## Baseline (2026-05-12)

Run immediately after Memgraph was restarted from a cold state (was offline during demo-seed on 2026-04-30).

| Entity type  | Postgres | Memgraph (before fix) | Drift  |
|--------------|----------|-----------------------|--------|
| node         | 57       | 52                    | 5 missing |
| edge         | 65       | 56                    | 9 missing |
| link         | 2        | 0                     | 2 missing |
| annotation   | 35       | 35                    | in sync |
| repository   | 5        | 4                     | 1 missing |

After manual Cypher MERGE repair, **totalDrift: 0** across all 5 entity types (confirmed 2026-05-12T15:07:59Z).

**Root cause**: Memgraph was stopped when `demo-seed` seeded Tour Roadboard data into Postgres on 2026-04-30. The dual-write path (`GraphSyncService.upsertNode/upsertEdge`) silently logged a warning and skipped. No replay mechanism exists — the outbox is disabled (`GRAPH_SYNC_USE_OUTBOX=false`).

---

## How to run the drift check

### Via HTTP (preferred in dev and staging)

```bash
# 1. Obtain a session token
TOKEN=$(curl -s -X POST http://localhost:3002/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "<user>", "password": "<password>"}' \
  | jq -r '.token')

# 2. Run drift check against any project ID (detector is global — result is identical for all)
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/projects/<projectId>/codeflow/graph/drift" | jq
```

> The drift detector operates **globally** (not per-project). The `projectId` in the URL is required by the route guard but the actual query scans all of Memgraph and Postgres without project filtering.

### Via systemd timer (production / staging host)

The timer and service unit files live in `infra/systemd/`:

```
infra/systemd/roadboard-drift-check.timer    # fires on boot+5min, then hourly
infra/systemd/roadboard-drift-check.service  # oneshot: calls scripts/drift-check.sh
```

Installation (as root on the host):

```bash
cp infra/systemd/roadboard-drift-check.{timer,service} /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now roadboard-drift-check.timer
```

Verify:

```bash
systemctl list-timers | grep drift
journalctl -u roadboard-drift-check.service -n 50
```

**Note**: In the current development environment the timer is *defined but not installed*. Install only on a host where the containers run persistently.

---

## How to interpret the output

```json
{
  "generatedAt": "2026-05-12T15:07:59.732Z",
  "reachable": true,
  "entities": [
    {
      "type": "node",
      "postgresCount": 57,
      "memgraphCount": 57,
      "postgresHash": "d38f115b7d07ab31cbb14d215a6b950e",
      "memgraphHash": "d38f115b7d07ab31cbb14d215a6b950e",
      "inSync": true,
      "missingInMemgraph": [],
      "extraInMemgraph": []
    }
  ],
  "totalDrift": 0
}
```

| Field | Meaning |
|-------|---------|
| `reachable` | `false` → Memgraph is down; all other fields are empty |
| `inSync` | `true` → counts and hashes match for this entity type |
| `totalDrift` | count of entity types that are out-of-sync (0 = fully in sync) |
| `missingInMemgraph` | up to 5 IDs present in Postgres but absent from Memgraph |
| `extraInMemgraph` | up to 5 IDs present in Memgraph but absent from Postgres (stale) |

---

## Escalation / remediation

### Case 1: `reachable: false`

Memgraph is down.

```bash
docker compose -f infra/docker/docker-compose.yml up -d memgraph
# Wait ~10s for healthy status, then re-run drift check.
```

After restart, run the drift check immediately — entities created while Memgraph was offline will show as drift and must be replayed manually (see Case 2).

### Case 2: Missing entities in Memgraph (`missingInMemgraph` non-empty)

These entities exist in Postgres but were never written to Memgraph (outbox disabled, sync write failed silently).

**Repair procedure**:

1. Identify the missing entity type and IDs from the drift report.
2. Fetch the full record from Postgres.
3. Use `mgconsole` (or the Bolt driver) to MERGE the entity into Memgraph.

Example — repair a missing node:

```bash
# Fetch from Postgres
docker exec roadboard-postgres-1 bash -c \
  "psql -U roadboard -d roadboard -c \
   \"SELECT id, name, type, path, domain_group, project_id FROM architecture_nodes WHERE id='<missing_id>';\""

# Write to Memgraph (replace label and values accordingly)
echo "MERGE (n:App {id: '<id>'})
  SET n.projectId = '<projectId>',
      n.type = 'app',
      n.name = '<name>',
      n.path = '<path>',
      n.domainGroup = '<domainGroup>'
RETURN n.id;" | docker exec -i roadboard-memgraph-1 mgconsole --no-history
```

Node label mapping (from `schema.ts / labelFromType`):

| `type` value | Memgraph label |
|-------------|---------------|
| `app`       | `App`          |
| `package`   | `Package`      |
| `module`    | `Module`       |
| `service`   | `Service`      |
| anything else | `Module`     |

Example — repair a missing edge:

```bash
echo "MATCH (a {id: '<from_node_id>'}), (b {id: '<to_node_id>'})
MERGE (a)-[r:DEPENDS_ON {id: '<edge_id>'}]->(b)
SET r.projectId = '<projectId>', r.weight = 1.0, r.edgeType = 'depends_on'
RETURN r.id;" | docker exec -i roadboard-memgraph-1 mgconsole --no-history
```

After repair, re-run the drift check and confirm `totalDrift: 0`.

### Case 3: Extra entities in Memgraph (`extraInMemgraph` non-empty)

An entity exists in Memgraph but was deleted from Postgres. This can happen if Postgres delete propagation to Memgraph failed.

```bash
echo "MATCH (n {id: '<stale_id>'}) DETACH DELETE n;" | \
  docker exec -i roadboard-memgraph-1 mgconsole --no-history
```

For relationships:

```bash
echo "MATCH ()-[r {id: '<stale_id>'}]->() DELETE r;" | \
  docker exec -i roadboard-memgraph-1 mgconsole --no-history
```

---

## Permanent fix considerations

The current dual-write path (`GraphSyncService`) silently swallows errors when Memgraph is unreachable. Long-term mitigations (not in scope for AI-P0-01):

1. **Enable outbox mode** (`GRAPH_SYNC_USE_OUTBOX=true`) — workers drain events and retry on reconnect.
2. **Add a Memgraph-up hook** — on `onModuleInit` reconnect, detect and replay missed events from `graphSyncEvent` table.
3. **Automated repair script** — nightly cron that calls the drift endpoint and auto-replays missing entities.

---

## Contacts / ownership

CodeFlow backbone: core-api `apps/core-api/src/modules/codeflow/`  
Drift detector: `drift.service.ts`, `graph.controller.ts` → `GET /projects/:id/codeflow/graph/drift`  
Timer files: `infra/systemd/roadboard-drift-check.{timer,service}`
