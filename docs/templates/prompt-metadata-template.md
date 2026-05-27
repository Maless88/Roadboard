# Prompt Metadata Template

Worker prompts do not use parsed YAML frontmatter. Instead, include an optional metadata block as a fenced YAML code block immediately after the `## Context` heading to make machine-readable fields available to the CLI and to tooling.

## Usage

Place the block at the top of the `## Context` section, before any prose:

```yaml
# Prompt metadata — parsed by the workflow CLI; all fields are optional
taskId: ""           # RoadBoard task ID (e.g. cmpkyxo1d0019ny01atevk927)
phaseId: ""          # RoadBoard phase ID (e.g. cmpkyp47c0015ny01mbuyzld7)
roadboard-project: ""# RoadBoard project slug or ID
complexity: S        # S | M | L — used for subagent model selection heuristic
depends-on: []       # list of prompt slugs that must be in tasks/done/ before this runs
stop-point: false    # true → Worker must pause and request human review before continuing
```

## Field Reference

| Field | Type | Description |
|-------|------|-------------|
| `taskId` | string | RoadBoard task ID. Used by the CLI to auto-update task status. |
| `phaseId` | string | RoadBoard phase ID. Cross-checked against the task on spawn. |
| `roadboard-project` | string | RoadBoard project slug. Scopes all RoadBoard writes. |
| `complexity` | `S` / `M` / `L` | Drives Architect's subagent model selection (S/M → Sonnet, L → Opus). |
| `depends-on` | list of strings | Prompt slugs (without path or `.md`) that must be done before this prompt can start. |
| `stop-point` | boolean | When `true`, Worker pauses before the first destructive action and awaits explicit developer approval. |

## Notes

- All fields are optional. Omit the entire block if no metadata is needed.
- The block is ignored at runtime if the CLI is not present — Worker reads it as plain Markdown.
- Do not add fields not listed here; unknown fields are silently ignored by the CLI.
