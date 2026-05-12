# ADR-0001 — Deep Code Map: Memgraph Schema for File and Symbol Nodes

**Status**: Accepted  
**Date**: 2026-05-12  
**Author**: Wave 6 Worker (AI)  
**RoadBoard Decision**: `cmobndz6v0015ol013pimkrz3` + new multi-label decision  
**RoadBoard Task**: `cmobns6pg001nol016cxu5mxd`  
**Phase**: Wave 6 — Deep Code Map (`cmobnrw7u001jol01hr0vw1jz`)

---

## Context

Roadboard 2.0 uses Memgraph (Neo4j-compatible) as its graph store for architecture intelligence (CodeFlow). The existing schema defines `:App`, `:Package`, `:Module`, `:Service`, `:Repository`, `:Link`, `:Annotation` labels, plus edge types `DEPENDS_ON`, `IMPORTS`, `IMPACTS`, `LINKED_TO`, `ANNOTATES`, `BELONGS_TO`.

Wave 6 (Deep Code Map) extends the graph with **fine-grained code intelligence**: source files and their symbols (functions, classes, interfaces, types, enums, constants). These entities need to be queryable for:

- Blast-radius analysis (which symbols are affected by changing function X?)
- Call-graph traversal (callers / callees)
- Import graph (transitive dependencies between files)
- Orphan detection (symbols with no incoming references)
- MCP tool responses (list symbols in a file, find definition, etc.)

Decision AI-P0-00 (2026-05-12) established that the Wave Atlas Insight is reduced and Wave 6 absorbs code-intelligence. File and Symbol are **not** stored as separate entity tables — they live in Memgraph as graph nodes.

The sibling task `cmobnsxr5` already added `file` and `symbol` palette entries to the architecture-map canvas (`architecture-map-canvas.tsx`), confirming that these node types must be surfaced through the same architecture pipeline.

---

## Decision

**File and Symbol nodes are stored as multi-label nodes**: `:ArchitectureNode:File` and `:ArchitectureNode:Symbol`.

This means a single Memgraph node simultaneously carries both labels. All existing ArchitectureNode indexes and constraints apply automatically, and the existing pipeline (ingest_architecture, get_architecture_map, canvas rendering) requires zero structural changes to accommodate the new node types.

---

## Rationale

### Why multi-label (`:ArchitectureNode:File`) instead of separate label families?

| Criterion | Multi-label | Separate labels |
|---|---|---|
| Pipeline reuse | Inherits all ArchitectureNode constraints/indexes immediately | Must duplicate or join |
| Canvas rendering | Already handled by palette type discriminator | Requires new query path |
| Cross-type queries | `MATCH (n:ArchitectureNode)` covers all node types in one pattern | Requires UNION or label list |
| Memgraph support | Full multi-label support, properties unrestricted | N/A |
| Migration risk | Zero — additive only | Low but non-zero |
| Future extension | New node type = new secondary label | New label family |

The decisive factor is **pipeline reuse**: the canvas, MCP tools, and RoadBoard architecture queries all operate on `:ArchitectureNode` as the root label. Adding `:File` and `:Symbol` as secondary labels means no changes to existing read paths while enabling precise label-targeted queries (`MATCH (f:File)`) where needed.

---

## Schema Cypher (complete, idempotent)

The following statements are appended to `SCHEMA_CYPHER` in `packages/graph-db/src/schema.ts` and executed by `applyGraphSchema()` on service startup. Memgraph silently ignores duplicate constraint/index creation, making all statements safe to re-run.

```cypher
-- File nodes
CREATE CONSTRAINT ON (n:File) ASSERT n.id IS UNIQUE;
CREATE INDEX ON :File(projectId);
CREATE INDEX ON :File(path);
CREATE INDEX ON :File(language);

-- Symbol nodes
CREATE CONSTRAINT ON (n:Symbol) ASSERT n.id IS UNIQUE;
CREATE INDEX ON :Symbol(projectId);
CREATE INDEX ON :Symbol(fqn);
CREATE INDEX ON :Symbol(fileId);
CREATE INDEX ON :Symbol(kind);

-- ExternalPackage leaf nodes (aggregated external imports)
CREATE CONSTRAINT ON (n:ExternalPackage) ASSERT n.id IS UNIQUE;
CREATE INDEX ON :ExternalPackage(projectId);
CREATE INDEX ON :ExternalPackage(name);
```

