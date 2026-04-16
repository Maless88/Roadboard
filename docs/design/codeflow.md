# CodeFlow — Design Document

> **Status**: Proposed — not yet implemented.
> **Target**: Wave 5
> **Author**: Design session 2026-04-15

---

## 1. Feature Framing

### What CodeFlow is inside RoadBoard

CodeFlow is the **fifth operational dimension** of RoadBoard: it sits alongside Projects, Tasks, Decisions, and Memory by bringing the technical-structural dimension of a codebase into the team's operational context.

It is not a code visualization tool. It is a **persistent technical context graph** that connects software components to decisions made, open tasks, milestones, ownership, and historical memory. The graph survives agent context windows, team rotations, and sprint cycles.

### Why it is useful in RoadBoard

RoadBoard already has Projects, Tasks, Decisions, and Memory. What is missing is the link between those operational records and the technical reality they describe. Today an agent reading `get_project_memory` sees textual notes like "we changed the auth middleware" but does not know *which component* the auth middleware is, *what depends on it*, or *which decision* motivated the change. CodeFlow closes this gap.

### How it differs from a generic code visualization tool

| Generic tool | CodeFlow in RB |
|---|---|
| Visualizes code-level dependencies | Links architecture nodes to Tasks, Decisions, Milestones |
| Context is ephemeral (IDE session) | Context is persistent in the project DB |
| Used only by developers | Used by developers, PMs, and AI agents |
| No RBAC | Controlled by the existing grants system |
| Unaware of operational state | Knows which tasks are open on each component |

### User problems solved

- **"Who owns what?"** — ownership nodes per team/user
- **"What breaks if I touch X?"** — change impact view
- **"Why is this component built this way?"** — links to historical decisions
- **"What is the current status of work on this module?"** — links to open tasks
- **"Where are we vs. the target architecture?"** — manual annotations vs. real graph

### AI-agent problems solved

- **Context window overflow**: instead of text dumps, agents receive structured, paginatable context
- **Architectural hallucination**: agents access verified facts on the graph, not inferences from free text
- **Cross-session continuity**: an agent in a new session can reconstruct technical context without starting from scratch
- **Blast radius awareness**: before creating a task, an agent knows which modules a change could affect

---

## 2. Functional Scope

### A. Architecture Map

#### Entities shown

The graph has four node levels:

| Level | Type | Example |
|---|---|---|
| 1 | `repository` | `roadboard-monorepo` |
| 2 | `app` / `package` | `core-api`, `packages/database` |
| 3 | `module` | `ProjectsModule`, `TasksModule` |
| 4 | `file` | `projects.service.ts` (focus mode only) |

#### Edge types

| Edge Type | Meaning |
|---|---|
| `contains` | Hierarchical (repo → app, app → module) |
| `depends_on` | Declared dependency in package.json |
| `imports` | TypeScript runtime import (static analysis, Phase 2) |
| `owns` | A team or user is owner of a node (manual) |
| `relates_to` | Manual semantic link between nodes |

#### Navigation

- **Global view**: levels 1–2 (repo + app/package). Filter by domain or ownership.
- **App view**: level 3 (internal modules). Entered by clicking an app node.
- **Focus mode**: level 4 (files). Only on explicit selection.
- **Breadcrumb navigation**: always visible in the graph panel header.
- **Filters**: by node type, by ownership (team/user), by presence of open tasks/decisions, by last scan.
- **Search**: by node name, path, annotation.

---

### B. Change Impact View

**Core question**: "If I modify this node, what else could be impacted?"

#### How impact is computed

Impact is a **reverse traversal** of the dependency graph:

1. Given source node `S`, find all nodes `N` with a path from `N` to `S` in the dependency graph.
2. Compute distance (hop count) for each `N` — determines impact confidence.
3. Classify: direct (1 hop), indirect (2–3 hops), remote (>3 hops).

**MVP**: static analysis on `depends_on` edges (from package.json) only.
**Phase 2**: adds `imports` edges from TypeScript analysis.
**Phase 3**: heuristics based on co-change frequency from git history.

#### Display

