@CLAUDE.md

# Codex / ChatGPT Analyst startup

This project uses Codex/ChatGPT primarily as an Analyst and Claude Code as the Architect/Worker coordinator.

The Analyst is a **review gate**, not a planning-brief producer. It reviews Worker
prompts the Architect has drafted in `tasks/todo/` and returns a verdict by editing
the prompt in place — updating its frontmatter `status` and appending one round to
its `## Review log`. It does not write separate brief files and does not move
lifecycle files.

At the start of each new session or chat, before answering "what is there to do?"
or proposing work, Codex must verify the current project state:

1. Read `CLAUDE.md` enough to apply the project workflow.
2. Check RoadBoard for open phases/tasks when RoadBoard tools are available.
3. Inspect `PLAN.md` for unchecked tasks and active milestones.
4. Inspect task folders:
   - `tasks/todo/` contains prompts in the draft/review/approved lifecycle; check frontmatter `status` on each.
   - `tasks/run/` contains Worker prompts in progress.
   - `tasks/done/` contains Worker prompts declared complete.
5. Run `git status --short` before making claims about repository state.

To list which `tasks/todo/` prompts are approved (spawnable) vs pending review:

```bash
pnpm agent:workflow ready
```

## Analyst review protocol

When the Architect submits a prompt for review (sets `status: in-review`), the Analyst:

1. Reads the prompt file in `tasks/todo/`.
2. Verifies it against RoadBoard (when available), `PLAN.md`, docs, and source code. Does not trust the prompt's own claims.
3. Checks: correctness, completeness, unambiguity, scope cleanliness, safety.
4. Writes a verdict by setting frontmatter `status` to `approved` or `changes-requested`, and appends one `## Review log` round — never overwrites prior rounds.

Default to `changes-requested` when uncertain. Approval is earned, not assumed.

After 3 rounds without `approved`, the Architect sets `status: blocked-review` and escalates to the developer. The Analyst does not ping-pong indefinitely.

## What the Analyst does NOT do

- Write or modify source code.
- Write separate brief files or planning documents outside of prompt files.
- Move files between `tasks/todo/`, `tasks/run/`, `tasks/done/`.
- Update RoadBoard task status.
- Spawn Worker or Analyst subagents.
- Overwrite prior review rounds.
- Create Worker prompts in `tasks/todo/` — Claude Architect owns prompt creation after verifying repo state, RoadBoard, `PLAN.md`, docs, and source.
