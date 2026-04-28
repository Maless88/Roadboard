# Roadboard Repository Analysis Report

> Analysis-only document. No code, schema, or migrations are produced or modified by this report.
> Target: assessing feasibility of integrating a SocratiCode-like local codebase intelligence engine
> with Roadboard's existing **Atlas** feature graph.

---

## 1. Executive Summary

**Verdict: Partially feasible — high-confidence MVP, recommended as a phased extension rather than a refactor.**

Roadboard already ships a structured, persistent, project-scoped graph of code-shaped entities
(apps, packages, modules, services, files) with a typed link layer (`ArchitectureLink`) that connects
graph nodes to Roadboard entities (tasks, decisions, milestones, memory entries). The data model,
the REST surface (`/projects/:id/codeflow/graph/...`), the React Flow canvas (`architecture-map-canvas.tsx`),
the node detail drawer (`node-drawer.tsx`) and the dual-store sync pipeline (Postgres + Memgraph
via `graph-sync.service.ts` + outbox + `drift.service.ts`) are all in place.

What is **missing** for a SocratiCode-style integration is not the graph but a **technical-context
adapter layer** that:

1. resolves richer code artifacts (symbols, endpoints, components, tests, commits) below the current
   `file` granularity;
2. produces *suggested* links via semantic search rather than only manual ones;
3. introduces confidence + provenance metadata on links;
4. talks to an external MCP server (SocratiCode) without coupling Roadboard to a single vendor.

None of the above requires a database rewrite. The existing `ArchitectureNode.metadata Json`,
`ArchitectureLink.linkType`, and the freedom of `entityType` (currently constrained to
`task | decision | milestone | memory_entry`) provide the extension points. A backend adapter
service in `apps/core-api` (or a new `apps/code-context-bridge`) calling SocratiCode over MCP
(stdio or HTTP) is the natural insertion point — Roadboard already runs an MCP server
(`apps/mcp-service`), so MCP transport is a known pattern in the repo.

**Recommendation:** defer until current Atlas-related work stabilises (drift detection,
graph-sync outbox, recent CodeFlow tasks landed in `feat(codeflow): CF-GDB-03c`), then build
a thin `FeatureLinker` adapter as Phase 1, with manual linking of feature nodes to code
artifacts. Add SocratiCode as a pluggable suggestion provider in Phase 3, gated behind a
project-level setting. Do **not** start a parallel graph store; reuse Memgraph + Postgres.

---

## 2. Current Architecture

Information below was derived by inspecting the repo in this session — concrete file paths
and symbols are cited inline.

### 2.1 Frontend
- **Framework:** Next.js 15 (App Router) — see [apps/web-app/src/app/](../../apps/web-app/src/app/).
- **Atlas pages:** [apps/web-app/src/app/projects/[id]/codeflow/](../../apps/web-app/src/app/projects/%5Bid%5D/codeflow/)
  - [architecture-map-view.tsx](../../apps/web-app/src/app/projects/%5Bid%5D/codeflow/architecture-map-view.tsx) — server component, fetches via `getArchitectureGraph(token, projectId)`.
  - [architecture-map-canvas.tsx](../../apps/web-app/src/app/projects/%5Bid%5D/codeflow/architecture-map-canvas.tsx) — client component, **React Flow (`@xyflow/react`)** + **`dagre`** for layout.
  - [node-drawer.tsx](../../apps/web-app/src/app/projects/%5Bid%5D/codeflow/node-drawer.tsx) — right-side drawer, tabs `info | decisions | tasks | memory | links`, with a `CreateLinkForm` already wired to `createNodeLinkAction` / `deleteNodeLinkAction`.
  - [sub-nav.tsx](../../apps/web-app/src/app/projects/%5Bid%5D/codeflow/sub-nav.tsx), [placeholder-views.tsx](../../apps/web-app/src/app/projects/%5Bid%5D/codeflow/placeholder-views.tsx) — sub-navigation; presence of placeholder views suggests the Atlas tab is intended to host more than just the map.
- **i18n:** dictionary under `apps/web-app/src/lib/i18n/` exposes `dict.codeflow.*` and labels the tab as "Atlas" (`codeflow: 'Atlas'`).
- **Frontend → backend bridge:** [apps/web-app/src/app/api/codeflow/nodes/[nodeId]/route.ts](../../apps/web-app/src/app/api/codeflow/nodes/%5BnodeId%5D/route.ts) proxies node detail fetches; server actions live in [codeflow/actions.ts](../../apps/web-app/src/app/projects/%5Bid%5D/codeflow/actions.ts).