In the right panel when a node is selected:
- List of impacted nodes with `DIRECT` / `INDIRECT` / `REMOTE` badges
- Color overlay on graph (hot colors = high impact)
- "Linked RB Entities" section: open tasks, decisions, milestones across all impacted nodes

---

### C. Agent Context Layer

#### What agents should be able to retrieve

- **Graph summary**: nodes and edges in compact structured JSON
- **Node detail**: attributes, ownership, annotations, RB entity links, direct impact
- **Change impact**: list of impacted nodes given a target node
- **Linked context**: "given module X, give me open tasks, relevant decisions, architecture notes"
- **Handoff snapshot**: full architecture graph export as context artifact for a new agent session

#### How it differs from plain-text Memory

| MemoryEntry (existing) | Agent Architecture Context |
|---|---|
| Free text, unstructured | Structured graph, queryable by node/edge/relation |
| Not programmatically navigable | Filterable by type, scope, relationship |
| Not linked to specific entities | Every fact anchored to a graph node |
| Scales poorly (full memory dump) | Loaded in portions (node by node, scope by scope) |

#### Proposed MCP tools

```typescript
get_architecture_map(projectId, level?: "overview" | "modules")
// → { nodes: ArchitectureNodeSummary[], edges: ArchitectureEdgeSummary[] }

get_node_context(projectId, nodeId)
// → { node, annotations, openTasks, recentDecisions, linkedMemory, impactedBy }

get_change_impact(projectId, nodeId)
// → { direct: NodeSummary[], indirect: NodeSummary[], linkedEntities }

get_architecture_snapshot(projectId)
// → { summary, nodeCount, edgeCount, criticalNodes, recentAnnotations, topImpactNodes }
```

---

### D. Decision-Aware Graph

#### Relationships represented

```
ArchitectureNode ←→ Decision     (addresses | motivates | constrains)
ArchitectureNode ←→ Task         (implements | modifies | fixes | investigates)
ArchitectureNode ←→ Milestone    (delivers | depends_on)
ArchitectureNode ←→ MemoryEntry  (describes | warns_about | history)
```

#### Persistence

Table `architecture_links`. Each link carries:
- `node_id` — FK to architecture node
- `entity_type` — enum: task / decision / milestone / memory_entry
- `entity_id` — UUID of the linked RB entity
- `link_type` — semantic enum
- `created_by_user_id`
- `note` — optional free text

#### UI inspection

In the node detail drawer:
- **Decisions tab**: linked decisions with link-type badge; click → existing Decision drawer
- **Tasks tab**: linked tasks with status badge; filter by state
- **Milestones tab**: linked milestones
- **Memory tab**: linked architecture notes

---

## 3. Fit with the Current RB Architecture

### Relevant apps

| App | Role in CodeFlow |
|---|---|
| `core-api` | New module `codeflow/` with all REST endpoints |
| `worker-jobs` | New queue `QUEUE_ARCHITECTURE_SCAN` |
| `mcp-service` | 4 new MCP tools |
| `web-app` | New `codeflow` tab in `/projects/[id]` |
| `auth-access` | No changes — reuses existing grant system |
| `local-sync-bridge` | Out of scope for Phase 1–2 |

### Relevant packages

| Package | Extension required |
|---|---|
| `@roadboard/domain` | New enums: `ArchitectureNodeType`, `ArchitectureEdgeType`, `ArchitectureNodeLinkType`, 3 new `GrantType` values |
| `@roadboard/database` | 6 new Prisma models + migration |
| `@roadboard/mcp-contracts` | 4 new tool contract definitions |
| `@roadboard/api-contracts` | DTO types for the codeflow module |
| `@roadboard/grants` | `expandAdminGrant()` updated for new grant types |

### Code layout

