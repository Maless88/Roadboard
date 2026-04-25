# RoadBoard 2.0

Multi-project execution, memory, and collaboration platform for humans and AI agents.

[![CI](https://github.com/Maless88/Roadboard/actions/workflows/ci.yml/badge.svg)](https://github.com/Maless88/Roadboard/actions/workflows/ci.yml)
![Status](https://img.shields.io/badge/status-pre--beta%20%7C%20active%20development-orange)

> **Work in progress.** RoadBoard 2.0 is under active development and not yet in beta. APIs, data models, and interfaces may change without notice. Not recommended for production use.

---

## Why RoadBoard exists

Context loss is one of the most expensive problems in modern project work.

Teams lose track of decisions. Agents restart sessions without knowing what happened. Progress is scattered across chat threads, documents, and memory that belongs to no system. Work is repeated because no one can find what was already done.

RoadBoard is designed to be the operational control plane for complex project work — a single place where humans and AI agents share structured project state, preserve memory across sessions, and coordinate without losing context.

---

## Core capabilities

- **Multi-project planning** — projects, phases, milestones, tasks, priorities, and dependencies
- **Operational memory** — persistent memory entries, decision records, and session handoffs
- **Team collaboration** — users, teams, project grants, role-based access control
- **MCP agent access** — 31 tools for agents to read and write project state via Model Context Protocol, with fine-grained per-token scope enforcement
- **Web dashboard** — project status, task management, and memory entries via browser
- **Async job layer** — background refresh, summary generation, and cleanup via BullMQ
- **Local sync bridge** — offline-first SQLite journal with sync engine to the central database

---

## Architecture

```
apps/
  core-api          NestJS — projects, phases, tasks, memory, decisions, codeflow, release (port 3001)
  auth-access       NestJS — users, teams, sessions, MCP tokens (port 3002)
  mcp-service       MCP server (stdio + HTTP) — 31 tools for agent integration (port 3005)
  web-app           Next.js 15 — dashboard, project detail, task management, Atlas (port 3000)
  worker-jobs       NestJS + BullMQ — async jobs: refresh, summary, cleanup (port 3003)
  local-sync-bridge NestJS + SQLite — offline-first journal with sync engine (port 3004)

packages/
  domain            shared enums and domain types
  database          Prisma schema, migrations, seed
  auth              password hashing, token utilities
  grants            permission logic
  mcp-contracts     MCP tool schemas
  api-contracts     shared REST API types
  graph-db          Memgraph (Neo4j-compat) client + Cypher schema for CodeFlow
  demo-seed         seed content for "Tour Roadboard" demo project on signup
  local-storage     SQLite local-storage abstraction
  observability     logging/tracing setup
  config            env helpers

infra/
  docker/           docker-compose (PostgreSQL 16, Redis 7, Memgraph 2.18)
  systemd/          systemd .service + .path units for self-hosted deploy
```

## Stack

- **Runtime**: Node.js 20, TypeScript strict
- **Backend**: NestJS 11 with Fastify adapter
- **Frontend**: Next.js 15 App Router, Tailwind CSS 4
- **Database**: PostgreSQL 16 (Prisma ORM), SQLite (local journal)
- **Queue**: Redis 7 + BullMQ
- **Agent protocol**: MCP (Model Context Protocol) via HTTP StreamableHTTP or stdio
- **Monorepo**: pnpm workspaces + Turborepo

---

## Quickstart

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (for PostgreSQL and Redis)

### Setup

```bash
# Clone
git clone https://github.com/Maless88/Roadboard.git
cd rb

# Install dependencies
pnpm install

# Copy env and start infrastructure
cp .env.example .env
docker compose -f infra/docker/docker-compose.yml up -d

# Build all packages
pnpm build
```

The local Docker Compose stack now bootstraps Postgres, Redis, migrations, seed data,
`core-api`, `auth-access`, `mcp-service` (HTTP on `:3005`), `worker-jobs`,
`local-sync-bridge`, and the Next.js `web-app`.

### Full local stack

```bash
# Build and run the full local stack
docker compose -f infra/docker/docker-compose.yml up -d --build

# Stop it
docker compose -f infra/docker/docker-compose.yml down
```

### Start services

```bash
# core-api
DATABASE_URL="postgresql://roadboard:roadboard@localhost:5433/roadboard" \
  CORE_API_PORT=3001 AUTH_ACCESS_PORT=3002 \
  node apps/core-api/dist/main.js

# auth-access
DATABASE_URL="postgresql://roadboard:roadboard@localhost:5433/roadboard" \
  AUTH_ACCESS_PORT=3002 \
  node apps/auth-access/dist/main.js

# web-app (dev)
cd apps/web-app && pnpm dev

# worker-jobs
WORKER_JOBS_PORT=3003 node apps/worker-jobs/dist/main.js

# local-sync-bridge
LOCAL_SYNC_PORT=3004 JOURNAL_DB_PATH=.agent/journal.db \
  node apps/local-sync-bridge/dist/main.js

# mcp-service (HTTP mode)
MCP_TRANSPORT=http MCP_HTTP_PORT=3005 AUTH_ACCESS_PORT=3002 \
  node apps/mcp-service/dist/main.js
```

### MCP server (for Claude / agent integration)

```json
{
  "mcpServers": {
    "roadboard": {
      "command": "node",
      "args": ["apps/mcp-service/dist/main.js"],
      "env": {
        "MCP_TOKEN": "<your-mcp-token>",
        "CORE_API_PORT": "3001",
        "AUTH_ACCESS_PORT": "3002"
      }
    }
  }
}
```

For HTTP MCP clients, use `http://127.0.0.1:3005/mcp` with a bearer token issued by
`auth-access`. Tokens carry a `scopes` array (`GrantType[]`) — each tool enforces
the minimum required scope at call time.

### API docs

- `core-api`: `http://127.0.0.1:3001/docs`
- `auth-access`: `http://127.0.0.1:3002/docs`

### Health endpoints

- `core-api`: `http://127.0.0.1:3001/health`
- `auth-access`: `http://127.0.0.1:3002/health`
- `worker-jobs`: `http://127.0.0.1:3003/health`
- `local-sync-bridge`: `http://127.0.0.1:3004/health`
- `mcp-service`: `http://127.0.0.1:3005/health`
- `web-app`: `http://127.0.0.1:3000/health`

### Seeded onboarding data

`db:seed` now creates a usable local onboarding state for `roadboard-2`:

- demo users and team memberships
- the `Roadboard 2.0` project and admin grant
- the `Wave 2 — Platform Hardening` phase
- Wave 2 task and memory history aligned with the current repo state

---

## MCP Tools

Each tool enforces a minimum `GrantType` scope. `project.admin` bypasses all checks.

| Tool | Required scope | Description |
|------|---------------|-------------|
| `initial_instructions` | — | Operational protocol bootstrap (call once per session) |
| `list_projects` | `project.read` | List accessible projects |
| `list_teams` | `project.read` | List teams the caller belongs to (slug + role) |
| `get_project` | `project.read` | Get project details with phases |
| `list_active_tasks` | `project.read` | List tasks, optionally filtered by status |
| `list_phases` | `project.read` | List phases for a project |
| `get_project_memory` | `project.read` | List memory entries |
| `prepare_task_context` | `project.read` | Full context bundle for a specific task |
| `prepare_project_summary` | `project.read` | Project snapshot for agent onboarding |
| `get_project_changelog` | `project.read` | Structured changelog: tasks, phases, decisions, memory, audit |
| `search_memory` | `project.read` | Full-text search over memory entries |
| `list_recent_decisions` | `project.read` | List decisions, optionally filtered by status |
| `create_task` | `task.write` | Create a task in a phase (auto-selects first phase if omitted); accepts description, assigneeId, dueDate |
| `update_task` | `task.write` | Update title, description, phaseId, priority, assigneeId, or dueDate of an existing task |
| `update_task_status` | `task.write` | Update task status; accepts completionReport when marking done |
| `create_phase` | `project.write` | Create a roadmap phase; can be linked to a decision via decisionId |
| `update_phase` | `project.write` | Update phase fields: title, status, dates, linked decision |
| `create_memory_entry` | `memory.write` | Create a memory entry |
| `create_handoff` | `memory.write` | Structured handoff entry for session continuity |
| `create_decision` | `decision.write` | Record an architectural decision; auto-logs to vault |
| `update_decision` | `decision.write` | Record outcome, change status, set resolvedAt |
| `create_project` | `project.admin` | Create a new project; auto-logs to vault |
| `get_architecture_map` | `codeflow.read` | Get the architecture graph (nodes + edges) |
| `get_node_context` | `codeflow.read` | Full context for an architecture node |
| `create_architecture_repository` | `codeflow.write` | Register a CodeRepository for the project (one per onboarding) |
| `create_architecture_node` | `codeflow.write` | Add a workspace/module/service ArchitectureNode |
| `create_architecture_edge` | `codeflow.write` | Add a depends_on / imports edge between two nodes |
| `create_architecture_link` | `codeflow.write` | Tie a Task / Decision / Memory entry to an ArchitectureNode |
| `link_task_to_node` | `codeflow.write` | Semantic wrapper of create_architecture_link for tasks (call right after create_task) |
| `create_architecture_annotation` | `codeflow.write` | Attach a free-text note to an ArchitectureNode |
| `ingest_architecture` | `codeflow.write` | One-shot orchestrator: repository + nodes + edges + annotations in a single manifest call |

---

## Development

```bash
pnpm typecheck       # typecheck all packages
pnpm -r test         # run all tests
pnpm -r build        # build all packages and apps
```

---

## Documentation

- [ROADMAP.md](ROADMAP.md) — current milestone and upcoming phases
- [CONTRIBUTING.md](CONTRIBUTING.md) — how to contribute
- [SECURITY.md](SECURITY.md) — vulnerability reporting
- [SUPPORT.md](SUPPORT.md) — where to ask questions
- [CHANGELOG.md](CHANGELOG.md) — version history
- [docs/atlas-manual-use.md](docs/atlas-manual-use.md) — using the Atlas architecture graph tab (Wave 5.1 manual MVP)
- [docs/mcp-client-setup.md](docs/mcp-client-setup.md) — connecting Claude Code or another MCP client to Roadboard
- [docs/planning/](docs/planning/) — architecture and design notes

---

## Current status

Waves 1–5 are complete. The platform is functional end-to-end: REST APIs, MCP server, web dashboard, async jobs, local sync bridge, dual-write graph DB (Postgres + Memgraph), and self-hosted deploy are all implemented.

- **Wave 3** — semantic memory search, agent-readable project changelog, richer decision model, memory summarization background jobs ✓
- **Wave 4** — fine-grained MCP token scopes, project ownership model, per-project member management, MCP auto-vault, Phase–Decision linking, interactive Roadmap and Decisions accordions, 4 new MCP write tools ✓
- **Wave 5.1** — Atlas (CodeFlow) manual MVP: ArchitectureNode/Edge/Link/Annotation, MCP atomic write tools, Architecture Map canvas in web-app, node detail drawer ✓
- **Wave 5.2** — graph DB foundation: Memgraph 2.18 added to compose, `@roadboard/graph-db` Neo4j-compat client, dual-write `GraphSyncService` for nodes/edges, schema constraints + indexes ✓
- **Wave 5.3** — agent-driven onboarding: `ingest_architecture` one-shot orchestrator, `link_task_to_node` semantic wrapper, enriched `prepare_task_context` with architecture nodes & decisions ✓
- **Deploy UX** — light/dark theme, single-pill release banner, self-hosted per-host deploy via systemd.path + systemd.service (no GitHub Actions workflow_dispatch needed) ✓

Active planning: **Wave 6 — Deep Code Map** (file + symbol graph via ts-morph + tree-sitter, blast-radius queries on Memgraph) and **CF-GDB-03b** (cut over Atlas reads from Postgres to Memgraph and retire the architecture_* Prisma tables).

> The project is pre-beta. No stable release has been published yet. Breaking changes may occur on `main`.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

MIT — see [LICENSE](LICENSE).