### 2.2 Backend
- **Framework:** NestJS + Fastify (port 3001). See [apps/core-api/src/modules/](../../apps/core-api/src/modules/).
- **Atlas (CodeFlow) module:** [apps/core-api/src/modules/codeflow/](../../apps/core-api/src/modules/codeflow/)
  - `codeflow.service.ts` — repositories CRUD (apps/core-api/src/modules/codeflow/codeflow.service.ts:18–121).
  - `graph.controller.ts` — REST controller mounted on `projects/:projectId/codeflow/graph` exposing `getGraph`, `resetProject`, `entity-links`, `snapshot`, `outbox-stats`, `drift`, `nodes/*`, `edges/*`, `links/*` (apps/core-api/src/modules/codeflow/graph.controller.ts:17–197).
  - `graph.service.ts` — orchestrates Postgres writes and emits outbox events.
  - `graph-sync.service.ts` + tests — replicates Postgres mutations to Memgraph asynchronously.
  - `drift.service.ts` — Postgres ↔ Memgraph reconciliation (recent commit `7a396ad: feat(codeflow): CF-GDB-03c mini-PR B+C — drift endpoint + hourly systemd timer`).
- **MCP server:** [apps/mcp-service/](../../apps/mcp-service/) — stdio + StreamableHTTP transport (port 3005). 31 tools, including `ingest_architecture`, `get_architecture_map`, `get_node_context`, `link_task_to_node`. Calls back into core-api via [core-api.client.ts](../../apps/mcp-service/src/clients/core-api.client.ts).
- **Other apps:** `auth-access` (3002), `worker-jobs` (3003, BullMQ), `local-sync-bridge` (3004, SQLite).

### 2.3 Routing & API
- **External REST:** versioned per project — `GET /projects/:projectId/codeflow/graph` returns `{ nodes, edges, snapshotStatus, lastScannedAt }`.
- **AuthZ:** `AuthGuard` + `GrantCheckGuard` with `@RequireGrant(GrantType.CODEFLOW_READ|CODEFLOW_WRITE)` decorators.
- **MCP layer:** `apps/mcp-service` is *itself* a REST/MCP-out adapter to core-api, so the pattern of "Roadboard talking MCP" is bidirectional-friendly.

### 2.4 Persistence / Data Model (Atlas-relevant tables)
From [packages/database/prisma/schema.prisma](../../packages/database/prisma/schema.prisma):

| Model                    | Lines  | Purpose                                                                 |
|--------------------------|--------|-------------------------------------------------------------------------|
| `CodeRepository`         | ~270–286 | Repo metadata, owns snapshots & nodes.                                 |
| `ArchitectureSnapshot`   | 288–310 | Versioned scan: `commitHash`, `status`, `nodeCount`, `edgeCount`, etc. |
| `ArchitectureNode`       | 312–343 | `type`, `name`, `path`, `description`, `domainGroup`, `metadata Json`. |
| `ArchitectureEdge`       | 345–366 | `fromNodeId`/`toNodeId`/`edgeType`/`weight`/`metadata Json`.           |
| `ArchitectureAnnotation` | 368–381 | Free-form notes per node by user.                                      |
| `ArchitectureLink`       | 383–399 | **Bridge to RB entities**: `entityType`, `entityId`, `linkType`.       |
| `ImpactAnalysis`         | 401–417 | Pre-computed direct/indirect/remote node impact per snapshot.          |
| `GraphSyncEvent`         | 419–437 | Outbox for async Memgraph sync (status, attempts, lastError).          |

### 2.5 Graph Storage
- **Primary:** PostgreSQL via Prisma (source of truth).
- **Secondary:** Memgraph (Neo4j-compatible, Cypher) via [packages/graph-db/](../../packages/graph-db/) — schema in [packages/graph-db/src/schema.ts](../../packages/graph-db/src/schema.ts).
  - Labels: `App | Package | Module | Service | Repository | Link | Annotation`.
  - Edge types: `DEPENDS_ON | IMPORTS | IMPACTS | LINKED_TO | ANNOTATES | BELONGS_TO`.
- Sync model: outbox events in Postgres → Memgraph; reconciler (`drift.service.ts`) runs hourly via systemd timer.