```
apps/core-api/src/modules/codeflow/
├── codeflow.module.ts
├── repositories.controller.ts
├── graph.controller.ts
├── impact.controller.ts
├── links.controller.ts
├── codeflow.service.ts
├── graph.service.ts
├── impact.service.ts
├── scan.service.ts
└── dto/
    ├── create-repository.dto.ts
    ├── create-node.dto.ts
    ├── create-edge.dto.ts
    ├── create-link.dto.ts
    └── query-graph.dto.ts

apps/worker-jobs/src/processors/
└── architecture-scan.processor.ts

apps/mcp-service/src/tools/
└── codeflow-tools.ts

apps/web-app/src/app/projects/[id]/_tabs/
└── CodeflowTab.tsx
    ├── ArchitectureMapPanel.tsx
    ├── ChangeImpactPanel.tsx
    ├── DecisionGraphPanel.tsx
    └── AgentContextPanel.tsx
```

---

## 4. Data Model

### Prisma models

```prisma
model CodeRepository {
  id             String    @id @default(cuid())
  projectId      String
  name           String
  repoUrl        String?
  provider       String    @default("manual") // "github"|"gitlab"|"local"|"manual"
  defaultBranch  String    @default("main")
  scanIntervalH  Int?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  project        Project              @relation(fields: [projectId], references: [id], onDelete: Cascade)
  snapshots      ArchitectureSnapshot[]
  nodes          ArchitectureNode[]

  @@map("code_repositories")
}

model ArchitectureSnapshot {
  id             String    @id @default(cuid())
  repositoryId   String
  projectId      String
  commitHash     String?
  status         String    @default("pending") // "pending"|"running"|"completed"|"failed"
  scanType       String    @default("auto")    // "auto"|"manual"|"initial"
  errorMessage   String?
  nodeCount      Int       @default(0)
  edgeCount      Int       @default(0)
  triggeredById  String?
  createdAt      DateTime  @default(now())
  completedAt    DateTime?

  repository     CodeRepository       @relation(fields: [repositoryId], references: [id], onDelete: Cascade)
  nodes          ArchitectureNode[]
  edges          ArchitectureEdge[]
  impactAnalyses ImpactAnalysis[]

  @@index([projectId, status])
  @@index([repositoryId, createdAt])
  @@map("architecture_snapshots")
}

model ArchitectureNode {
  id             String    @id @default(cuid())
  projectId      String
  repositoryId   String
  snapshotId     String?
  type           String    // "repository"|"app"|"package"|"module"|"service"|"file"
  name           String
  path           String?
  description    String?
  domainGroup    String?
  isManual       Boolean   @default(false)
  isCurrent      Boolean   @default(true)
  metadata       Json      @default("{}")
  ownerUserId    String?
  ownerTeamId    String?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  project        Project              @relation(fields: [projectId], references: [id], onDelete: Cascade)
  repository     CodeRepository       @relation(fields: [repositoryId], references: [id], onDelete: Cascade)
  snapshot       ArchitectureSnapshot? @relation(fields: [snapshotId], references: [id])
  outgoingEdges  ArchitectureEdge[]   @relation("EdgeFrom")
  incomingEdges  ArchitectureEdge[]   @relation("EdgeTo")
  annotations    ArchitectureAnnotation[]
  links          ArchitectureLink[]
  impactSources  ImpactAnalysis[]     @relation("ImpactSource")

  @@index([projectId, isCurrent])
  @@index([projectId, type])
  @@index([repositoryId, path])
  @@map("architecture_nodes")
}

model ArchitectureEdge {
  id             String    @id @default(cuid())
  projectId      String
  snapshotId     String?
  fromNodeId     String
  toNodeId       String
  edgeType       String    // "contains"|"depends_on"|"imports"|"owns"|"relates_to"
  weight         Float     @default(1.0)
  isManual       Boolean   @default(false)
  isCurrent      Boolean   @default(true)
  metadata       Json      @default("{}")
  createdAt      DateTime  @default(now())

  snapshot       ArchitectureSnapshot? @relation(fields: [snapshotId], references: [id])
  fromNode       ArchitectureNode      @relation("EdgeFrom", fields: [fromNodeId], references: [id], onDelete: Cascade)
  toNode         ArchitectureNode      @relation("EdgeTo", fields: [toNodeId], references: [id], onDelete: Cascade)

  @@index([projectId, isCurrent])
  @@index([fromNodeId])
  @@index([toNodeId])
  @@map("architecture_edges")
}

model ArchitectureAnnotation {
  id              String    @id @default(cuid())
  nodeId          String
  projectId       String
  createdByUserId String
  content         String
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  node            ArchitectureNode @relation(fields: [nodeId], references: [id], onDelete: Cascade)

  @@index([nodeId])
  @@map("architecture_annotations")
}

model ArchitectureLink {
  id              String    @id @default(cuid())
  nodeId          String
  projectId       String
  entityType      String    // "task"|"decision"|"milestone"|"memory_entry"
  entityId        String
  linkType        String    // "implements"|"modifies"|"fixes"|"addresses"|"motivates"|"constrains"|"delivers"|"describes"|"warns_about"
  createdByUserId String
  note            String?
  createdAt       DateTime  @default(now())

  node            ArchitectureNode @relation(fields: [nodeId], references: [id], onDelete: Cascade)

  @@index([nodeId])
  @@index([projectId, entityType, entityId])
  @@map("architecture_links")
}

model ImpactAnalysis {
  id              String    @id @default(cuid())
  projectId       String
  snapshotId      String
  triggerNodeId   String
  directNodeIds   Json      @default("[]")
  indirectNodeIds Json      @default("[]")
  remoteNodeIds   Json      @default("[]")
  computedAt      DateTime  @default(now())

  snapshot        ArchitectureSnapshot @relation(fields: [snapshotId], references: [id], onDelete: Cascade)
  triggerNode     ArchitectureNode     @relation("ImpactSource", fields: [triggerNodeId], references: [id], onDelete: Cascade)

  @@unique([snapshotId, triggerNodeId])
  @@index([projectId])
  @@map("impact_analyses")
}
```

