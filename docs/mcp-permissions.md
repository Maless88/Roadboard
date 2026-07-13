# MCP Permissions — Scopes vs Grants

This document explains the two parallel authorization mechanisms that protect MCP tool calls, how they interact, and how to diagnose a 403 Forbidden response.

---

## Overview

A single MCP tool call passes through **two independent authorization gates**:

1. **Scope check** — performed in `mcp-service` before the call is forwarded to `core-api`
2. **Grant check** — performed in `core-api` via `GrantCheckGuard` for every endpoint that is annotated with `@RequireGrant(...)`

Both gates must pass. A token that has the right scope but whose owner lacks the required `ProjectGrant` will still receive a 403 at the grant check.

---

## Gate 1 — Scopes

### What they are

Scopes are a string array stored on the `McpToken` record in the database, e.g.:

```json
["project.read", "task.write", "memory.write"]
```

They are set when the token is created and never change at runtime.

### Where the check happens

`apps/mcp-service/src/main.ts` — the `checkScope()` function, called for every tool invocation:

```typescript
function checkScope(toolName: string, allowedScopes: string[]): string | null
```

If the required scope is not present in `allowedScopes`, the call is rejected immediately with an error message — `core-api` is never reached.

The scope `project.admin` is a wildcard that satisfies any scope requirement (checked via `allowedScopes.includes("project.admin")`).

### Tool → required scope mapping

| Scope | Tools |
|---|---|
| `project.read` | `list_projects`, `list_teams`, `get_project`, `get_user`, `list_active_tasks`, `list_phases`, `get_project_memory`, `prepare_task_context`, `prepare_project_summary`, `get_project_changelog`, `search_memory`, `list_recent_decisions`, `list_skills`, `read_inbox`, `list_events`, `list_scheduled_activities` |
| `task.write` | `create_task`, `update_task`, `update_task_status`, `delete_task` |
| `project.write` | `create_phase`, `update_phase`, `attach_skill`, `detach_skill`, `sync_skills_catalog`, `mark_read`, `create_draft`, `create_event`, `delete_event`, `notify`, `create_scheduled_activity`, `create_reminder`, `pause_scheduled_activity`, `delete_scheduled_activity` |
| `memory.write` | `create_memory_entry`, `create_handoff` |
| `decision.write` | `create_decision`, `update_decision` |
| `project.admin` | `create_project` |
| `codeflow.read` | `get_architecture_map`, `get_node_context`, `get_architecture_snapshot` |
| `codeflow.write` | `create_architecture_repository`, `create_architecture_node`, `create_architecture_edge`, `create_architecture_link`, `create_architecture_annotation`, `ingest_architecture`, `link_task_to_node` |

The tool `initial_instructions` requires no scope (it is in `NO_SCOPE_TOOLS`).

---

## Gate 2 — Grants

### What they are

`ProjectGrant` is a database record that binds a **subject** (user or team) to a **project** with a specific **grant type**, e.g.:

```
(userId=abc, projectId=xyz, grantType=MEMORY_WRITE)
```

Grants are checked **per-project** — a token owner may have `memory.write` on project A but not on project B.

### Where the check happens

`apps/core-api/src/common/grant-check.guard.ts` — `GrantCheckGuard` calls the `auth-access` service at `/grants/check` with the `(subjectId, projectId, grantType)` tuple and rejects the request if `allowed` is `false`.

The `projectId` is resolved from the request body, query string, route params, or — for resource-level routes like `PATCH /tasks/:id` — via a database lookup on the task/phase record.

### Grant types and their scope equivalents

The `GrantType` enum maps directly to scope strings:

| GrantType | Scope string |
|---|---|
| `PROJECT_READ` | `project.read` |
| `PROJECT_WRITE` | `project.write` |
| `TASK_WRITE` | `task.write` |
| `MEMORY_WRITE` | `memory.write` |
| `DECISION_WRITE` | `decision.write` |
| `DASHBOARD_READ` | `dashboard.read` |
| `TOKEN_MANAGE` | `token.manage` |
| `PROJECT_ADMIN` | `project.admin` |
| `CODEFLOW_READ` | `codeflow.read` |
| `CODEFLOW_WRITE` | `codeflow.write` |
| `CODEFLOW_SCAN` | `codeflow.scan` |

### PROJECT_ADMIN wildcard

`hasPermission()` in `packages/grants/src/permissions.ts` treats `PROJECT_ADMIN` as a wildcard:

