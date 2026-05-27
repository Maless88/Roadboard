# AI Workflow

Roadboard uses an Analyst / Architect / Worker model for AI-assisted development.

## Roles

### Developer

Owns product intent, priorities, credentials, deployment, and final acceptance.

### Analyst

Turns goals, repository state, and external research into planning material:

- current-state analysis
- milestone and spec mapping
- task slicing
- risk review
- acceptance criteria
- verification stance
- draft Architect handoff

Analyst output is saved under `tasks/briefs/`. These files are planning inputs, not executable Worker prompts.

Analyst also reviews files under `tasks/for-analyst/`, where Architect can place questions, findings, or proposals that need independent review.

### Architect

Validates Analyst output against the repository, RoadBoard, `PLAN.md`, docs, and source code. Architect owns final Worker prompt creation under `tasks/todo/`, Worker coordination, implementation review, and RoadBoard alignment.

### Worker

Executes exactly one Architect-verified prompt. Worker does not design, expand scope, or chain tasks.

## Flow

The pipeline has two distinct loops: an **async Analyst↔Architect planning loop** that runs to convergence before any Worker is spawned, and a **Worker execution loop** that runs exactly once per verified prompt.

### Analyst↔Architect planning loop (async, multi-iteration)

1. Developer states a goal (may write a goal statement to `tasks/intake/`).
2. Analyst prepares a planning brief under `tasks/briefs/`. This is a planning input, not a Worker prompt.
3. Architect verifies the brief against repo state, RoadBoard, `PLAN.md`, docs, and source files.
4. If Architect has questions, findings, or draft proposals that need Analyst review, it writes them to `tasks/for-analyst/`.
5. For formal design proposals that need Analyst sign-off before Worker prompt creation, Architect writes to `tasks/proposals/`.
6. Analyst reads from `tasks/for-analyst/` and `tasks/proposals/`, writes a review response back to `tasks/briefs/`.
7. **Steps 3–6 repeat as many times as needed.** There is no limit on iteration count. The loop continues until Analyst and Architect converge.
8. Only after planning convergence does Architect create final Worker prompts under `tasks/todo/`. Prompts in `tasks/todo/` are still reviewed once more by Analyst before the loop is considered complete.
9. Analyst performs a final review pass against the intake and latest brief:
   - if the prompts are correct, Analyst writes `tasks/.convergence-<slug>` with `role: "analyst"`;
   - if there are gaps, Analyst writes `tasks/for-analyst/<slug>-q<N>.md` and the loop returns to Architect.
10. After Analyst sign-off, prompts in `tasks/todo/` represent Analyst/Architect consensus — they are not drafts.

For exploratory design work, the loop can be run in planning-only mode:

```bash
pnpm agent:workflow run --slug <slug> --planning-only
```

In planning-only mode, convergence means the analysis or proposal is ready for Developer review. It does not mean Worker prompts are ready, and the runner fails if a new file appears in `tasks/todo/`.

### GO to Worker (manual)

11. Developer reviews `tasks/todo/` (use `pnpm agent:workflow ready` to list lint-passing prompts).
12. **GO to Worker is always a manual action.** The CLI never spawns Workers and never moves files from `todo/` to `run`.
13. Architect moves a prompt from `tasks/todo/` to `tasks/run/` and spawns a Worker subagent.

### Worker execution loop

14. Worker implements and verifies exactly that prompt.
15. Worker moves the prompt to `tasks/done/` when all acceptance criteria pass.
16. Architect reviews the result and updates RoadBoard / `PLAN.md` per `CLAUDE.md`.

### Conversation history in reports

`tasks/reports/` captures the full conversation history for a planning cycle:

- Original request (from `tasks/intake/`)
- Architect proposals (from `tasks/proposals/`)
- Analyst reviews and corrections (from `tasks/briefs/` and `tasks/for-analyst/`)
- Final prompts that reached `tasks/todo/` (normal mode only)
- Blocked or deferred items with reasons

Use `pnpm agent:workflow report --slug <slug>` to generate a report for a completed cycle.

## Folder Contract