### Entity lifecycle

| Entity | Mutable | Lifecycle | Generator |
|---|---|---|---|
| `CodeRepository` | Yes | Lives with the project | User |
| `ArchitectureSnapshot` | No (immutable post-scan) | Historicized, not deleted | Worker / User trigger |
| `ArchitectureNode` | Yes (annotations, ownership) | `isCurrent=true` until next scan | Scanner (auto) or User (manual) |
| `ArchitectureEdge` | No | Like nodes | Scanner or User |
| `ArchitectureAnnotation` | Yes | Lives linked to the node | User |
| `ArchitectureLink` | No (delete + recreate) | Lives as long as node and entity exist | User or Agent |
| `ImpactAnalysis` | No | Recomputed on each snapshot | Worker post-scan |

---

## 5. Ingestion Pipeline

### Repository connection

A `CodeRepository` is created manually via API. It specifies URL, provider, and branch. No credentials required in the MVP (public repos or local paths).

### MVP analysis pipeline (package.json only)

```
1. Worker receives job: { repositoryId, snapshotId }
2. Set ArchitectureSnapshot.status = "running"
3. Clone repo (or use local path if provider = "local")
4. Read root package.json → find workspaces
5. For each workspace:
   a. Create ArchitectureNode (type: "app" or "package")
   b. Read workspace package.json → dependencies
   c. For each dep that is a workspace package:
      → create ArchitectureEdge (type: "depends_on")
6. Compute ImpactAnalysis for each node (reverse BFS)
7. Update ArchitectureSnapshot: status="completed", nodeCount, edgeCount
8. Mark old nodes isCurrent=false
9. Mark new nodes isCurrent=true
10. Delete temp clone directory (also in finally block for crash safety)
```

### Phase 2: TypeScript import analysis

After step 5, use `ts-morph` to parse import statements per file, resolve to workspace packages, and create `imports`-type edges. Aggregate to module-level for global view.

### Rescan strategy

- **On-demand**: `POST /repositories/:id/scan` → enqueue job
- **Automatic**: if `scanIntervalH` is set, worker cron checks hourly
- **Phase 2 differential**: compare commit hash with previous snapshot → skip scan if unchanged

### Failure handling

