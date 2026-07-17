# Connecting an MCP client to Roadboard

> **Per setup interattivo usa il wizard a [/mcp-guide](/mcp-guide).
> Questo doc è la reference dettagliata.**

This guide shows how to point Claude Code, Zed, VS Code, or Codex CLI at a Roadboard instance so an agent can read project state and onboard a repository via `ingest_architecture`.

The MCP server exposes tools via Streamable HTTP on port 3005. By default it uses
`MCP_TOOL_PROFILE=full`, which keeps the full 50-tool catalog for compatibility.
For lower bootstrap token usage in normal project work, run the service with
`MCP_TOOL_PROFILE=workflow`; that profile exposes only project, phase, task,
memory, decision, handoff, and essential context tools. Other valid profiles are
`atlas` for architecture/CodeFlow tools and `personal` for email, calendar,
notifications, and scheduling.

Tools outside the active profile do not appear in `tools/list` and cannot be
called directly by name.

Changing `MCP_TOOL_PROFILE` requires restarting `mcp-service`.

Aggregate helper responses remain backward-compatible: legacy collections such as
`memory`, `active_phases`, `urgent_tasks`, `open_decisions`, and
`recent_decisions` are still arrays. They may be bounded and compact; read
`collection_metadata` for `total`, `returned`, and `nextCursor`, and read
`truncation` before assuming the returned arrays are complete.
For `prepare_project_summary.open_tasks`, pass
`collection_metadata.open_tasks.nextCursor` back as `taskCursor` to continue the
same globally ordered multi-status task page.

Live MCP integration tests require running `auth-access` and `core-api`; enable
them with `RB_RUN_LIVE_MCP_INTEGRATION=1 pnpm --filter @roadboard/mcp-service
test:integration`. Without that env var, the dedicated command still verifies
test discovery and skips the live cases.

## 1. Generate an MCP token

1. Log into the web UI.
2. Open **Settings → Token MCP**.
3. Click **Create new token**, pick a descriptive name (e.g. `claude-code-laptop`).
4. Select the scopes you need. For agent-driven onboarding (pattern B.2) you want:
   - `project.read` — list/inspect projects
   - `project.write` — create projects
   - `project.admin` — required for `create_project`
   - `codeflow.read` — inspect the graph
   - `codeflow.write` — create nodes/edges/links/annotations, and `ingest_architecture`
   - `task.write`, `memory.write`, `decision.write` — if you want the agent to also manage project state
5. Copy the token **immediately** — it is shown only once.

---

## 2. Configure the MCP client

### Claude Code

**User-scope** (accessible from all projects on the machine): `~/.claude.json`

**Project-scope** (committed per-project): `.mcp.json` at the repo root

```json
{
  "mcpServers": {
    "roadboard": {
      "type": "http",
      "url": "http://localhost:3005/mcp",
      "headers": {
        "Authorization": "Bearer <YOUR_MCP_TOKEN>"
      }
    }
  }
}
```

> Note: `type: "http"` is required by Claude Code. The user-scope file is `~/.claude.json`
> (not `~/.claude/settings.json` — that file is for other preferences).

An example file is checked in as [`.mcp.json.example`](../.mcp.json.example) — copy it and fill in the token.

---

### Zed

File: `~/.config/zed/settings.json` (Linux/macOS) or `%APPDATA%\Zed\settings.json` (Windows).

**HTTP transport (recommended):**

```json
{
  "context_servers": {
    "roadboard": {
      "enabled": true,
      "url": "http://localhost:3005/mcp",
      "headers": {
        "Authorization": "Bearer <YOUR_MCP_TOKEN>"
      }
    }
  }
}
```

**stdio via mcp-remote (fallback):**

```json
{
  "context_servers": {
    "roadboard": {
      "enabled": true,
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:3005/mcp", "--header", "Authorization: Bearer <YOUR_MCP_TOKEN>"],
      "env": {}
    }
  }
}
```

> The old schema with `source: "custom"` + nested `transport: { type, url, headers }` is deprecated.
> Use the flat `url`/`headers` form shown above. `enabled: true` is required.

---

### VS Code (native MCP — Copilot Agent / Chat)

VS Code 1.99+ supports MCP natively. The `chat.mcp.enabled` flag is obsolete (MCP is GA).

**User-scope:** `~/.config/Code/User/mcp.json` (Linux), `~/Library/Application Support/Code/User/mcp.json` (macOS), `%APPDATA%\Code\User\mcp.json` (Windows)

**Workspace-scope (share with team):** `.vscode/mcp.json` in the repo root

