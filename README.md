# RoadBoard 2.0

Multi-project execution, memory, and collaboration platform for humans and AI agents.

RoadBoard is a TypeScript monorepo that exposes a REST API, an MCP server (Model Context Protocol), a web UI, and an async job layer — designed so that agents and humans share the same project state.

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

# Start infrastructure
docker compose -f infra/docker/docker-compose.yml up -d

# Run migrations and seed
pnpm db:migrate
pnpm db:seed

# Build all packages
pnpm build
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

## Roadmap

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
| 12 | Test Automation Hardening | in progress |

---

## License

MIT — see [LICENSE](LICENSE).