```text
tasks/
  intake/       # Developer goal statements (input to Analyst) — local-only, not git-tracked
  briefs/       # Analyst planning briefs, not executable
  for-analyst/  # Architect questions/findings/proposals for Analyst review
  proposals/    # Architect formal proposals awaiting Analyst sign-off — local-only, not git-tracked
  todo/         # Architect-verified Worker prompts (final, after Analyst↔Architect convergence)
  run/          # Worker prompts in progress
  done/         # Completed Worker prompts
  reports/      # Final packaged reports per cycle — local-only, not git-tracked
```

`tasks/` is gitignored. All folders are local operational state only — not repository artifacts. The CLI creates missing folders on first use (mkdir if not exists). No `.gitkeep` files are needed or used.

`tasks/briefs/` and `tasks/for-analyst/` are inboxes, not archives. Delete consumed files after they are converted into the next workflow artifact, unless they are intentionally kept with a short pending note.

`tasks/intake/`, `tasks/proposals/`, and `tasks/reports/` are local-only and not git-tracked. They are ephemeral artifacts of the planning cycle.

Repository state beats memory. RoadBoard and `PLAN.md` state must be verified before planning.

## CLI Reference

All commands are invoked via:

```bash
pnpm agent:workflow <command> [options]
```

| Command | Options | Description |
|---------|---------|-------------|
| `status` | — | Print per-folder `.md` file counts and TASK_LIST.md staleness |
| `intake` | `--slug <slug>` | Create `tasks/intake/<slug>-intake.md` from the developer intake template |
| `lint` | `[--dir <dir>]` | Validate `.md` files in `tasks/<dir>/` (default: `todo`) for required sections and checklist items |
| `report` | `--slug <slug>` | Generate `tasks/reports/<slug>-final-report.md` with the full cycle artifact list |
| `ready` | — | List `.md` files in `tasks/todo/` that pass lint with 0 errors |
| `sync` | — | Regenerate `TASK_LIST.md` from `tasks/todo/`, `tasks/run/`, and `tasks/done/` |
| `run` | `--slug <slug> [--dry-run] [--planning-only]` | Run the Analyst↔Architect loop; `--planning-only` forbids Worker prompt creation |
| `adapters <sub>` | see below | Optional model CLI adapter layer (opt-in, safe by default) |

### Command details

**`status`** — snapshot of the task queue:

```bash
pnpm agent:workflow status
```

Prints counts for all tracked folders (`intake`, `proposals`, `briefs`, `for-analyst`, `todo`, `run`, `done`, `reports`) plus whether `TASK_LIST.md` is missing, stale, or up to date.

**`intake --slug <slug>`** — open a new planning cycle:

```bash
pnpm agent:workflow intake --slug deep-code-scan
```

Creates `tasks/intake/deep-code-scan-intake.md` from `docs/templates/developer-intake-template.md`. Fill in the goal statement and hand it to the Analyst.

**`lint [--dir <dir>]`** — validate prompt files:

```bash
pnpm agent:workflow lint              # lint tasks/todo/
pnpm agent:workflow lint --dir run    # lint tasks/run/
```

Checks for required sections (`## Context`, `## Scope`, `## Acceptance Criteria`, `## Notes`, `## PLAN.md Updates`), at least one checklist item in `## Acceptance Criteria`, and warns when no RoadBoard task reference is found in `## Context`. Exits 1 if any errors are found.

**`report --slug <slug>`** — package a cycle report:

```bash
pnpm agent:workflow report --slug deep-code-scan
```

Creates `tasks/reports/deep-code-scan-final-report.md`. Includes a queue snapshot, links to all planning artifacts matching the slug (intake, proposals, briefs, for-analyst), lint-passing prompts in `tasks/todo/`, and in-progress prompts in `tasks/run/`.

**`ready`** — check what is ready for GO:

```bash
pnpm agent:workflow ready
```

Lists filenames in `tasks/todo/` that pass lint. Use this before manually triggering a Worker spawn.

**`sync`** — regenerate TASK_LIST.md:

```bash
pnpm agent:workflow sync
```