- Job failure → `ArchitectureSnapshot.status = "failed"`, `errorMessage` populated
- UI shows "Last scan failed" badge with error
- Worker: 3 retries with backoff 30s / 5m / 30m
- Temp directory guaranteed clean even on crash (finally block in processor)

---

## 6. API Design

All endpoints are under `/projects/:projectId/codeflow` and require `AuthGuard` + `GrantCheckGuard`.

### Repositories

```
POST   /projects/:projectId/codeflow/repositories          codeflow.write + project.admin
GET    /projects/:projectId/codeflow/repositories          codeflow.read
GET    /projects/:projectId/codeflow/repositories/:id      codeflow.read
PATCH  /projects/:projectId/codeflow/repositories/:id      codeflow.write
DELETE /projects/:projectId/codeflow/repositories/:id      project.admin
POST   /projects/:projectId/codeflow/repositories/:id/scan codeflow.scan
GET    /projects/:projectId/codeflow/repositories/:id/scans codeflow.read
```

### Graph

```
GET    /projects/:projectId/codeflow/graph                          codeflow.read
GET    /projects/:projectId/codeflow/graph/nodes/:nodeId            codeflow.read
POST   /projects/:projectId/codeflow/graph/nodes                    codeflow.write
PATCH  /projects/:projectId/codeflow/graph/nodes/:nodeId            codeflow.write
DELETE /projects/:projectId/codeflow/graph/nodes/:nodeId            codeflow.write (manual only)
POST   /projects/:projectId/codeflow/graph/edges                    codeflow.write
DELETE /projects/:projectId/codeflow/graph/edges/:edgeId            codeflow.write (manual only)
GET    /projects/:projectId/codeflow/graph/nodes/:nodeId/impact     codeflow.read
GET    /projects/:projectId/codeflow/graph/nodes/:nodeId/links      codeflow.read
POST   /projects/:projectId/codeflow/graph/nodes/:nodeId/links      codeflow.write
DELETE /projects/:projectId/codeflow/graph/links/:linkId            codeflow.write
GET    /projects/:projectId/codeflow/snapshot                       codeflow.read
```

### Key payload shapes

```typescript
interface CreateRepositoryDto {
  name: string;
  repoUrl?: string;
  provider: "github" | "gitlab" | "local" | "manual";
  defaultBranch?: string;
  scanIntervalH?: number;
}

interface GraphResponse {
  snapshotId: string | null;
  snapshotStatus: string;
  lastScannedAt: string | null;
  nodes: GraphNodeDto[];
  edges: GraphEdgeDto[];
}

interface GraphNodeDto {
  id: string;
  type: string;
  name: string;
  path: string | null;
  domainGroup: string | null;
  ownerUserId: string | null;
  ownerTeamId: string | null;
  isManual: boolean;
  openTaskCount: number;
  decisionCount: number;
  annotationCount: number;
  metadata: Record<string, unknown>;
}

interface ImpactResponse {
  triggerNode: GraphNodeDto;
  direct: ImpactedNodeDto[];
  indirect: ImpactedNodeDto[];
  remote: ImpactedNodeDto[];
  linkedEntities: {
    tasks: { id: string; title: string; status: string; nodeId: string }[];
    decisions: { id: string; title: string; status: string; nodeId: string }[];
    milestones: { id: string; title: string; status: string; nodeId: string }[];
  };
}

interface CreateLinkDto {
  entityType: "task" | "decision" | "milestone" | "memory_entry";
  entityId: string;
  linkType: string;
  note?: string;
}

interface ArchitectureSnapshotDto {
  projectId: string;
  generatedAt: string;
  nodeCount: number;
  edgeCount: number;
  nodes: {
    id: string;
    type: string;
    name: string;
    path: string | null;
    domainGroup: string | null;
    openTaskCount: number;
    linkedDecisionCount: number;
    annotations: string[];
  }[];
  edges: { from: string; to: string; type: string }[];
  topImpactNodes: { nodeId: string; name: string; directDependants: number }[];
}
```

---

## 7. Frontend Design

### Information architecture

New `codeflow` tab added as the **seventh tab** in `/projects/[id]` (after `audit`). The tab is hidden if the project has no `CodeRepository` yet (onboarding empty state shown instead).

