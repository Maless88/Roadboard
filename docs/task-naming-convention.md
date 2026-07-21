# Task Naming Convention — RoadBoard 2.0

## Format

```
Area — Brief human-readable description
```

- **Area**: one of the canonical area names (see §Area Map below).
- **Separator**: ` — ` (space + em dash + space).
- **Description**: plain prose, title-case optional, no code prefixes or ticket IDs.

### Canonical areas

| Area                    | Covers                                                         |
|-------------------------|----------------------------------------------------------------|
| Atlas                   | Architecture graph, CodeFlow nodes, domain grouping, impact    |
| Memgraph                | Graph DB schema, Cypher migrations, mirror jobs                |
| CodeFlow Stabilization  | Drift validation, outbox audit, impact pre-computation         |
| Workspaces              | Team management, invite flow, multi-tenant settings            |
| Audit & Compliance      | AuditEvent logging, audit tab, compliance reports              |
| MCP Guide               | /mcp-guide wizard, MCP client setup docs                       |
| UX & Vibe Coding        | UI polish, empty states, toasts, skeletons, i18n               |
| Project Discovery       | Project cards, thumbnails, onboarding wizard                   |
| AI Assistant            | Chatbot multi-provider, AI settings                            |

---

## Examples

### Positive (correct)

1. `Atlas — Impact view generalizzata nel node-drawer`
2. `Memgraph — Test integration outbox + worker su DB reale`
3. `Atlas — Integra architecture snapshot in create_handoff`
4. `Atlas — Agent Context panel (snapshot viewer + copy-to-clipboard)`
5. `Atlas — Decision-Aware Graph sub-view con badges link-type`
6. `Atlas — Tool get_architecture_snapshot per agent handoffs`
7. `Memgraph — Swap reads CodeFlow su Memgraph + retire Postgres graph tables`
8. `Memgraph — Refactor GraphService: backend graph DB + data migration`
9. `Memgraph — Impact analysis reverse-BFS nativa + update MCP tool`
10. `Workspaces — Invite flow: invita utente al team, lista pending, accept page`
11. `Audit & Compliance — Popolare AuditEvent + riabilitare tab Audit`
12. `Atlas — Review adozione link task↔node dopo 2-3 settimane`

### Negative (legacy — do not use)

1. `[CF-17R] Impact view generalizzata in node-drawer (qualsiasi ArchitectureNode)` — bracket prefix
2. `[CF-GDB-03b-7] Test integration outbox + worker contro Memgraph reale` — bracket + internal code
3. `CF-GDB-03b — Swap CodeFlow reads to Memgraph` — code prefix without brackets
4. `[W4-06] web-app: invite flow — invite user to team` — bracket + service prefix
5. `[audit-01] core-api: popolare AuditEvent` — lowercase code prefix

---

## Regex — legacy title detection

A title is considered **legacy** if it matches:

```regex
^\[?([A-Za-z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)+)\]?\s*(?:—|-|:)?\s*
```

Examples that match (must be renamed):
- `[CF-GDB-03b-7] …`
- `CF-17R — …`
- `[W4-06] …`
- `[audit-01] …`
- `[CF-AGENT-01c] …`

Examples that do NOT match (already compliant):
- `Atlas — Impact view generalizzata`
- `Memgraph — Swap reads to graph DB`
- `Settings → tab Usage: consumo token per utente`

---

## Area Map — code prefix to area

Maintained in `scripts/area-map.json`. Lookup order:

1. Exact match on the full code token (e.g. `CF-GDB-03b` → `Memgraph`).
2. Longest-matching prefix (e.g. `CF-GDB-*` → `Memgraph` before `CF-*` → `Atlas`).

For unknown prefixes, the rename script emits a warning and skips the task.
Add new prefixes to `scripts/area-map.json` before running `--apply`.

---

## Retrofit tooling

```bash
# Preview renames (no writes)
tsx scripts/rename-active-tasks.ts --dry-run

# Apply renames on roadboard-2
tsx scripts/rename-active-tasks.ts --apply
```

Env vars required:
- `ROADBOARD_API_URL` — e.g. `http://localhost:3001`
- `ROADBOARD_API_TOKEN` — bearer token with `task:write` scope

---

## Enforcement

- **MCP soft warning**: `checkLegacyTitle` (`@roadboard/mcp-contracts`) is invoked by `apps/mcp-service/src/main.ts` on `create_task` and `create_phase`, surfacing a `warning` in the tool result when the title matches the legacy regex. Not invoked on `update_task`.
- **Retrofit**: script targets `todo` + `in_progress` tasks only. `done` tasks are historical and kept as-is.
- **New tasks**: always use `Area — description` from creation. No exceptions.
