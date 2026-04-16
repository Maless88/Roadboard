# Roadmap

> **Status: pre-beta — active development.** No stable release has been published. APIs and interfaces may change without notice.

## Current milestone

**Wave 4 — Team and access hardening** *(next)*

- Fine-grained permission scopes on MCP tokens
- Team-level dashboards
- Invite and onboarding flows in web-app

---

**Wave 5 — CodeFlow: Architecture Intelligence** *(planned)*

- Persistent architecture graph linked to Projects, Tasks, Decisions, and Memory
- Manual node/edge creation and linking to RB entities (Phase 1)
- Automatic code graph generation via repository scanning (Phase 2)
- Agent-native MCP tools for structured architectural context (Phase 3)

See full design: [docs/design/codeflow.md](docs/design/codeflow.md)

---

## Completed phases

| Phase | Title | Status |
|-------|-------|--------|
| 0 | Foundation Blueprint | done |
| 1 | Core Domain Backbone | done |
| 2 | Access Backbone | done |
| 3 | MCP Foundation | done |
| 4 | Memory Backbone | done |
| 5 | Wave 1 Hardening | done |
| 6 | Roadboard Builds Roadboard | done |
| 7 | Human Web UI Layer | done |
| 8 | MCP Workflow Tools | done |
| 9 | Async & Operational Reliability | done |
| 10 | Local Sync Bridge | done |
| 11 | GitHub Publication Readiness | done |
| 12 | Test Automation Hardening | done |
| Wave 3 | Memory and intelligence layer | done |

---

## Upcoming

These are planned directions, not committed delivery dates.

### Wave 4 — Team and access hardening
- Fine-grained permission scopes on MCP tokens
- Team-level dashboards
- Invite and onboarding flows in web-app

### Wave 5 — CodeFlow: Architecture Intelligence

A new dashboard section that connects the technical structure of a codebase to the operational context already managed in RoadBoard (Tasks, Decisions, Milestones, Memory).

**Phase 1 — Manual MVP**
- Connect architecture nodes and edges manually to a project
- Link nodes to existing Decisions, Tasks, and Milestones
- MCP tools: `get_architecture_map`, `get_node_context`
- 6 new Prisma models, new `codeflow.*` grant types

**Phase 2 — Automatic Scanning and Impact Analysis**
- Connect a git repository and trigger scans via worker job
- Auto-generate graph from package.json dependency analysis
- Change impact view: reverse BFS traversal with direct/indirect/remote classification
- MCP tool: `get_change_impact`

**Phase 3 — Agent-Native Differentiation**
- TypeScript import-level analysis (ts-morph)
- Architecture snapshot for agent handoffs
- Decision-Aware Graph: full sub-view in UI
- Domain grouping drag-and-drop
- MCP tool: `get_architecture_snapshot`

See full design: [docs/design/codeflow.md](docs/design/codeflow.md)

---

## Deliberately out of scope (for now)

- Becoming a full Jira/Linear replacement
- Autonomous agent orchestration without human oversight
- Semantic/RAG infrastructure before the core object model is stable
- Enterprise permission matrix
- Third-party integrations beyond the MCP foundation

---

## Contributing to the roadmap

Open a GitHub issue with the label `roadmap` to propose a direction or raise a priority.