Regenerates `TASK_LIST.md` from the current state of `tasks/todo/`, `tasks/run/`, and `tasks/done/`. Run after moving prompts between folders to keep the list current.

**`run --slug <slug> [--dry-run] [--planning-only]`** — run the Analyst↔Architect loop:

```bash
pnpm agent:workflow run --slug roadboard-local-runtime --planning-only
```

Without flags, `run` invokes the configured Analyst and Architect role binaries from `.agent/workflow-adapters.json` and can converge by creating Worker prompts in `tasks/todo/`.

`--dry-run` prints the commands and prompt sizes without invoking any model CLI.

`--planning-only` keeps the loop in analysis mode. Analyst writes briefs, Architect writes questions or proposals, and the runner fails if a new Worker prompt appears in `tasks/todo/`.

Use `--planning-only` when the Developer wants design exploration, architectural review, or Analyst↔Architect debate before deciding whether to create executable work.

## End-to-end example

Minimal cycle: intake → brief → Architect proposal → for-analyst review → corrections → lint → GO → report.

### 1. Open the cycle

```bash
pnpm agent:workflow intake --slug auth-token-refresh
# → creates tasks/intake/auth-token-refresh-intake.md
```

Fill in the goal statement (what, why, constraints).

### 2. Analyst prepares a brief

Analyst reads `tasks/intake/auth-token-refresh-intake.md`, produces a planning brief:

```
tasks/briefs/auth-token-refresh-brief.md
```

### 3. Architect reviews and writes a proposal

Architect verifies the brief against repo state and RoadBoard, finds a design question, writes a formal proposal:

```
tasks/proposals/auth-token-refresh-v1.md
```

Architect also writes a question for Analyst:

```
tasks/for-analyst/auth-token-refresh-q1.md
```

### 4. Analyst reviews and responds

Analyst reads from `tasks/for-analyst/` and `tasks/proposals/`, writes a correction brief:

```
tasks/briefs/auth-token-refresh-corrections.md
```

### 5. Convergence — Architect creates the final prompt

After Analyst/Architect planning convergence, Architect creates the verified Worker prompt:

```
tasks/todo/feat-auth-token-refresh.md
```

### 6. Analyst final review

The loop returns the `tasks/todo/` prompt listing to Analyst. Analyst either writes final sign-off:

```json
{ "slug": "auth-token-refresh", "iteration": 2, "role": "analyst" }
```

or writes another `tasks/for-analyst/auth-token-refresh-q<N>.md` if the prompt misses risks, scope, or acceptance criteria.

### 7. Lint and ready check

```bash
pnpm agent:workflow lint
# lint: ok (0 issues, 1 file checked)

pnpm agent:workflow ready
# Prompts ready in tasks/todo/:
#   feat-auth-token-refresh.md
```

### 8. GO (manual)

Developer reviews `tasks/todo/feat-auth-token-refresh.md` and approves. Architect moves the file to `tasks/run/` and spawns a Worker subagent.

```bash
mv tasks/todo/feat-auth-token-refresh.md tasks/run/
# → Architect spawns Worker via Agent tool
```

### 9. Worker executes

Worker implements the prompt, verifies acceptance criteria, and moves the file to `tasks/done/`:

```bash
mv tasks/run/feat-auth-token-refresh.md tasks/done/
```

### 10. Report

```bash
pnpm agent:workflow report --slug auth-token-refresh
# → creates tasks/reports/auth-token-refresh-final-report.md
```

The report includes the full conversation history: intake, proposals, briefs, for-analyst files, final prompts, and any blocked items.

## Planning-Only Example

Use this when the Developer wants structured analysis but explicitly does not want Worker prompts yet.

### 1. Open the cycle

```bash
pnpm agent:workflow intake --slug roadboard-local-runtime
```

Fill `tasks/intake/roadboard-local-runtime-intake.md` with the goal, constraints, and desired outcome.

### 2. Run the loop safely

```bash
pnpm agent:workflow run --slug roadboard-local-runtime --planning-only
```

Expected outputs:

- `tasks/briefs/roadboard-local-runtime-brief-v<N>.md`
- `tasks/for-analyst/roadboard-local-runtime-q<N>.md` if Architect needs Analyst follow-up
- `tasks/proposals/roadboard-local-runtime-proposal-v<N>.md` if Architect has a proposal ready for Developer review

