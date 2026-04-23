# Connecting an MCP client to Roadboard

This guide shows how to point Claude Code (or any MCP-compatible client) at a Roadboard instance so an agent can read project state and onboard a repository via `ingest_architecture`.

## 1. Generate an MCP token

1. Log into the web UI
2. Open **Settings → Token MCP**
3. Click **Create new token**, pick a descriptive name (e.g. `claude-code-laptop`)
4. Select the scopes you need. For agent-driven onboarding (pattern B.2) you want:
   - `project.read` — list/inspect projects
   - `project.write` — create projects
   - `project.admin` — required for `create_project`
   - `codeflow.read` — inspect the graph
   - `codeflow.write` — create nodes/edges/links/annotations, and `ingest_architecture`
   - `task.write`, `memory.write`, `decision.write` — if you want the agent to also manage project state
5. Copy the token **immediately** — it is shown only once.

## 2. Configure the MCP client

### Claude Code (recommended path)

Create `.mcp.json` at the repo root (committed per-project) or edit `~/.config/claude/mcp.json` (per-user):

```json
{
  "mcpServers": {
    "roadboard": {
      "type": "http",
      "url": "http://localhost:3005/mcp",
      "headers": {
        "Authorization": "Bearer ROADBOARD_MCP_TOKEN"
      }
    }
  }
}
```

For a remote Roadboard deployment use the public URL (e.g. `https://roadboard.example.com/mcp`).

An example file is checked in as [`.mcp.json.example`](../.mcp.json.example) — copy it and fill in the token.

### Other MCP clients (Cursor, Continue, etc.)

Most clients follow the same `mcpServers` convention. Look for an entry that accepts an HTTP URL and an Authorization header; the payload format is identical.

## 3. Verify the connection

Restart the MCP client. It should discover 23 tools; `list_projects` is the quickest smoke test:

```
agent> list_projects
→ returns the array of projects your token can see
```

## 4. Onboard a repository (the B.2 flow)

Once connected, tell the agent:

> "Onboard this repository into Roadboard project `<slug>`. Read the workspaces from `apps/*/package.json` and `packages/*/package.json`, build the dependency graph, and send it in a single `ingest_architecture` call. For each node, add a one-sentence semantic annotation based on what you read in the README and the handoff memory entries."

The agent will:

1. Use its native `Read` / `Glob` tools to scan your local filesystem
2. Build a single manifest `{repository, nodes[], edges[]}`
3. Call `ingest_architecture(projectId, manifest)` — one HTTP round-trip
4. Optionally add more annotations or link nodes to existing tasks/decisions with `create_architecture_annotation` / `create_architecture_link`

The server never sees your source code — only the graph summary and annotations you chose to send.

## Scope cheatsheet

| You want the agent to... | Scopes needed |
|---|---|
| Read graphs and project state | `project.read`, `codeflow.read` |
| Create new projects | `project.admin` |
| Populate or update a codeflow graph | `codeflow.write` |
| Manage tasks / memory / decisions | `task.write`, `memory.write`, `decision.write` |
| Full agent autonomy | all of the above |

Never grant `token.manage` to an agent token — only humans should rotate credentials.

## Related

- [`docs/atlas-manual-use.md`](atlas-manual-use.md) — how the Atlas tab renders what the agent produces
- Decision `cmoa0zt18` — graph DB migration to Memgraph (CF-GDB-03 phase 1 landed 2026-04-23)
