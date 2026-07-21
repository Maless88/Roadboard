# CodeFlow — Impact read swap (CF-GDB-03b-B)

> **RETIRED (CF-GDB-03b-E)** — the `GRAPH_READ_USE_MEMGRAPH_IMPACT` flag described below
> no longer exists: `getImpact` now routes unconditionally to Memgraph, the Postgres
> graph tables and `GraphSyncService` were removed, and `impact-parity.spec.ts` was
> deleted with them. Historical record of the flag-gated transition step only.

Status: shipped, then superseded — the flag was removed once the cutover completed (see banner).

## What changed (historical — see retirement banner)

`GraphService.getImpact(nodeId, projectId)` now routes through Memgraph
unconditionally via a Cypher reverse-BFS. The section below describes the
now-removed flag-gated transition step, kept for historical record only.

The flag was intentionally per-getter: this was the first migration in the
per-getter cutover plan (CF-GDB-03b-B → C). `getNode`, `getGraph`,
`getSnapshot` remain on Postgres.

## Feature flag (removed)

| Env var                              | Default | Effect                                                     |
|--------------------------------------|---------|------------------------------------------------------------|
| `GRAPH_READ_USE_MEMGRAPH_IMPACT`     | `false` | OFF → Postgres BFS (former behaviour)                      |
|                                      | `true`  | ON  → Memgraph Cypher reverse-BFS, Postgres fallback on err|

This flag no longer exists in the codebase — `getImpact` always uses
Memgraph. The dev-flip commands below are preserved for historical context
only and no longer apply:

```bash
# Inside the core-api container
GRAPH_READ_USE_MEMGRAPH_IMPACT=true docker compose -f infra/docker/docker-compose.yml \
  up -d --no-deps core-api

# Or set it in .env before booting the stack
echo 'GRAPH_READ_USE_MEMGRAPH_IMPACT=true' >> .env
docker compose -f infra/docker/docker-compose.yml up -d --no-deps core-api
```

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

## Fallback semantics (removed)

The Postgres fallback, `refreshImpact()` pre-compute, and the
`impact_analyses` table described below no longer exist. `getImpact` now
routes to Memgraph unconditionally and throws on error rather than falling
back. Preserved for historical record only:

Any throw from `GraphDbClient.run()` (network, parse, timeout) was caught
inside `GraphService.getImpactFromMemgraph` and the call transparently
re-issued against Postgres. A `warn`-level log line was emitted with the
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

`refreshImpact()` (the Postgres-only pre-compute) fed the `impact_analyses`
table consumed by the fallback path.

## Test coverage (historical)

- Unit (`apps/core-api/src/modules/codeflow/graph.service.spec.ts`)
  - `buildImpactCypher` shape: direction, depth limit, self-loop guard,
    project scoping, min-hop aggregation — still accurate.
  - The flag ON/OFF and Postgres-fallback tests described below were removed
    along with the flag; `getImpact` unit tests now cover the unconditional
    Memgraph path only.

- Integration (`apps/core-api/test/impact-parity.spec.ts`) — **removed**,
  deleted along with `GraphSyncService` and the Postgres graph tables.
  Historically it seeded the same 5-node DAG into Postgres and Memgraph via
  the production `GraphSyncService`, then asserted identical
  `direct/indirect/remote` set membership between flag OFF and flag ON.