```typescript
return grants.some(
  (g) =>
    g.projectId === projectId &&
    (g.grantType === requiredGrant || g.grantType === GrantType.PROJECT_ADMIN),
);
```

A subject with `PROJECT_ADMIN` on a project passes every grant check for that project.

---

## Demo seed — grants created at signup

`packages/demo-seed/src/apply.ts` creates exactly two `ProjectGrant` records for the demo project generated at signup:

| Subject | Grant type |
|---|---|
| Team (`subjectType=TEAM`) | `PROJECT_ADMIN` |
| User (`subjectType=USER`) | `PROJECT_ADMIN` |

Because `PROJECT_ADMIN` is a wildcard, these two grants cover all MCP tool categories:

| MCP tool category | Required scope | Covered by PROJECT_ADMIN? |
|---|---|---|
| Project read | `project.read` | Yes |
| Task write | `task.write` | Yes |
| Project write | `project.write` | Yes |
| Memory write | `memory.write` | Yes |
| Decision write | `decision.write` | Yes |
| CodeFlow read | `codeflow.read` | Yes |
| CodeFlow write | `codeflow.write` | Yes |
| Project admin | `project.admin` | Yes (exact match) |

No gaps: the demo seed grants are sufficient for all MCP operations on the demo project.

---

## Authorization flow — step by step

```
AI agent → mcp-service (stdio/HTTP)
    │
    ▼
1. Token lookup: McpToken.scopes extracted from DB
2. checkScope(toolName, token.scopes)
       → 403 "Insufficient scope" if scope missing
    │
    ▼
3. tool handler calls core-api REST endpoint
4. GrantCheckGuard reads @RequireGrant() decorator
5. resolveProjectId() finds the projectId for this request
6. HTTP GET auth-access /grants/check?subjectId=...&projectId=...&grantType=...
       → 403 "Insufficient permissions" if no matching ProjectGrant
    │
    ▼
7. Business logic executes
```

---

## Diagnosing a 403

Follow this checklist in order:

### Step 1 — Identify which gate rejected

- Error message `"Insufficient scope: tool '...' requires '...'"` → **Gate 1** (scope). Fix: re-issue the token with the missing scope.
- Error message `"Insufficient permissions"` with `requiredGrant` and `projectId` in the body → **Gate 2** (grant). Fix: create or verify the `ProjectGrant`.
- Error message `"Grant check service unavailable"` → **auth-access** is down or unreachable.

### Step 2 — Check the token scopes (Gate 1)

Query the database:

```sql
SELECT id, name, scopes, "userId"
FROM "McpToken"
WHERE id = '<token-id>';
```

Verify the `scopes` array contains the scope required by the tool (see table above). If missing, delete and re-create the token with the correct scopes.

### Step 3 — Check the ProjectGrant (Gate 2)

```sql
SELECT *
FROM "ProjectGrant"
WHERE "subjectId" = '<userId>'
  AND "projectId" = '<projectId>';
```

Verify at least one row has `grantType` matching the required grant **or** `grantType = 'PROJECT_ADMIN'`.

Common root cause: the `userId` stored on the `McpToken` differs from the `userId` stored on the `ProjectGrant`. This happens when a token is created for one user account but the project is owned by a different user. Check:

```sql
SELECT "userId" FROM "McpToken" WHERE id = '<token-id>';
SELECT "subjectId" FROM "ProjectGrant" WHERE "projectId" = '<projectId>';
```

Both values must match for the grant check to pass.

### Step 4 — Create a missing grant

```sql
INSERT INTO "ProjectGrant" ("id", "projectId", "subjectType", "subjectId", "grantType", "grantedByUserId", "createdAt")
VALUES (gen_random_uuid(), '<projectId>', 'user', '<userId>', 'PROJECT_ADMIN', '<adminUserId>', now());
```

Alternatively, use the API or Prisma Studio (`pnpm --filter @roadboard/database db:studio`).

---

## See also

- `apps/mcp-service/src/main.ts` — `TOOL_REQUIRED_SCOPES` and `checkScope()`
- `apps/core-api/src/common/grant-check.guard.ts` — `GrantCheckGuard`
- `packages/grants/src/permissions.ts` — `hasPermission()` with `PROJECT_ADMIN` wildcard
- `packages/demo-seed/src/apply.ts` — grants created at demo project signup
- `docs/atlas-manual-use.md` — grants required for Atlas / CodeFlow operations
