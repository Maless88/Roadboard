# CodeFlow — Impact read swap (CF-GDB-03b-B)

> **RETIRED (CF-GDB-03b-E)** — the `GRAPH_READ_USE_MEMGRAPH_IMPACT` flag described below
> no longer exists: `getImpact` now routes unconditionally to Memgraph, the Postgres
> graph tables and `GraphSyncService` were removed, and `impact-parity.spec.ts` was
> deleted with them. Historical record of the flag-gated transition step only.

Status: shipped, then superseded — the flag was removed once the cutover completed (see banner).

## What changed

`GraphService.getImpact(nodeId, projectId)` is now routed through Memgraph
via a Cypher reverse-BFS when the feature flag is ON. When OFF (default) the
call keeps using the legacy Postgres BFS — zero behavioural change.

The flag is intentionally per-getter: this is the first migration in the
per-getter cutover plan (CF-GDB-03b-B → C). `getNode`, `getGraph`,
`getSnapshot` remain on Postgres.

## Feature flag

| Env var                              | Default | Effect                                                     |
|--------------------------------------|---------|------------------------------------------------------------|
| `GRAPH_READ_USE_MEMGRAPH_IMPACT`     | `false` | OFF → Postgres BFS (current behaviour)                     |
|                                      | `true`  | ON  → Memgraph Cypher reverse-BFS, Postgres fallback on err|

Read once at GraphService construction time. To flip the flag in dev:

```bash
# Inside the core-api container
GRAPH_READ_USE_MEMGRAPH_IMPACT=true docker compose -f infra/docker/docker-compose.yml \
  up -d --no-deps core-api

# Or set it in .env before booting the stack
echo 'GRAPH_READ_USE_MEMGRAPH_IMPACT=true' >> .env
docker compose -f infra/docker/docker-compose.yml up -d --no-deps core-api
```

To rollback instantly: remove the env var (or set to `false`) and restart
core-api. No data migration, no Memgraph reset needed.

## Cypher query

```cypher
MATCH (target {id: $nodeId})
MATCH p = (impacted)-[:DEPENDS_ON *1..10]->(target)
WHERE impacted.id <> $nodeId
  AND impacted.projectId = $projectId
WITH impacted, min(size(p)) AS hopCount
RETURN impacted.id   AS id,
       impacted.type AS type,
       impacted.name AS name,
       impacted.path AS path,
       hopCount
ORDER BY hopCount, id
```

Direction note: edges are mirrored as `(from)-[:DEPENDS_ON]->(to)`, meaning
"from depends on to". To answer "who depends on `nodeId`" we walk the
relationship backwards from the target — hence the reverse pattern.

Buckets:
- `hopCount == 1` → `direct`
- `hopCount == 2` → `indirect`
- `hopCount >= 3` → `remote` (depth cap 10, same as Postgres path)

Self-loops excluded by `impacted.id <> $nodeId`. Min-hop aggregation
guarantees each impacted node lands in exactly one bucket.

Reserved-word note: `hops` is reserved in Memgraph's openCypher grammar
and cannot be used as a column alias. We alias as `hopCount` and rename
in TypeScript before bucketing.

## Fallback semantics

Any throw from `GraphDbClient.run()` (network, parse, timeout) is caught
inside `GraphService.getImpactFromMemgraph` and the call transparently
re-issues against Postgres. A `warn`-level log line is emitted with the
shape:

```json
{
  "op": "getImpact",
  "source": "memgraph",
  "taskId": "<nodeId>",
  "projectId": "<projectId>",
  "error": "<message>"
}
```

`refreshImpact()` (the Postgres-only pre-compute) is intentionally
preserved — it still feeds the `impact_analyses` table consumed by the
fallback path.

## Test coverage

- Unit (`apps/core-api/src/modules/codeflow/graph.service.spec.ts`)
  - `buildImpactCypher` shape: direction, depth limit, self-loop guard,
    project scoping, min-hop aggregation.
  - Flag ON routes through Memgraph, classifies hops 1/2/3+.
  - Memgraph error → Postgres fallback (no exception bubbles up).
  - Flag OFF stays on Postgres (regression guard).

- Integration (`apps/core-api/test/impact-parity.spec.ts`)
  - Seeds the same 5-node DAG into Postgres and Memgraph via the
    production `GraphSyncService`, then asserts identical
    `direct/indirect/remote` set membership between flag OFF and flag ON.
  - Skips silently if Memgraph is unreachable.