### Node property contracts

#### `:ArchitectureNode:File`

| Property | Type | Description |
|---|---|---|
| `id` | `string` | Global unique ID (`<projectId>:<path>`) |
| `projectId` | `string` | Owning RoadBoard project |
| `path` | `string` | Repo-relative path (e.g. `src/modules/tasks/tasks.service.ts`) |
| `language` | `string` | `typescript` \| `javascript` \| `json` \| … |
| `sizeBytes` | `integer` | File size at scan time |
| `sha` | `string` | SHA-256 of file content (used for delta detection) |
| `lastScannedAt` | `datetime` | ISO-8601 timestamp of last successful scan |
| `type` | `string` | Always `"file"` (ArchitectureNode discriminator) |

#### `:ArchitectureNode:Symbol`

| Property | Type | Description |
|---|---|---|
| `id` | `string` | Global unique ID (`<projectId>:<fqn>`) |
| `projectId` | `string` | Owning RoadBoard project |
| `fileId` | `string` | Parent File node id |
| `kind` | `string` | `function` \| `class` \| `interface` \| `type` \| `enum` \| `const` |
| `name` | `string` | Simple symbol name (e.g. `createTask`) |
| `fqn` | `string` | Fully qualified name: `<pkg>:<path>:<lineStart>:<colStart>:<name>` |
| `lineStart` | `integer` | 1-based start line |
| `lineEnd` | `integer` | 1-based end line |
| `colStart` | `integer` | 0-based start column |
| `colEnd` | `integer` | 0-based end column |
| `isExported` | `boolean` | Whether the symbol is exported |
| `type` | `string` | Always `"symbol"` (ArchitectureNode discriminator) |

#### `:ExternalPackage` (leaf aggregation)

External imports (e.g. `import { Injectable } from '@nestjs/common'`) are aggregated into single `:ExternalPackage` nodes — one per package name per project. This avoids explosion of cross-repo `:IMPORTS` edges and keeps the graph queryable.

| Property | Type | Description |
|---|---|---|
| `id` | `string` | `<projectId>:<packageName>` |
| `projectId` | `string` | Owning project |
| `name` | `string` | Package name (e.g. `@nestjs/common`) |
| `version` | `string` | Resolved version from package.json (optional) |

### Edge types (additions)

| Edge | Source → Target | Description |
|---|---|---|
| `:IMPORTS` | `:File` → `:File` | Static import between two source files |
| `:IMPORTS` | `:File` → `:ExternalPackage` | File imports an external package |
| `:CONTAINS` | `:File` → `:Symbol` | File contains symbol (ownership) |
| `:CALLS` | `:Symbol` → `:Symbol` | Symbol calls another symbol |
| `:EXTENDS` | `:Symbol` → `:Symbol` | Class extends another class |
| `:IMPLEMENTS` | `:Symbol` → `:Symbol` | Class implements an interface |
| `:REFERENCES_TYPE` | `:Symbol` → `:Symbol` | Symbol references a type/interface |

Note: `:IMPORTS` edge type already exists in `EDGE_TYPES` for the architecture layer — the deep-scan scanner reuses the same edge type with additional properties (`timestamp`, `importKind: 'static' | 'dynamic'`).

### FQN disambiguation

Symbol FQN format: `<pkg>:<repo-relative-path>:<lineStart>:<colStart>:<name>`

Example: `@roadboard/core-api:src/modules/tasks/tasks.service.ts:42:2:createTask`

This ensures that two symbols with the same name in the same file at different positions are always distinct nodes. For renamed symbols (refactoring), the old node is replaced on rescan using `sha` delta detection.

---

## Query Examples

### 1. Blast-radius from a Symbol (reverse-BFS via CALLS + REFERENCES_TYPE)