```json
{
  "mcpServers": {
    "roadboard": {
      "url": "http://localhost:3005/mcp",
      "headers": {
        "Authorization": "Bearer <YOUR_MCP_TOKEN>"
      }
    }
  }
}
```

> **Two independent MCP systems in VS Code**: the native one (Copilot Agent / Chat, configured via
> `mcp.json`) and the Claude Code extension (configured via `~/.claude.json`, the same file as the CLI).
> Do not duplicate the config — add it only to the system you use.

---

### Codex CLI

Codex uses **TOML**, not JSON. File: `~/.codex/config.toml` (Linux/macOS) or `%APPDATA%\Codex\config.toml` (Windows).

**HTTP (recommended):**

First, set the environment variable in your shell profile:

```bash
# bash / zsh
export ROADBOARD_MCP_TOKEN="<YOUR_MCP_TOKEN>"
# add to ~/.bashrc or ~/.zshrc to persist

# fish
set -x ROADBOARD_MCP_TOKEN "<YOUR_MCP_TOKEN>"
# add to ~/.config/fish/config.fish
```

Then configure `~/.codex/config.toml`:

```toml
[mcp_servers.roadboard]
url = "http://localhost:3005/mcp"
bearer_token_env_var = "ROADBOARD_MCP_TOKEN"

# Optional: per-tool approval gating
# [mcp_servers.roadboard.tools.roadboard_update_task_status]
# approval_mode = "approve"
```

> Best practice: use `bearer_token_env_var` instead of embedding the token inline with `bearer_token`.

**stdio (alternative, for local MCP servers):**

```toml
[mcp_servers.my-local-server]
command = "/path/to/mcp-binary"
args = ["start"]
env = { KEY = "value" }
```

---

## 3. Verify the connection

Restart the MCP client. With the default profile it should discover 50 tools (see [Tool profiles](#tool-profiles) below); `list_projects` is the quickest smoke test:

```
agent> list_projects
→ returns the array of projects your token can see
```

For Claude Code you can also run `/mcp` to list all connected servers and their tool counts.

### Tool profiles

How many tools the server exposes is chosen **server-side** at startup via the `MCP_TOOL_PROFILE` environment variable — it is not negotiated per client. A given `mcp-service` instance exposes exactly one profile to every client that connects.

| `MCP_TOOL_PROFILE` | Tools | Use |
|--------------------|-------|-----|
| `full` (default)   | 50    | Backwards-compatible full set |
| `workflow`         | 21    | Agents executing tasks (compact context) |
| `atlas`            | 16    | CodeFlow / architecture work |
| `personal`         | 13    | Personal project management |

Notes:

- Unset or `full` → all 50 tools; this is what a default client sees.
- A tool omitted by the active profile is unavailable even if the client knows its name — calling it returns a clear "not available in MCP_TOOL_PROFILE=…" error.
- Pick a compact profile to reduce the tool-schema context sent to the model. To do so, start the `mcp-service` instance with e.g. `MCP_TOOL_PROFILE=workflow`.

---

## 4. Onboard a repository (the B.2 flow)

Once connected, tell the agent:

> "Onboard this repository into Roadboard project `<slug>`. Read the workspaces from `apps/*/package.json` and `packages/*/package.json`, build the dependency graph, and send it in a single `ingest_architecture` call. For each node, add a one-sentence semantic annotation based on what you read in the README and the handoff memory entries."

The agent will:

1. Use its native `Read` / `Glob` tools to scan your local filesystem.
2. Build a single manifest `{repository, nodes[], edges[]}`.
3. Call `ingest_architecture(projectId, manifest)` — one HTTP round-trip.
4. Optionally add more annotations or link nodes to existing tasks/decisions with `create_architecture_annotation` / `create_architecture_link`.

The server never sees your source code — only the graph summary and annotations you chose to send.

---

## Scope cheatsheet

| You want the agent to...             | Scopes needed                                     |
|--------------------------------------|---------------------------------------------------|
| Read graphs and project state        | `project.read`, `codeflow.read`                   |
| Create new projects                  | `project.admin`                                   |
| Populate or update a codeflow graph  | `codeflow.write`                                  |
| Manage tasks / memory / decisions    | `task.write`, `memory.write`, `decision.write`    |
| Full agent autonomy                  | all of the above                                  |

Never grant `token.manage` to an agent token — only humans should rotate credentials.

---

## Related

- [`docs/atlas-manual-use.md`](atlas-manual-use.md) — how the Atlas tab renders what the agent produces
- Decision `cmoa0zt18` — graph DB migration to Memgraph (CF-GDB-03 phase 1 landed 2026-04-23)