### 2.6 Graph Rendering Approach
React Flow + dagre — see [architecture-map-canvas.tsx](../../apps/web-app/src/app/projects/%5Bid%5D/codeflow/architecture-map-canvas.tsx) lines 1–80 (TYPE_COLORS_DARK/LIGHT, hierarchy builder). Already supports node types `app | package | module | service | file | symbol` in the palette, even though the backend `CreateNodeDto` (apps/core-api/src/modules/codeflow/dto/create-node.dto.ts) only enumerates `repository | app | package | module | service | file` — i.e. there is a **latent slot for `symbol` already styled** but not yet writeable.

---

## 3. Atlas Current State

### 3.1 What Atlas does today
- Visualises a project's code structure (apps/packages/modules/services/files) on a React Flow canvas.
- Lets users drill into a node to see annotations and **outgoing links** to Roadboard tasks, decisions, milestones and memory entries.
- Allows manual creation of nodes/edges/annotations/links via REST + UI form.
- Auto-populates via `ingest_architecture` (MCP tool) at project onboarding.
- Computes change-impact (`ImpactAnalysis`) per snapshot and exposes `GET nodes/:id/impact`.
- Detects drift between Postgres and Memgraph (drift.service).

### 3.2 Feature representation
- A node is a **typed bag**: `(type, name, path?, description?, domainGroup?, metadata Json)`.
  - `domainGroup` is the closest thing to a "product feature" tag — it can be used today to cluster nodes by feature, but there is no UI surfacing it as a first-class facet.
- Relations are stored both relationally (`ArchitectureEdge`) and in Memgraph; edge types are coarse (`DEPENDS_ON`, `IMPORTS`, etc.).
- `ArchitectureLink` is the "Atlas ↔ Roadboard entity" bridge (NOT "Atlas ↔ code artifact"): `entityType ∈ {task, decision, milestone, memory_entry}` (apps/core-api/src/modules/codeflow/dto/create-link.dto.ts:4).

### 3.3 Where Atlas data lives
- Postgres (Prisma) as source of truth, asynchronously mirrored to Memgraph for graph traversal queries.

### 3.4 Limitations / Gaps relative to the requested integration
1. **Granularity stops at `file`.** No symbol-, endpoint-, route-, component-, or test-level nodes (despite the canvas already styling `symbol`).
2. **No "feature" node type.** Feature semantics today are implicit via `domainGroup`. The user clarified Atlas is *meant* to be a feature graph; the implementation is currently more of an *architecture* graph.
3. **No code-artifact link table.** `ArchitectureLink` connects nodes to RB entities only. There is no place to record "feature node X is implemented by file Y / endpoint Z / commit C".
4. **No semantic search / vector index.** No embeddings. `metadata Json` could host them but the system has no producer or consumer.
5. **No confidence / provenance on links.** Manual is binary (`isManual` exists on nodes/edges, not on links). No `source` field.
6. **No staleness signal on links.** Nothing tracks whether a linked file still exists at HEAD.
7. **Ingestion is one-shot.** `ingest_architecture` is replace-existing; no incremental code-artifact updates.
8. **Sync coupling.** The node-drawer reads via a Next.js API route + server actions; introducing async suggestions will need a non-blocking UX path.

---

## 4. SocratiCode-like Integration Hypothesis

Assuming a SocratiCode MCP server exposes `codebase_search`, `codebase_context`, `codebase_graph_query`,
`codebase_status`, `codebase_list_projects`, the natural mapping is:

| SocratiCode tool       | Roadboard usage                                                                                                     |
|------------------------|---------------------------------------------------------------------------------------------------------------------|
| `codebase_list_projects` | Map a Roadboard `Project` ↔ a SocratiCode "project" via `CodeRepository.metadata.socraticodeProjectId`.            |
| `codebase_status`      | Show "indexed at commit X / Y files / health" in the Atlas header alongside `lastScannedAt`.                        |
| `codebase_search`      | "Suggest code links" on a feature node: take node `name`/`description`/`domainGroup` → query → return ranked artifacts. |
| `codebase_context`     | Hydrate the right-drawer "Linked code artifacts" tab with file/symbol snippets, used in `prepare_task_context` too. |
| `codebase_graph_query` | Feed the Atlas dependency overlay (`dependents`, `callers`, `affected tests`) when a feature is linked.             |

These are read-only and idempotent — natural fit for an HTTP/MCP adapter call from the Nest backend.

---

## 5. Proposed Conceptual Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│ Roadboard Web UI (Next.js)                                          │
│   • Atlas canvas (React Flow)                                        │
│   • Node drawer  →  new "Code Artifacts" tab                         │
│   • "Suggest links" / "Analyze impact" actions                       │
└────────────────┬─────────────────────────────────────────────────────┘
                 │ Server actions / /api/codeflow proxy
