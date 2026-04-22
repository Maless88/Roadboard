# Atlas — uso manuale

The **Atlas** tab in `/projects/[id]` shows the architecture graph of a project: its components (nodes) and their dependencies (edges). In Wave 5.1 the graph is populated **manually** or via the one-shot seed script — automatic scanning comes with Wave 5.2.

This document covers:

1. [Enabling Atlas for a project](#1-enabling-atlas-for-a-project)
2. [Populating the graph via the seed script](#2-populating-the-graph-via-the-seed-script)
3. [Populating the graph via API (curl / MCP)](#3-populating-the-graph-via-api-curl--mcp)
4. [Using the UI: canvas, search, filter, drawer](#4-using-the-ui)
5. [Linking a node to Tasks, Decisions, Memory](#5-linking-nodes-to-rb-entities)
6. [Known limitations (what Wave 5.2 / 5.3 will add)](#6-known-limitations)

---

## 1. Enabling Atlas for a project

Atlas is a per-project tab, enabled by default. Open the project from the sidebar and click the **Atlas** tab in the header.

With no data, you see an empty-state card:

> **Nessuna scansione ancora effettuata per questo progetto.**

That means the project has no `CodeRepository` nor `ArchitectureSnapshot` in the database yet.

Grants required to see Atlas:
- `codeflow.read` (or `project.admin` which bypasses scope checks)

Grants required to modify:
- `codeflow.write` for creating nodes, edges, links
- `codeflow.scan` for triggering scans (Wave 5.2)

---

## 2. Populating the graph via the seed script

The repo ships with a one-shot seed that scans every workspace (`apps/*`, `packages/*`), creates a node per workspace, and emits `depends_on` edges for each internal `@roadboard/*` dependency:

```bash
pnpm --filter @roadboard/database db:seed-codeflow
```

Default project: `slug=roadboard-2`. Override with:

```bash
PROJECT_SLUG=my-other-project pnpm --filter @roadboard/database db:seed-codeflow
```

The script is **idempotent**: it wipes previous CodeFlow data for the target project before re-inserting. Safe to re-run.

Output on the Roadboard monorepo itself:

```
Discovered 15 workspaces (6 apps, 9 packages).
Seed complete: 1 repository, 1 snapshot, 15 nodes, 17 edges.
```

After seeding, refresh the Atlas tab — nodes laid out top-to-bottom via dagre, edges animated for `depends_on`.

---

## 3. Populating the graph via API (curl / MCP)

If you want to add a node manually outside the seed, the REST endpoints are under `/projects/:projectId/codeflow/graph`.

### Create a repository (needed as FK for nodes)

```bash
TOKEN=<session-token-from-/auth/login>
PROJECT_ID=<cuid>

curl -X POST http://localhost:3001/projects/$PROJECT_ID/codeflow/repositories \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"manual-repo","provider":"manual","defaultBranch":"main"}'
```

### Create a node

```bash
curl -X POST http://localhost:3001/projects/$PROJECT_ID/codeflow/graph/nodes \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"type":"app","name":"my-service","path":"apps/my-service","repositoryId":"<repo-id>","isManual":true}'
```

`type` accepts: `app`, `package`, `module`, `service`.

### Create an edge

```bash
curl -X POST http://localhost:3001/projects/$PROJECT_ID/codeflow/graph/edges \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"fromNodeId":"<from>","toNodeId":"<to>","edgeType":"depends_on","isManual":true}'
```

`edgeType` accepts: `depends_on`, `imports`, `impacts`, `linked_to`.

Only manual nodes/edges (`isManual=true`) are deletable via the API — auto-generated ones are replaced on rescan.

### Via MCP (agents)

The MCP tools `get_architecture_map(projectId)` and `get_node_context(projectId, nodeId)` are read-only. Creating nodes/edges via MCP is not yet exposed — use the REST API above or the seed script.

---

## 4. Using the UI

Once the graph is populated, the Atlas map shows:

- **Canvas**: nodes laid out with dagre (top-to-bottom), colors per type (app indigo, package emerald, module amber, service pink). Edges with `depends_on` are animated.
- **Search box**: filters nodes by name or path (substring, case-insensitive).
- **Type filter**: restricts to one node type or "all".
- **Minimap**: corner overview, pannable and zoomable.
- **Controls**: zoom in/out and fit-to-view.

Edge filtering follows the nodes: an edge is visible only if both endpoints pass the current search + type filter.

### The node detail drawer

**Click a node** to open the side drawer (480px, right side). It has five tabs:

1. **Info** — type, path, domain group, counts (tasks/decisions/annotations), description, annotations list
2. **Decisioni** — links of type `decision`
3. **Task** — links of type `task`
4. **Memory** — links of type `memory_entry`
5. **Link** — all links + a form to create a new one (see next section)

Close the drawer with the `×` in the top-right.

---

## 5. Linking nodes to RB entities

From the drawer's **Link** tab you can link the selected node to an existing task/decision/milestone/memory entry.

### Allowed `entityType`

- `task`
- `decision`
- `milestone`
- `memory_entry`

### Allowed `linkType`

- `implements` — node implements the entity
- `modifies` — node is modified by the entity
- `fixes` — node is fixed by the entity
- `addresses` — node addresses a concern from the entity
- `motivates` — node motivates the entity
- `constrains` — node is constrained by the entity
- `delivers` — node delivers the entity
- `describes` — node describes the entity (e.g. in memory)
- `warns_about` — node triggers a warning in the entity

### Creating a link

In the form, enter the `entityId` (CUID of the target task/decision/memory/milestone), pick `entityType` and `linkType`, optionally add a note, click **Collega**.

To find entity IDs quickly:
- Tasks / decisions / memory entries: hover items in their respective tabs — the URL contains their IDs (or use `list_tasks` / `list_recent_decisions` via MCP).
- A future iteration will add a combobox with a searchable picker.

### Removing a link

Click **Rimuovi** next to any link row.

---

## 6. Known limitations

These features appear in the sub-nav but their content is a placeholder until the corresponding Wave lands:

| Sub-view | Status | Unlocks with |
|---|---|---|
| Mappa architettura | Active (CF-09, CF-10) | — |
| Node drawer | Active (CF-11) | — |
| Impatto cambiamenti | Placeholder "In arrivo" | CF-14, CF-17 (Wave 5.2) |
| Grafo decisioni | Placeholder "In arrivo" | CF-20 (Wave 5.3) |
| Agent context | Placeholder "In arrivo" | CF-19, CF-21 (Wave 5.3) |

### Other limitations

- **No automatic scan yet**: no git-aware worker parses the repo. Wave 5.2 (CF-12..17) will add a BullMQ-scheduled `ArchitectureScanProcessor`.
- **No import-level edges**: edges are only `depends_on` from `package.json`. TypeScript `imports` edges come with ts-morph in Wave 5.3 (CF-18).
- **Storage will migrate to a graph DB**: decision `cmoa0zt18` accepted on 2026-04-22 — Memgraph Community Edition selected as target (ADR memory entry). Wave 5.2 tasks CF-GDB-02/03/04 will refactor the storage, transparent to the UI and MCP contracts.
- **Drawer entityId picker is free-text**: until a proper searchable picker lands, paste CUIDs by hand.

---

## Related

- Decision `cmoa0zt18` — graph DB migration (ADR in project memory)
- Task [CF-11] — node detail drawer (closed)
- Task [CF-GDB-01] — graph DB spike (closed, recommendation: Memgraph)
- Phase **Wave 5.1 — CodeFlow Manual MVP** — contains the DoD for this surface
