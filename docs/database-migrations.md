# Database migrations — safe process & the raw-SQL tables

Status: operational reference (2026-07-22).

## TL;DR — never run `prisma migrate dev` on this repo

Five tables exist in the database (created by committed migration SQL) but are **not** modeled in `packages/database/prisma/schema.prisma`. `prisma migrate dev` treats any table it can't see in the schema as drift and will **DROP it** — these tables currently hold live data. Use the additive-isolated migration process below instead.

- ✅ `pnpm db:migrate` (applies pending migrations) — safe.
- ✅ Hand-authored / diff-based additive migrations (see below) — safe.
- ❌ `prisma migrate dev` — **destructive here**, it will offer to drop the raw tables (data loss).
- ❌ `prisma db push` — forbidden repo-wide (see CLAUDE.md).

## The five raw-SQL tables (not Prisma models)

These are created via raw `CREATE TABLE IF NOT EXISTS` inside migration `.sql` files and queried via `$queryRawUnsafe` / `$executeRawUnsafe` in core-api. They are deliberately **outside** the Prisma schema:

| Table | Created by migration | Why it's not a Prisma model |
|-------|----------------------|-----------------------------|
| `agent_memories` | `20260628190000_add_agent_memories` | pgvector: `embedding vector(768)` + `hnsw` (`vector_cosine_ops`) and `gin` FTS indexes — Prisma cannot express vector columns or hnsw/gin operator-class indexes |
| `skills_catalog` | `20260627100000_add_agent_skills` | raw table shipped alongside the vector work; kept raw for consistency |
| `agent_skills` | `20260627100000_add_agent_skills` | as above |
| `agent_notifications` | `20260627190000_add_agent_notifications` | as above |
| `device_tokens` | `20260706100000_add_device_tokens` | as above |

Consumers: `apps/core-api/src/modules/agents/agent-memory.service.ts` (pgvector similarity via `embedding <=> $1::vector`), `skills.service.ts`, `notifications/push.service.ts`, `notifications/notifications.service.ts`.

Because they are created by committed migrations, a **fresh setup is not broken**: `pnpm db:migrate` (migrate deploy) creates them. The only hazard is `migrate dev`, which compares the DB against `schema.prisma` (where they are absent) and proposes dropping them.

## Why not just model them in `schema.prisma`?

- `agent_memories` cannot be modeled cleanly: `vector(768)` needs `Unsupported("vector(768)")`, and the `hnsw`/`gin` operator-class indexes have **no Prisma representation** — so `migrate dev` would still want to drop/recreate those indexes even after modeling the table.
- The other four are plain tables and *could* be introspected into models later, but doing so piecemeal buys little while `agent_memories` remains raw. Reconciliation is deferred, not required for correctness.

The tables work correctly today; this is a tooling-ergonomics gap (unsafe `migrate dev`), not a data-integrity bug.

## Adding a new migration safely (the additive-isolated process)

When you change `schema.prisma` (adding a normal Prisma model/field) and need a migration, do NOT use `migrate dev`. Instead:

1. Edit `schema.prisma`.
2. Generate the SQL for just your change without touching the raw tables:
   ```bash
   # from repo root; DB up on :5433
   pnpm --filter @roadboard/database exec prisma migrate diff \
     --from-schema-datasource prisma/schema.prisma \
     --to-schema-datamodel prisma/schema.prisma \
     --script > /tmp/next.sql
   ```
   (or hand-author the `ALTER TABLE` / `CREATE TABLE` for your change — v1's `20260721170000_chatroom_persistent_summary` is a clean example: a plain additive `ALTER TABLE`.)
3. Create the migration directory `packages/database/prisma/migrations/<timestamp>_<name>/migration.sql` with that SQL, apply it (`prisma db execute --file ...` against the dev DB), and mark it applied:
   ```bash
   pnpm --filter @roadboard/database exec prisma migrate resolve --applied <timestamp>_<name>
   ```
4. `pnpm db:generate` so the Prisma client types include your change.
5. Verify: `pnpm --filter @roadboard/database exec prisma migrate status` → "Database schema is up to date!".
6. Commit the migration directory + schema change.

`pnpm db:migrate` (migrate deploy) then applies your migration on other environments as usual.

## Deferred cleanup (optional, not urgent)

If the raw/schema split becomes painful, a future task can introspect the four non-vector tables into Prisma models (leaving `agent_memories` raw with an `Unsupported` column and documented raw indexes). Track it separately; it is not required for correct operation.