┌────────────────▼─────────────────────────────────────────────────────┐
│ Roadboard Core API (NestJS, port 3001)                               │
│   • Existing CodeflowModule (graph CRUD, links)                      │
│   • NEW FeatureLinker / CodeContextAdapter                           │
│        - resolves SocratiCode tool calls                             │
│        - persists confidence + provenance on links                   │
│        - cache layer (Redis or in-process)                           │
└────────────────┬─────────────────────────────────────────────────────┘
                 │ MCP (stdio / StreamableHTTP)  OR  REST
┌────────────────▼─────────────────────────────────────────────────────┐
│ SocratiCode MCP Server (external, local-first)                       │
│   • indexes the user's checked-out repo                              │
│   • exposes codebase_search / codebase_context / ...                 │
└────────────────┬─────────────────────────────────────────────────────┘
                 │ reads
                 ▼
       Local code + Vector DB + Dependency Graph
```

**Layer responsibilities:**

- **Web UI:** rendering, manual linking workflow, asynchronous suggestion UX (loading states + accept/reject).
- **Core API → CodeContextAdapter:** request shaping, project↔SocratiCode mapping, retry/timeout, **persistence of accepted suggestions as `ArchitectureLink` rows or in a new `feature_code_links` table**, RBAC enforcement (reuse `CODEFLOW_*` grants).
- **SocratiCode MCP:** purely read; never writes back to Roadboard.
- **Vector DB / dep graph:** owned by SocratiCode; Roadboard never touches it directly.

This keeps a strict one-way dependency Roadboard → SocratiCode, mirroring the existing
`apps/mcp-service` → `core-api` topology. Roadboard remains usable without SocratiCode running.

---

## 6. FeatureLinker Design

A `FeatureLinker` (Nest service in `apps/core-api/src/modules/codeflow/feature-linker.service.ts`,
**proposed, not created here**) bridges feature-typed Atlas nodes to code artifacts.

### 6.1 Capabilities (MVP → full)
1. **Manual link feature → file/symbol/endpoint** (Phase 2). Reuses `ArchitectureLink` shape but with new `entityType`s (see §7).
2. **Suggested links from semantic search** (Phase 3). Calls `codebase_search` with `node.name + node.description + node.domainGroup`; returns top-K with score; user confirms.
3. **Endpoint detection** (Phase 3). `codebase_search` filtered by patterns (e.g. `@Controller`, Next.js `route.ts`, `app/api/**`).
4. **Component detection** (Phase 3). React component files surfaced via `codebase_search`.
5. **Backend module detection** (Phase 3). Mapping to existing `Module` Atlas nodes when a SocratiCode hit lands inside a known module path.
6. **Dependency impact analysis** (Phase 4). `codebase_graph_query` for callers/callees, merged with existing `ImpactAnalysis`.
7. **Confidence score** (Phase 3+). Persist score + `source ∈ {manual, inferred, mcp}` (see §7).
8. **Review/confirmation workflow** (Phase 3). UI: pending suggestions appear as ghost links awaiting accept/reject; rejected ones are remembered to suppress repeat suggestions.

### 6.2 API surface (sketch)
- `POST /projects/:id/codeflow/feature-linker/suggestions { nodeId }` → returns suggestion list (no persistence).
- `POST /projects/:id/codeflow/feature-linker/links` → accept a suggestion (creates link).
- `GET  /projects/:id/codeflow/feature-linker/health` → SocratiCode `codebase_status` proxy.

### 6.3 Resilience
- All SocratiCode calls behind a circuit breaker; default timeout 5s; degraded UI shows a banner ("code suggestions unavailable") and falls back to manual linking.

---

## 7. Required Data Model Changes

The current `ArchitectureLink` is engineered for `entityType ∈ {task,decision,milestone,memory_entry}` — a closed set
of internal Roadboard entities. Reusing it for code artifacts is possible but mixes two concerns
(RB-entity links vs. code-artifact links). Two viable paths:

### 7.1 Option A — extend `ArchitectureLink` (lower cost)
- Add `'file' | 'symbol' | 'endpoint' | 'component' | 'test' | 'commit' | 'pr'` to `entityType` enum (validator only — no DB migration since `entityType` is a string).
- Add columns:
  - `confidence Float?` (0..1, null for manual)
  - `source String?` (`manual | inferred | mcp`)
  - `lastVerifiedAt DateTime?`
  - extend `metadata Json` for `{repoRef, sha, lineRange, symbolPath}`.
- **Pro:** one model, one drawer flow.
- **Con:** mixes lifecycle: a `task` link is permanent, a `file` link can rot.

### 7.2 Option B — new model `feature_code_links` (cleaner)
```prisma
model FeatureCodeLink {
  id             String   @id @default(cuid())
  projectId      String   @map("project_id")
  nodeId         String   @map("node_id")
  artifactType   String   @map("artifact_type")    // file | symbol | endpoint | component | test | commit | pr
  artifactPath   String   @map("artifact_path")
  artifactSymbol String?  @map("artifact_symbol")
  repoRef        String?  @map("repo_ref")          // commit sha or branch
  lineStart      Int?     @map("line_start")
  lineEnd        Int?     @map("line_end")
  confidence     Float?
  source         String   // manual | inferred | mcp
  status         String   @default("active")        // active | stale | dismissed
  lastVerifiedAt DateTime? @map("last_verified_at")
  createdByUserId String?  @map("created_by_user_id")
  createdAt      DateTime @default(now()) @map("created_at")

  node ArchitectureNode @relation(fields: [nodeId], references: [id], onDelete: Cascade)

  @@index([projectId, nodeId])
  @@index([projectId, artifactType, artifactPath])
  @@map("feature_code_links")
}
```
- **Pro:** clean separation, room for verification job, dismissal history.
- **Con:** new migration, new Memgraph label/edge (`:CodeArtifact` + `LINKED_CODE`).

### 7.3 Recommendation
**Option B**, because confidence/staleness/dismissal semantics are foreign to the existing
`ArchitectureLink` and trying to retrofit them risks polluting the existing task/decision link
flows that already work in production.

Also propose:
- New optional column `featureSlug String?` on `ArchitectureNode` (nullable, indexed) to canonicalise feature identity across snapshots.
- New `node.type = 'feature'` allowed value (validator-only change in `CreateNodeDto`).

---

## 8. UI/UX Proposal

### 8.1 Where it lives
The Atlas tab is the only sensible host. Specifically:

- **Node drawer (`node-drawer.tsx`)** gains a new tab: `code` (between `info` and `decisions`).
  - Renders accepted `FeatureCodeLink`s grouped by `artifactType`.
  - Each row: monospace path, optional symbol, confidence badge, source pill (`mcp/manual/inferred`), `lastVerifiedAt`, "open in IDE" affordance.
  - Empty state CTA: **"Suggest code links"** button → triggers FeatureLinker, shows skeletons, then a list of pending suggestions with accept (✓) / reject (✗).
- **Architecture canvas overlay:** new toggle "Show technical dependencies" — when on, overlays edges from `codebase_graph_query` (e.g. `endpoint → service`, `component → hook`). Read-only, dashed style to distinguish from native edges.
- **Atlas header:** SocratiCode `codebase_status` line (last index, file count, indexer health).

### 8.2 Visual cues
- **Confidence badges:** `≥ 0.85` green, `0.6–0.85` amber, `< 0.6` grey + "low confidence" tooltip.
- **Stale link warning:** red dot + tooltip "file no longer exists at HEAD (last seen 2026-04-12)".
- **Source badge:** `manual` (white), `mcp` (indigo), `inferred` (teal) — consistent with existing entity-type badges in `ENTITY_COLOR` map (node-drawer.tsx:18).

### 8.3 Actions
- **"Analyze impact"** button on a feature node: combines existing `ImpactAnalysis` (Atlas-internal) with SocratiCode `codebase_graph_query` to return downstream affected files and tests.
- **"Re-verify links"** (admin): triggers a worker job to check all `lastVerifiedAt` older than N days.

---

## 9. MCP Integration Strategy

### 9.1 Calling MCP from Roadboard
Roadboard has not yet acted as an *MCP client*; it only ships an MCP server (`apps/mcp-service`).
The dependency `@modelcontextprotocol/sdk` is already in the monorepo (used in the server),
so the same SDK can be reused on the client side without adding a new top-level dependency.

Two transports are realistic:
- **stdio** — desktop scenarios where SocratiCode runs as a child process spawned by core-api.
  Risky in containerised deployments.
- **StreamableHTTP** — preferred. SocratiCode runs as a sidecar service; core-api speaks HTTP.
  Mirrors how `apps/mcp-service` already exposes itself on port 3005.

### 9.2 Where it lives
A new Nest module `CodeContextModule` in `apps/core-api/src/modules/code-context/` owning:
- `CodeContextClient` (thin MCP-over-HTTP wrapper).
- `FeatureLinkerService` (business logic, persistence).
- `FeatureLinkerController` (REST endpoints under `projects/:id/codeflow/feature-linker/*`).

Configuration in env: `SOCRATICODE_URL`, `SOCRATICODE_TOKEN`, `SOCRATICODE_TIMEOUT_MS`.

### 9.3 Sync vs async
- **Suggestions:** synchronous request/response, ≤5s; UI shows skeleton.
- **Bulk re-verification / re-index:** asynchronous via existing `worker-jobs` (BullMQ on port 3003); enqueue, return 202.

### 9.4 Errors / timeouts
- 5s timeout, single retry on `ETIMEDOUT`/`ECONNRESET`, then 503-equivalent return.
- Failures must NOT block the Atlas page render — UI degrades to manual-only.
- Circuit breaker on the adapter, opens after 5 consecutive failures, half-open after 30s.
- All adapter errors logged via `@roadboard/observability` to keep SLO visibility.

---

## 10. Implementation Phases

> Files cited are *expected* touch points for each phase, derived from current repo layout — not authoritative.

### Phase 0 — Prerequisites already in flight
- **Goal:** finish the in-progress CodeFlow consolidation before adding a new layer on top.
- **Tasks:**
  - Stabilise drift detection (recent: commit `7a396ad: feat(codeflow): CF-GDB-03c mini-PR B+C — drift endpoint + hourly systemd timer`).
  - Verify outbox/sync resilience (`graph-sync.service.spec.ts`).
  - Confirm impact analysis scaling (`ImpactAnalysis` precomputation).
- **Files:** `apps/core-api/src/modules/codeflow/{graph-sync.service.ts, drift.service.ts}`.
- **Risk:** low. Acceptance: zero drift events for 7 consecutive days on all active projects.

### Phase 1 — Read-only code artifact linking foundation
- **Goal:** ship the `feature` node type and a placeholder `FeatureCodeLink` model with manual-only entry.
- **Tasks:**
  - Add `'feature'` to `NODE_TYPES` in `CreateNodeDto`.
  - Migrate `feature_code_links` table (Option B from §7).
  - Surface a "Code" tab in `node-drawer.tsx` reading-only.
- **Files:**
  - `packages/database/prisma/schema.prisma`
  - `apps/core-api/src/modules/codeflow/dto/create-node.dto.ts`
  - `apps/core-api/src/modules/codeflow/graph.service.ts`
  - `apps/web-app/src/app/projects/[id]/codeflow/node-drawer.tsx`
- **Risk:** low. **Complexity:** S. **Acceptance:** can create a feature node and read its (empty) code-links section.

### Phase 2 — Manual feature ↔ code linking
- **Goal:** users link feature nodes to files/symbols by hand.
- **Tasks:**
  - REST: `POST/DELETE /projects/:id/codeflow/feature-linker/links`.
  - UI: form with file path autocomplete (using a static repo file listing as first iteration).
  - Server action wiring in `apps/web-app/src/app/projects/[id]/codeflow/actions.ts`.
- **Risk:** low–medium (path validation only). **Complexity:** M. **Acceptance:** create + delete a manual link round-trip; persisted with `source='manual'`.

### Phase 3 — SocratiCode semantic suggestions
- **Goal:** suggest links from `codebase_search`.
- **Tasks:**
  - Add `CodeContextModule` (§9.2).
  - Add `@modelcontextprotocol/sdk` client usage in core-api (already in monorepo deps).
  - Project↔SocratiCode mapping: extend `CodeRepository.metadata` with `socraticodeProjectId`.
  - UI: "Suggest code links" + accept/reject flow.
- **Risk:** medium (external dependency, latency). **Complexity:** L. **Acceptance:** for a feature node with a populated description, top-5 suggestions return in ≤2s p95; accepted ones persist with `source='mcp'` + `confidence`.

### Phase 4 — Dependency / impact analysis
- **Goal:** combine native `ImpactAnalysis` with `codebase_graph_query`.
- **Tasks:**
  - Endpoint: `GET /projects/:id/codeflow/feature-linker/impact?nodeId=...`.
  - Aggregate Memgraph traversal + SocratiCode callers.
- **Risk:** medium (semantic alignment between two graphs). **Complexity:** L. **Acceptance:** an impact view lists files affected by a feature change with provenance per item.

### Phase 5 — Atlas technical overlay
- **Goal:** render code-artifact edges on the React Flow canvas.
- **Tasks:**
  - Toggle in canvas header.
  - Compute overlay edges client-side from a backend endpoint.
- **Files:** `architecture-map-canvas.tsx`.
- **Risk:** medium (perf at large graphs). **Complexity:** M. **Acceptance:** overlay toggles cleanly on a 200-node project without dropping FPS below 30.

### Phase 6 — Automation & verification
- **Goal:** auto-suggest links on feature creation; re-verify staleness.
- **Tasks:**
  - Worker job in `apps/worker-jobs` for periodic verification (file existence at HEAD).
  - Optional: webhook from CI to re-index on merge.
- **Risk:** medium (job throughput). **Complexity:** L. **Acceptance:** stale links flagged within 24h of file deletion; new feature nodes get a non-blocking "review suggestions" toast within 1 minute.

---

## 11. Blockers and Open Questions

1. **What does "feature" mean operationally?** The user's clarification reframes Atlas as a feature graph, but the implementation today is an architecture graph. We need an explicit definition (size, lifetime, naming convention) before introducing `node.type='feature'` lest it collide with `domainGroup`.
2. **Is SocratiCode multi-project aware?** If a single instance must serve N Roadboard projects, we need a stable project-id mapping.
3. **Auth model.** Will SocratiCode be reachable only on the host that runs core-api, or remotely? Token auth needed in either case.
4. **Index lifecycle.** Who triggers re-index? Roadboard, the user, the CI? Drives Phase 6.
5. **Conflict with `ArchitectureLink`.** Decide §7 Option A vs B — recommended B.
6. **Memgraph vs vector DB.** Should code-artifact embeddings live in SocratiCode only, or also be cached in `ArchitectureLink.metadata`? Cache invalidation cost is non-trivial.
7. **License / data residency** of SocratiCode vs Roadboard self-host expectations.
8. **Path canonicalisation.** Monorepo vs multi-repo: `artifact_path` must encode repo identity.

---

## 12. Final Recommendation

**Implement only a reduced MVP, in two staged deliveries, starting *after* Phase 0 stabilises.**

- **Stage 1 (Phases 1–2, ~1 sprint):** ship feature nodes + manual code links. This alone is a valuable, low-risk product step and decouples the data-model decision from any external dependency. It also lets the team validate the UX of a code tab in the node drawer.
- **Stage 2 (Phase 3, ~1 sprint):** introduce SocratiCode behind a feature flag at project level. Treat it as an *optional* semantic layer, not a runtime dependency.

**Do not** attempt Phases 4–6 until Stage 2 has run on real projects for ≥2 weeks; the value of impact-analysis fusion and overlays depends on the quality of the initial linking, which only field data can tell us.

**Reject** any approach that ingests the user's repo into Roadboard's own vector DB — duplicates SocratiCode's responsibility and re-introduces the dual-store maintenance pain Roadboard already has with Postgres↔Memgraph.

---

# Proposed Backlog (Roadboard-ready)

> Ordered by dependency. Copy each item into Roadboard via `create_task` after assigning to a phase
> (suggested phase: **"Atlas × CodeContext (SocratiCode)"** under the Roadboard project).

### Epic: Atlas Code-Context Integration
Phase: Atlas × CodeContext

---

#### T-01 — Define operational semantics of `feature` Atlas node
- **Description:** Specify what counts as a feature node (granularity, naming, ownership), how it relates to existing `domainGroup`, and when to use one vs the other. Output: short ADR.
- **Dependencies:** —
- **Acceptance:** ADR merged in `docs/design/`; reviewed by product + engineering.
- **Priority:** high. **Complexity:** S.

#### T-02 — Stabilise CodeFlow Postgres↔Memgraph drift (Phase 0)
- **Description:** Run drift endpoint daily for 7 days; investigate and fix any reported divergence.
- **Dependencies:** —
- **Acceptance:** zero drift events for 7 consecutive days on all active projects.
- **Priority:** high. **Complexity:** M.

#### T-03 — Schema: add `feature` node type + `feature_code_links` table
- **Description:** Prisma migration adding `feature_code_links` (per §7.2) and validator update for `node.type`. Include Memgraph label `:CodeArtifact` and edge `LINKED_CODE`.
- **Dependencies:** T-01.
- **Acceptance:** migration green in CI, pgsql + Memgraph schema applied; existing tests pass.
- **Priority:** high. **Complexity:** M.

#### T-04 — REST + service: `FeatureCodeLinks` CRUD
- **Description:** `apps/core-api/src/modules/codeflow/feature-code-links.{controller,service}.ts` with manual `source` only. RBAC under `CODEFLOW_WRITE`.
- **Dependencies:** T-03.
- **Acceptance:** create/read/delete via REST; outbox events emitted; covered by spec.
- **Priority:** high. **Complexity:** M.

#### T-05 — UI: "Code" tab in node-drawer (read-only)
- **Description:** Add `code` tab to `node-drawer.tsx`, render grouped by `artifactType`, source/confidence badges, stale dot.
- **Dependencies:** T-04.
- **Acceptance:** tab appears for `feature` nodes; renders empty state and populated state; e2e test on Playwright.
- **Priority:** high. **Complexity:** M.

#### T-06 — UI: manual link creation form
- **Description:** Form on the `code` tab to add a manual link (path + optional symbol + line range). Server action in `actions.ts`.
- **Dependencies:** T-05.
- **Acceptance:** create + delete round-trip; persisted with `source='manual'`.
- **Priority:** medium. **Complexity:** M.

#### T-07 — Spike: SocratiCode MCP transport choice
- **Description:** 1-day timebox. Run `codebase_status` + `codebase_search` from a Nest service against a local SocratiCode instance via stdio and via HTTP. Pick one.
- **Dependencies:** —
- **Acceptance:** ADR documenting decision (recommended: StreamableHTTP).
- **Priority:** medium. **Complexity:** S.

#### T-08 — `CodeContextModule` skeleton + client
- **Description:** New Nest module owning `CodeContextClient` (MCP wrapper), config (`SOCRATICODE_URL`, token, timeout), circuit breaker.
- **Dependencies:** T-07.
- **Acceptance:** `GET /projects/:id/codeflow/feature-linker/health` proxies `codebase_status` with proper error envelope.
- **Priority:** medium. **Complexity:** M.

#### T-09 — `FeatureLinkerService.suggest()`
- **Description:** Build query from node `name + description + domainGroup`, call `codebase_search`, map results to suggestion DTO with `confidence`. No persistence.
- **Dependencies:** T-08.
- **Acceptance:** 5–10 suggestions returned in ≤2s p95 on a 50-feature seed project.
- **Priority:** medium. **Complexity:** L.

#### T-10 — UI: "Suggest code links" + accept/reject
- **Description:** Action button in code tab; pending suggestions with ✓/✗; accepted ones persisted with `source='mcp'`.
- **Dependencies:** T-09, T-06.
- **Acceptance:** Playwright e2e covers happy + reject + adapter-error path.
- **Priority:** medium. **Complexity:** L.

#### T-11 — Project mapping: `CodeRepository.metadata.socraticodeProjectId`
- **Description:** Settings UI for project admins to pin a SocratiCode project id. Until set, suggestions are disabled.
- **Dependencies:** T-08.
- **Acceptance:** validation, audit log on change, gated UI banner when unset.
- **Priority:** medium. **Complexity:** S.

#### T-12 — Stale-link verifier worker
- **Description:** BullMQ job in `apps/worker-jobs` that checks each link's `artifact_path` exists at HEAD; updates `status` and `lastVerifiedAt`.
- **Dependencies:** T-04.
- **Acceptance:** stale links flagged within 24h of file removal in test repo.
- **Priority:** low. **Complexity:** M.

#### T-13 — Impact fusion endpoint
- **Description:** `GET feature-linker/impact?nodeId=...` merges existing `ImpactAnalysis` with `codebase_graph_query`.
- **Dependencies:** T-09.
- **Acceptance:** returns deduplicated affected files/tests with provenance per item.
- **Priority:** low. **Complexity:** L.

#### T-14 — Atlas canvas: technical-dependencies overlay toggle
- **Description:** Toggle in `architecture-map-canvas.tsx`; renders code-artifact edges as dashed.
- **Dependencies:** T-13.
- **Acceptance:** toggle on a 200-node project keeps FPS ≥30.
- **Priority:** low. **Complexity:** M.

#### T-15 — Auto-suggestion on feature creation (background)
- **Description:** On `feature` node create, enqueue a job that pre-computes suggestions and surfaces them as a toast.
- **Dependencies:** T-09.
- **Acceptance:** new feature node receives suggestions within 1 minute on the demo seed project.
- **Priority:** low. **Complexity:** M.

---

*End of report.*
