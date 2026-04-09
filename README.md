# RoadBoard 2.0

Multi-project execution, memory, and collaboration platform for humans and AI agents.

[![CI](https://github.com/Maless88/rb/actions/workflows/ci.yml/badge.svg)](https://github.com/Maless88/rb/actions/workflows/ci.yml)
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
- **MCP agent access** — 10 tools for agents to read and write project state via Model Context Protocol
- **Web dashboard** — project status, task management, and memory entries via browser
- **Async job layer** — background refresh, summary generation, and cleanup via BullMQ
- **Local sync bridge** — offline-first SQLite journal with sync engine to the central database

---

## Architecture

```
apps/
  core-api          NestJS — projects, phases, tasks, memory (port 3001)
  auth-access       NestJS — users, teams, sessions, MCP tokens (port 3002)
  mcp-service       MCP stdio server — 10 tools for agent integration
  web-app           Next.js 15 — dashboard, project detail, task management (port 3000)
  worker-jobs       NestJS + BullMQ — async jobs: refresh, summary, cleanup (port 3003)
  local-sync-bridge NestJS + SQLite — offline-first journal with sync engine (port 3004)

packages/
  domain            shared enums and domain types
  database          Prisma schema, migrations, seed
  auth              password hashing, token utilities
  grants            permission logic
  mcp-contracts     MCP tool schemas
  config            env helpers

infra/
  docker/           docker-compose (PostgreSQL 16, Redis 7)
```

## Stack

- **Runtime**: Node.js 20, TypeScript strict
- **Backend**: NestJS 11 with Fastify adapter
- **Frontend**: Next.js 15 App Router, Tailwind CSS 4
- **Database**: PostgreSQL 16 (Prisma ORM), SQLite (local journal)
- **Queue**: Redis 7 + BullMQ
- **Agent protocol**: MCP (Model Context Protocol) via stdio
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
git clone https://github.com/Maless88/rb.git
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
`auth-access`.

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

| Tool | Description |
|------|-------------|
| `list_projects` | List accessible projects |
| `get_project` | Get project details |
| `list_active_tasks` | List tasks, optionally filtered by status |
| `get_project_memory` | List memory entries |
| `create_task` | Create a new task |
| `update_task_status` | Update task status |
| `create_memory_entry` | Create a memory entry |
| `prepare_task_context` | Full context bundle for a task (project + siblings + memory) |
| `prepare_project_summary` | Project snapshot for agent onboarding |
| `create_handoff` | Structured handoff entry for session continuity |

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
- [docs/planning/](docs/planning/) — architecture and design notes

---

## Current status

Wave 1 is complete. The platform is functional end-to-end: REST APIs, MCP server, web dashboard, async jobs, and local sync bridge are all implemented and tested.

Active work: **Phase 12 — Test Automation Hardening** (unit tests for shared packages, Playwright e2e, CI enforcement).

> The project is pre-beta. No stable release has been published yet. Breaking changes may occur on `main`.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

MIT — see [LICENSE](LICENSE).
