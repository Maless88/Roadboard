@CLAUDE.md

# Codex / ChatGPT Analyst Startup

This project uses Codex/ChatGPT primarily as an Analyst and Claude Code as the Architect/Worker coordinator.

Before answering "what is there to do?", proposing work, or preparing a brief, verify the current project state:

1. Read `CLAUDE.md` enough to apply the project workflow.
2. Check RoadBoard state when tools are available.
3. Inspect `PLAN.md` for unchecked tasks and active milestones.
4. Inspect task folders:
   - `tasks/briefs/` contains Analyst briefs waiting for Architect review.
   - `tasks/for-analyst/` contains Architect questions, findings, or proposals waiting for Analyst review.
   - `tasks/todo/` contains Architect-verified Worker prompts.
   - `tasks/run/` contains Worker prompts in progress.
   - `tasks/done/` contains Worker prompts declared complete.
5. Run `git status --short` before making claims about repository state.

Codex may create Analyst briefs in `tasks/briefs/` for non-trivial planning work. Codex should not create Worker prompts in `tasks/todo/` unless the developer explicitly asks; Claude Architect owns final prompt creation after verifying repository state, RoadBoard state, `PLAN.md`, docs, and source code.

Use `docs/AI-WORKFLOW.md` for the project-specific collaboration flow and `docs/templates/` for brief and prompt templates.

For design exploration where the Developer wants Analyst↔Architect iteration but explicitly does not want Worker prompts, use:

```bash
pnpm agent:workflow run --slug <slug> --planning-only
```

`--planning-only` allows briefs, Architect questions, and proposals, but forbids new files in `tasks/todo/`.

## Analyst interaction protocol

Analyst (Codex/ChatGPT) communicates with Architect (Claude Code) through the task folder contract. The interface is strictly file-based:

- **Analyst writes to**: `tasks/briefs/` — planning briefs, review responses, corrections.
- **Analyst reads from**: `tasks/for-analyst/` — Architect questions, findings, and proposals awaiting review; `tasks/proposals/` — formal Architect proposals before Worker prompt creation.
- **Analyst never**: moves files between `tasks/` lifecycle folders (`todo/` → `run/` → `done/`), creates Worker prompts in `tasks/todo/` without explicit Developer instruction, triggers Worker subagent spawns, or updates RoadBoard task statuses.

The Analyst↔Architect loop is async and may iterate multiple times before any Worker prompt is created. Analyst briefs are planning inputs — Architect verifies every brief against repository state and RoadBoard before converting it into a Worker prompt. A file appearing in `tasks/briefs/` does not automatically trigger any action; Architect pulls from that inbox when ready.