Forbidden output:

- Any new file in `tasks/todo/`

If a new `tasks/todo/` file appears, the runner stops with a planning-only violation. Inspect and remove or convert that file before continuing.

### 3. Report

```bash
pnpm agent:workflow report --slug roadboard-local-runtime
```

The report should list planning artifacts and show no new Worker prompts created for the cycle.

## Adapters (optional)

The `adapters` subcommand provides an optional, opt-in layer for invoking external model CLIs (Codex CLI, Claude Code CLI, etc.) in a controlled, traceable way.

### Safety model

Adapters are disabled by default and require explicit opt-in at two levels:

1. A local config file `.agent/workflow-adapters.json` (gitignored) with `enabled: true` for the adapter.
2. The `--execute` flag on the `adapters run` command.

Without both, the CLI only renders prompts or shows what would be invoked — it never calls any binary.

No API keys, tokens, or credentials are stored in the repository. The config file lives in `.agent/` (gitignored) and is created manually by the developer.

### Config format

Create `.agent/workflow-adapters.json` (do not commit):

```json
{
  "adapters": {
    "codex": {
      "enabled": true,
      "binary": "/absolute/path/to/codex",
      "outputDir": "/absolute/path/to/output"
    },
    "claude": {
      "enabled": false,
      "binary": "/absolute/path/to/claude",
      "outputDir": "/absolute/path/to/output"
    }
  }
}
```

`binary` must be an absolute path — the CLI never resolves binaries from PATH.

### Subcommands

| Subcommand | Options | Description |
|------------|---------|-------------|
| `adapters list` | — | Show configured adapters and their enabled status |
| `adapters render` | `--slug <slug>` | Print the ready prompt for `<slug>` to stdout (no invocation) |
| `adapters dry-run` | `--slug <slug> --adapter <name>` | Show the command that would be invoked, without running it |
| `adapters run` | `--slug <slug> --adapter <name> --execute` | Invoke the configured binary with the prompt (requires `enabled: true` and `--execute`) |

### Examples

```bash
# Show configured adapters
pnpm agent:workflow adapters list

# Preview the prompt that would be sent
pnpm agent:workflow adapters render --slug deep-code-scan

# Preview the command without running it
pnpm agent:workflow adapters dry-run --slug deep-code-scan --adapter codex

# Actually invoke (requires enabled: true in .agent/workflow-adapters.json)
pnpm agent:workflow adapters run --slug deep-code-scan --adapter codex --execute
```

Output from `adapters run` is saved to `tasks/reports/<slug>-<adapter>-output.md`.

GO decisions remain with the human. Adapters prepare and show prompts — they do not spawn Workers or update RoadBoard.

## Safety Gates

Most `agent:workflow` commands are passive file-system tools:

- `status`
- `lint`
- `ready`
- `sync`
- `report`
- `adapters list`
- `adapters render`
- `adapters dry-run`
- `run --dry-run`

These commands read, count, validate, render, or generate local reports without invoking model CLIs.

`agent:workflow run` is different: it invokes the configured Analyst and Architect role binaries from `.agent/workflow-adapters.json`. It still does not spawn Worker subagents, move lifecycle files, update RoadBoard status, or touch git state.

The CLI is designed to never:

- Spawn Worker subagents
- Move files between `tasks/` folders autonomously
- Modify `tasks/run/` or `tasks/done/`
- Push commits, modify git state, or touch the git index
- Update RoadBoard task statuses
- Modify `PLAN.md` or `CLAUDE.md`

Passive commands and `run --dry-run` do not require network access or external services. A real `run` may require whatever local model CLI dependencies are configured by the Developer.

In normal `run` mode, the Architect model may create files in `tasks/todo/` when prompts are ready. In `run --planning-only`, creating a new `tasks/todo/` file is a hard error.

All transitions between `todo/` → `run/` → `done/` are manual actions performed by the Architect or Developer. The CLI only surfaces state (`status`, `ready`) so that humans can make informed decisions.