```cypher
MATCH path = (caller:Symbol)-[:CALLS|REFERENCES_TYPE*1..5]->(target:Symbol {fqn: $fqn})
RETURN DISTINCT caller.fqn AS affectedSymbol, caller.fileId AS inFile, length(path) AS depth
ORDER BY depth ASC
LIMIT 100;
```

### 2. Callers of a function

```cypher
MATCH (caller:Symbol)-[:CALLS]->(target:Symbol {fqn: $fqn})
RETURN caller.fqn AS caller, caller.fileId AS inFile;
```

### 3. Callees of a function

```cypher
MATCH (target:Symbol {fqn: $fqn})-[:CALLS]->(callee:Symbol)
RETURN callee.fqn AS callee, callee.fileId AS inFile;
```

### 4. Import graph of a file (BFS via IMPORTS)

```cypher
MATCH path = (root:File {path: $path, projectId: $projectId})-[:IMPORTS*1..10]->(dep)
RETURN DISTINCT dep.path AS dependency, dep.language AS lang, labels(dep) AS kind
ORDER BY length(path) ASC;
```

### 5. Orphan symbols (no incoming edges)

```cypher
MATCH (s:Symbol {projectId: $projectId})
WHERE NOT ()-[:CALLS|REFERENCES_TYPE|CONTAINS]->(s)
  AND s.isExported = false
RETURN s.fqn AS orphan, s.kind AS kind, s.fileId AS inFile;
```

### 6. All symbols exported by a file

```cypher
MATCH (f:File {path: $path, projectId: $projectId})-[:CONTAINS]->(s:Symbol)
WHERE s.isExported = true
RETURN s.name AS name, s.kind AS kind, s.fqn AS fqn;
```

### 7. Files that directly import a given module

```cypher
MATCH (importer:File)-[:IMPORTS]->(target:File {path: $path, projectId: $projectId})
RETURN importer.path AS importerFile;
```

---

## Alternatives Considered

### A. Separate label families (`:File` and `:Symbol` as standalone, no `:ArchitectureNode`)

Pros: cleaner schema, no coupling to architecture layer conventions.  
Cons: requires duplicating or bridging all read queries; canvas palette already expects `type` discriminator on `:ArchitectureNode`; MCP `get_architecture_map` would miss File/Symbol nodes.  
**Rejected**: the pipeline coupling benefit of multi-label outweighs the schema cleanliness argument.

### B. Store files and symbols in PostgreSQL only (no graph)

Pros: simpler infra, familiar query language.  
Cons: graph traversal queries (blast-radius, BFS import graph) are O(N) in relational joins vs O(depth) in graph traversal; recursive CTEs are fragile at scale.  
**Rejected**: Memgraph is already deployed and specifically chosen for graph traversal workloads.

### C. One `:ExternalPackage` node per import site (non-aggregated)

Pros: precise tracking of which symbol is imported.  
Cons: explosion of nodes for large codebases (e.g. thousands of `import { Injectable }` edges to `@nestjs/common`); query performance degrades.  
**Rejected**: aggregated leaf node per package per project is sufficient for the MVP blast-radius use case.

---

## Consequences

### Positive
- Zero migration required: additive schema changes only.
- Existing canvas, MCP tools, and architecture queries continue working unchanged.
- Multi-label queries (`MATCH (n:ArchitectureNode)`) cover File and Symbol automatically.
- FQN-based identity enables deterministic delta scanning (rescan = MERGE on fqn).

### Negative / Watch
- Memgraph multi-label nodes share property namespace — `id`, `projectId`, `type` must be consistent across all `:ArchitectureNode` subtypes.
- The `type` discriminator string (`"file"`, `"symbol"`) must be kept in sync with the canvas palette type values defined in `architecture-map-canvas.tsx`.
- `:IMPORTS` edge type is reused from the architecture layer — the scanner must not overwrite architecture-level IMPORTS edges (different `projectId` scope ensures isolation).

### Open questions
- Tree-sitter parser for non-TypeScript languages (follow-up wave, out of scope here).
- Edge indexes on `:CALLS(timestamp)` — deferred until query profiling shows need.
- Symbol-level permission scoping (private vs exported visibility in MCP responses) — deferred to Wave 7.