```
/projects/[id]
  Tabs: overview | tasks | phases | decisions | memory | audit | codeflow
  
  CodeFlow section:
  ├── Header: repository selector + Trigger Scan button + last scan status badge
  └── Sub-nav: [ Architecture Map ] [ Change Impact ] [ Decision Graph ] [ Agent Context ]
```

### Sub-view: Architecture Map

```
┌──────────────────────────────────────────┬───────────────────────┐
│ [Search nodes...] [Type ▼] [Domain ▼]    │  NODE DETAIL DRAWER   │
├──────────────────────────────────────────┤  ─────────────────    │
│                                          │  core-api             │
│   GRAPH CANVAS (react-flow)              │  Type: app            │
│                                          │  Domain: backend      │
│   ○ core-api ──→ ○ database             │  Owner: @team-core    │
│       ↓                                  │                       │
│   ○ auth-access                          │  [Decisions] [Tasks]  │
│                                          │  [Memory]   [Links]   │
│   ○ web-app ──→ ○ api-contracts         │                       │
│                                          │  + Link Entity        │
│   [Zoom] [Fit to screen]                 │                       │
└──────────────────────────────────────────┴───────────────────────┘
```

### Sub-view: Change Impact

```
┌────────────────────────────────────────────────────────────────┐
│  [Search node...                              ]                 │
│                                                                 │
│  Impact for: packages/database                                  │
│                                                                 │
│  DIRECT (1 hop)                                                 │
│  ● core-api          [2 open tasks]  [1 decision]               │
│  ● auth-access       [0 open tasks]                             │
│  ● worker-jobs       [1 open task]                              │
│                                                                 │
│  INDIRECT (2–3 hops)                                            │
│  ● mcp-service       via core-api                               │
│  ● web-app           via api-contracts → core-api               │
│                                                                 │
│  LINKED ENTITIES (across all impacted nodes)                    │
│  Tasks:     [Migrate to Prisma 6]  [Fix N+1 in tasks query]     │
│  Decisions: [Use PostgreSQL over SQLite for production]         │
└────────────────────────────────────────────────────────────────┘
```

### Sub-view: Decision Graph

Filtered view of the Architecture Map showing only nodes with at least one Decision link. Each node shows colored badges per link type. Click on a badge opens the native RoadBoard Decision drawer.

### Sub-view: Agent Context

Read-only view of the current architecture snapshot as an agent would receive it. Includes:
- Formatted JSON of the `/snapshot` payload
- Copy-to-clipboard button
- "What an agent sees when calling `get_architecture_map`" section
- Top 5 nodes by impact

### MVP UI scope (Phase 1 only)

1. Repository connection form
2. Manual scan trigger + status badge
3. Graph canvas with nodes (app/package level) and `depends_on` edges
4. Node detail drawer with Decisions and Tasks tabs
5. Create link form (link a node to an existing decision or task)
6. Impact list (text list, no graph overlay in MVP)

Deferred to Phase 2+: graph overlay colors, module/file zoom levels, domain grouping UI, history comparison.

---

## 8. Permissions and Security

### Access matrix

| Action | `codeflow.read` | `codeflow.write` | `codeflow.scan` | `project.admin` |
|---|---|---|---|---|
| View graph, nodes, edges, impact | ✓ | ✓ | ✓ | ✓ |
| Annotate nodes, set ownership, create links | ✗ | ✓ | ✗ | ✓ |
| Trigger scan | ✗ | ✗ | ✓ | ✓ |
| Connect a repository | ✗ | ✗ | ✗ | ✓ |
| MCP read tools | token with `codeflow.read` scope | | | |

`PROJECT_ADMIN` grant must be extended in `expandAdminGrant()` to include all three new grant types.

### Security considerations

**Repository ingestion**:
- Worker clones repos in isolated temp directories under `/tmp/rb-scan/<snapshotId>/`.
- Repo URL must be validated against an allowlist of providers (prevent SSRF toward internal addresses).
- Temp directory deleted after scan and in `finally` block for crash safety.
- Scanner must not read `.env` files or secrets from the codebase.

