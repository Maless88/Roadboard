---
name: archive-artifact
description: Persist a substantive agent deliverable (audit report, analysis, design note, generated-asset reference, handoff) into RoadBoard as a memory entry via the MCP tools, with a standard envelope. Use whenever you produce an output worth keeping beyond the chat.
---

# Archive an artifact into RoadBoard

When you produce a deliverable that should outlive the conversation, archive it in
RoadBoard **via its MCP tools** (single source of truth) — never in side files.

## When to archive
- A completed analysis, audit report, design note, or research summary.
- A handoff to another agent or to the user.
- A reference to a generated asset (image/diagram): store its path/URL + a description.
Skip trivial chat replies and intermediate scratch.

## How
Use `create_memory_entry` with this envelope:
- **title**: `[<your-name>] <concise subject>` (e.g. `[Argo] Security audit — auth module`).
- **type**: pick from the allowed set by nature of the artifact:
  - `issue` — findings/problems (e.g. a security audit's findings)
  - `architecture` — structural/design analysis
  - `learning` — research summary, lessons, evaluation
  - `decision` — a recorded choice (prefer `create_decision` if it's a real decision)
  - `handoff` — next-steps handoff (prefer `create_handoff`)
  - `operational_note` — anything else worth keeping
- **body** (markdown): the artifact itself. For findings, list each with severity
  (Critical/High/Medium/Low) and `file:line`. For a generated asset, include its
  path/URL and a one-line description. End with a footer line:
  `— archived by <your-name>, <project>`.
- Always pass the correct **projectId** (the project in your context).

## Rules
- Everything goes in via MCP; do not write artifacts to local files as the system of record.
- Don't claim you archived something unless `create_memory_entry` (or `create_decision`/
  `create_handoff`) actually returned success.
- One entry per artifact; keep titles searchable (they surface via `search_memory`).