**Code metadata exposure**:
- File names and paths are stored in DB. `projectId` on every query is the primary isolation boundary.
- `metadata` JSON field must contain only statistics (LOC, export count), never source code content.

**Agent access**:
- Existing MCP token is scoped to a `userId`. Token cannot access projects for which the user lacks grants.
- New `codeflow.read` scope on token is verified in mcp-service before calling core-api.
- Agents cannot trigger scans via MCP (restricted to human users via REST).

**Multi-project isolation**:
- Every query filters by `projectId` extracted from path parameter, verified by `GrantCheckGuard`.
- `ArchitectureLink.entityId` is validated to belong to the same project at creation time.

---

## 9. Phased Implementation Plan

### Phase 1 — Manual MVP

**Goal**: Allow teams and agents to connect architecture nodes (entered manually) to Decisions, Tasks, and Milestones. No automatic scanning.

**Backend**: Full `codeflow` module (no `scan.service`), all CRUD endpoints, `/snapshot` endpoint
**Frontend**: CodeFlow tab, graph canvas, node drawer, link creation form
**Schema**: All 6 new Prisma models
**Jobs**: None
**MCP**: `get_architecture_map`, `get_node_context`

**Excluded**: automatic scan, impact analysis, worker queue, `get_change_impact`

---

### Phase 2 — Automatic Scanning and Impact Analysis

**Goal**: Generate the graph automatically from code. Add change impact view.

**Backend**: `scan.service`, impact BFS computation, scan endpoints
**Frontend**: Change Impact sub-view, scan trigger/status
**Schema**: No changes (all tables already exist from Phase 1)
**Jobs**: New `QUEUE_ARCHITECTURE_SCAN` BullMQ queue + processor
**MCP**: `get_change_impact`

**Excluded**: TypeScript import analysis (package.json only), git history heuristics

---

### Phase 3 — Agent-Native Differentiation

**Goal**: Make CodeFlow natively useful to AI agents as the primary source of structured architectural context.

**Backend**: ts-morph import analysis in scanner, snapshot diff endpoint, link suggestion service
**Frontend**: Decision-Aware Graph sub-view (complete), domain grouping (drag-and-drop), historical view
**Schema**: Optional `DomainGroup` model or JSON on Project
**Jobs**: Scanner updated with import analysis
**MCP**: `get_architecture_snapshot`, integration with existing `create_handoff`

**Excluded**: git blame integration, PR/commit correlation, CI/CD pipeline integration

---

## 10. Implementation Strategy

### Build order

1. **Sprint 1**: Schema (6 models + migration) + domain/grants extension + repositories CRUD
2. **Sprint 2**: Graph nodes/edges CRUD + links + snapshot endpoint + 2 MCP tools
3. **Sprint 3**: Frontend tab, graph canvas (react-flow), node drawer, link form
4. **Sprint 4**: Worker queue + scanner (package.json) + impact BFS + Change Impact UI

### Do not build yet

- TypeScript import analysis (package.json is sufficient for most use cases)
- Historical diff view (high complexity, low short-term value)
- AI link auto-suggestion (requires embedding model)
- local-sync-bridge integration (no clear MVP use case)
- File-level nodes (too granular, overloads the graph)

### Acceptable compromises

- **Impact not cached in Phase 1**: BFS computed on-the-fly. With <200 nodes, <50ms. Cache only when needed.
- **Static graph layout in MVP**: dagre top-down layout. More predictable than physics simulation.
- **Synchronous scan in Phase 1** (small repos or manual): if worker not available in dev, first scan can be synchronous with a 30s timeout.

### Safest architectural choices

- All new endpoints under `/codeflow` — no contamination of existing modules.
- `isCurrent` boolean on nodes and edges — simple queries, no mandatory join for the normal view.
- Polymorphic `entityType` + `entityId` reference for links — lighter schema, application-level validation.
- No graph database (Neo4j, etc.) — PostgreSQL handles up to ~100k nodes and ~500k edges comfortably, well beyond RoadBoard's use case for years.
