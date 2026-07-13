# AI Workflow

Roadboard uses an Analyst / Architect / Worker model for AI-assisted development.

## Roles

### Developer

Owns product intent, priorities, credentials, deployment, and final acceptance.

### Analyst

The review gate. Does not write separate planning documents — reads the Worker prompt the Architect drafted in `tasks/todo/` and verifies it against the repo, RoadBoard, `PLAN.md`, docs, and source code. Writes its verdict **into the prompt file itself**: frontmatter `status: approved | changes-requested`, plus an append-only `## Review log` section (one `### Round N` per pass). Never overwrites a prior round.

Analyst does not write code, does not move files between `tasks/` folders, and does not spawn subagents.

### Architect

Drafts the Worker prompt, owns it through the review loop (revises on `changes-requested`, resubmits), and — once `status: approved` — moves the prompt `todo/`→`run/` and spawns a Worker. After the Worker finishes, Architect reviews the diff, then runs `review-output` and `promote` to close the loop.

### Worker

Executes exactly one Architect-verified prompt. Does not design, does not expand scope, does not chain to another prompt, and does not close its own task — it sets `output_status: pending` and stops.

## Flow

There are two loops: a **prompt review loop** (Analyst↔Architect, before any code is written) and an **output review loop** (Analyst↔Architect, after the Worker finishes). Both live entirely inside the prompt file's YAML frontmatter and its `## Review log` / `## Output review log` sections — there are no separate inbox folders.

### 1. Prompt review loop (`todo/`, before spawn)

1. Architect drafts a Worker prompt in `tasks/todo/<type>-<slug>.md` with frontmatter `status: draft`, `review_round: 0`.
2. Architect sets `status: in-review` and hands it to the Analyst (subagent or external reviewer).
3. Analyst edits the same file: sets `status` to `approved` or `changes-requested`, appends a `### Round N — <verdict>` block to `## Review log`.
4. If `changes-requested`: Architect revises the prompt **in place**, increments `review_round`, sets `status: in-review`, resubmits. Repeat from step 3.
5. **Cap: 3 rounds.** If still not `approved` after 3 rounds, Architect sets `status: blocked-review` and escalates to the Developer — no more automatic ping-pong.
6. Only when `status: approved` may the Architect spawn a Worker.

The CLI encodes the same gate: `pnpm agent:workflow run --slug <slug> --adapter <name>` **refuses** to invoke a Worker adapter unless the prompt's frontmatter `status` is exactly `approved`.

### 2. GO to Worker (manual)

7. Architect moves the prompt `tasks/todo/` → `tasks/run/` and spawns the Worker (via the Agent tool, or via `pnpm agent:workflow run --slug <slug> --adapter <name>` for the optional CLI adapter path).
8. This move and spawn are always manual. Nothing in the CLI moves a file from `todo/` to `run/` on its own — `run` only checks the gate and invokes the adapter on a file already understood to be in play.

### 3. Output review loop (`run/`, after the Worker finishes)

9. Worker implements the prompt, self-verifies, sets frontmatter `output_status: pending` on the prompt still sitting in `tasks/run/`, and stops. **It does not move the file.**
10. `pnpm agent:workflow review-output --slug <slug>` — computes `git diff HEAD`, feeds it plus the prompt's `## Scope` and `## Acceptance Criteria` to the Analyst reviewer, and writes the verdict back: `output_status` → `approved` / `changes-requested`, `output_round` incremented, one `### Round N — <verdict>` appended to `## Output review log` (append-only, never overwritten).
11. Defaults to `changes-requested` when uncertain. Caps at 3 rounds — beyond that, `output_status: blocked-review` and the Developer must triage.
12. `pnpm agent:workflow promote --slug <slug>` — the **only** `run/`→`done/` path. Refuses to move the file unless, in order:
    - `output_status: approved`;
    - a re-executed build **and** tests both exit 0 (commands configurable in `.agent/workflow-adapters.json` under `verify: { build, tests }`, defaulting to `pnpm build` / `pnpm test`) — recorded into the prompt's `verification:` block;
    - evidence is satisfied — if the prompt sets `requires_evidence: true` or carries a UI label (`label: ui` / `labels: [… ui …]`), `verification.evidence` must be a non-empty path to a file that exists.
13. Only when all three gates pass does `promote` move the file to `tasks/done/`. `PLAN.md` checkbox flips and RoadBoard status updates stay manual — `promote` never touches either.

**`tasks/done/` is unreachable by a Worker self-move.** The only door in is `promote`, and `promote` only opens after an approved output review, a green build+test run, and (for UI work) evidence.

## Folder Contract

```text
tasks/
  todo/   # prompts being drafted/reviewed AND prompts approved-but-not-yet-spawned
  run/    # a Worker is executing, or has finished and is awaiting review-output/promote
  done/   # promoted — output_status: approved + build/tests green + evidence satisfied
```

Exactly three folders. `tasks/` is gitignored — prompt files are working artifacts, not source.

There is no `briefs/`, `for-analyst/`, `proposals/`, `intake/`, or `reports/` folder. That older inbox-based model (Analyst writing separate planning briefs, Architect writing separate proposal/question files) was retired — the review lives inside the prompt file's frontmatter and log sections instead. If you see references to those folders in older material, they describe the retired model, not the current one.

Single-writer discipline: only the Architect creates new files in `todo/`. The `run/`→`done/` move happens only via `promote`.

## Prompt Frontmatter (mandatory)

```yaml
---
status: draft        # draft | in-review | changes-requested | approved | blocked-review
review_round: 0       # incremented by the Architect on each resubmission
# --- output-gate fields (optional; populated once the Worker has run) ---
output_status: none   # none | pending | approved | changes-requested | blocked-review
output_round: 0        # incremented by review-output on each verdict
verification:          # filled by `promote` (build/tests) and by the Worker (evidence)
  build: unknown       # unknown | pass | fail
  tests: unknown       # unknown | pass | fail
  evidence: ""         # relative path to a screenshot/log; required for UI tasks
---
```

## End-to-end example

Minimal cycle for a bug fix: draft → review → approve → spawn → output review → promote.

### 1. Architect drafts the prompt

```
tasks/todo/fix-mcp-auth-token-refresh.md
```

Frontmatter starts at `status: draft`, `review_round: 0`. Architect fills in `## Context`, `## Scope`, `## Acceptance criteria`, `## Notes`, sets `status: in-review`.

### 2. Prompt review loop

```bash
pnpm agent:workflow review --slug mcp-auth-token-refresh --analyst codex
```

Analyst appends `### Round 1 — changes-requested` to `## Review log` with a precise request. Architect revises the prompt in place, increments `review_round`, resubmits. Round 2 comes back `approved`.

### 3. GO — spawn the Worker

```bash
pnpm agent:workflow ready
# feat-mcp-auth-token-refresh.md — approved (spawnable)

mv tasks/todo/fix-mcp-auth-token-refresh.md tasks/run/
# → Architect spawns a Worker subagent pointed at the file
```

### 4. Worker implements

Worker edits the source, self-verifies, sets `output_status: pending` on the prompt (still in `tasks/run/`), and stops.

### 5. Output review loop

```bash
pnpm agent:workflow review-output --slug mcp-auth-token-refresh
# [review-output] approved — output_status: approved (round 1)
#   Promotable: pnpm agent:workflow promote --slug mcp-auth-token-refresh
```

### 6. Promote

```bash
pnpm agent:workflow promote --slug mcp-auth-token-refresh
# Promoted fix-mcp-auth-token-refresh.md → tasks/done/ (build=pass, tests=pass)
```

Architect then flips the corresponding `PLAN.md` checkbox (if any — `fix-` prompts usually don't have one) and updates RoadBoard task status to `done`.

## CLI Reference

All commands are invoked via:

```bash
pnpm agent:workflow <command> [options]
```

| Command | Options | Description |
|---------|---------|-------------|
| `status` | — | Print per-folder `.md` file counts and `TASK_LIST.md` staleness |
| `lint` | `[--dir <dir>]` | Validate `.md` files in `tasks/<dir>/` (default: `todo`) for required sections, frontmatter, and (in `todo/`) whether each prompt is spawnable (`status: approved`) |
| `ready` | — | Partition `tasks/todo/` prompts into approved (spawnable) vs. pending |
| `sync` | — | Regenerate `TASK_LIST.md` from `tasks/todo/`, `tasks/run/`, and `tasks/done/` |
| `review` | `--slug <slug> [--analyst <codex\|claude>] [--max-rounds <n>]` | Drive the Architect↔Analyst **prompt** review loop to convergence (`approved` or `blocked-review`) |
| `run` | `--slug <slug> --adapter <name> [--dry-run]` | Spawn a Worker adapter on an **approved** prompt — refuses any other status |
| `review-output` | `--slug <slug> [--max-rounds <n>]` | Review a finished Worker's result in `tasks/run/`: diff + Scope/Acceptance → `output_status` verdict + `## Output review log` round |
| `promote` | `--slug <slug> [--dry-run]` | The single `run/`→`done/` path: requires `output_status: approved`, re-runs build + tests, enforces evidence |
| `adapters <sub>` | see below | Optional model CLI adapter layer (opt-in, safe by default) |
| `config` | `--init \| --show` | Create or print `.agent/workflow-adapters.json` |

### Command details

**`status`** — snapshot of the task queue:

```bash
pnpm agent:workflow status
```

Prints `.md` counts for `todo/`, `run/`, `done/` plus whether `TASK_LIST.md` is missing, stale, or up to date.

**`lint [--dir <dir>]`** — validate prompt files:

```bash
pnpm agent:workflow lint            # lint tasks/todo/
pnpm agent:workflow lint --dir run  # lint tasks/run/
```

Checks required sections and frontmatter validity. In `todo/`, also flags any file whose `status` is not `approved` as `NOT-SPAWNABLE`. Exits non-zero if any file has lint errors.

**`ready`** — check what is ready for GO:

```bash
pnpm agent:workflow ready
```

Lists `tasks/todo/` prompts split into approved (spawnable) and pending.

**`sync`** — regenerate `TASK_LIST.md`:

```bash
pnpm agent:workflow sync
```

**`review --slug <slug>`** — run the prompt review loop:

```bash
pnpm agent:workflow review --slug feat-task-bulk-delete --analyst codex --max-rounds 3
```

Drives Architect↔Analyst rounds on the prompt in `tasks/todo/` until `status: approved` or `blocked-review`. `--analyst` selects which configured role acts as Analyst (`codex` or `claude`, from `.agent/workflow-adapters.json`); defaults to `codex`.

**`run --slug <slug> --adapter <name>`** — spawn a Worker on an approved prompt:

```bash
pnpm agent:workflow run --slug feat-task-bulk-delete --adapter claude
pnpm agent:workflow run --slug feat-task-bulk-delete --adapter claude --dry-run
```

Refuses immediately if the prompt's `status` is not `approved`. `--dry-run` prints the command that would run without invoking anything. On success, adapter output is saved under `tasks/run/<slug>-<adapter>-output.md` (or the adapter's configured `outputDir`).

**`review-output --slug <slug>`** — review the Worker's result:

```bash
pnpm agent:workflow review-output --slug feat-task-bulk-delete
```

Computes `git diff HEAD`, hands it plus the prompt's Scope/Acceptance Criteria to the reviewer, writes `output_status` and appends to `## Output review log`.

**`promote --slug <slug>`** — the only `run/`→`done/` path:

```bash
pnpm agent:workflow promote --slug feat-task-bulk-delete
pnpm agent:workflow promote --slug feat-task-bulk-delete --dry-run
```

Refuses unless `output_status: approved`, then re-runs build + tests (from `.agent/workflow-adapters.json`'s `verify` block, default `pnpm build` / `pnpm test`) and checks evidence for UI-labeled prompts. `--dry-run` reports what it would do without running commands or moving the file.

## Adapters (optional)

The `adapters` subcommand is an optional, opt-in layer for invoking external model CLIs (Codex CLI, Claude Code CLI, etc.) in a controlled, traceable way. It backs both the `review`/`run` role invocations above and can also be driven directly.

### Safety model

Disabled by default, requires explicit opt-in at two levels:

1. A local config file `.agent/workflow-adapters.json` (gitignored) with `enabled: true` for the adapter.
2. The `--execute` flag on `adapters run` (or, for the Worker path, an approved prompt for `agent:workflow run`).

Without both, the CLI only renders prompts or shows what would be invoked — it never calls any binary.

No API keys, tokens, or credentials are stored in the repository. `.agent/workflow-adapters.json` lives in `.agent/` (gitignored) and is created manually via `pnpm agent:workflow config --init`.

### Config format

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
  },
  "verify": {
    "build": "pnpm build",
    "tests": "pnpm test"
  }
}
```

`binary` must be an absolute path — the CLI never resolves binaries from `PATH`. `verify` configures the commands `promote` re-runs before allowing `run/`→`done/`.

### Subcommands

| Subcommand | Options | Description |
|------------|---------|-------------|
| `adapters list` | — | Show configured adapters and their enabled status |
| `adapters render` | `--slug <slug>` | Print the prompt for `<slug>` to stdout (no invocation) |
| `adapters dry-run` | `--slug <slug> --adapter <name>` | Show the command that would be invoked, without running it |
| `adapters run` | `--slug <slug> --adapter <name> --execute` | Invoke the configured binary with the prompt (requires `enabled: true` and `--execute`) |

```bash
pnpm agent:workflow adapters list
pnpm agent:workflow adapters render --slug feat-task-bulk-delete
pnpm agent:workflow adapters dry-run --slug feat-task-bulk-delete --adapter codex
pnpm agent:workflow adapters run --slug feat-task-bulk-delete --adapter codex --execute
```

GO decisions remain with the human. Adapters prepare and show prompts — they do not spawn Workers unilaterally, move lifecycle files, or update RoadBoard.

## Safety Gates

Passive, read-only commands — never invoke a model CLI, never touch git, never move files:

- `status`
- `lint`
- `ready`
- `sync`
- `adapters list`
- `adapters render`
- `adapters dry-run`
- `run --dry-run`
- `promote --dry-run`

`review`, `run`, `review-output`, and `promote` are the commands that actually change state:

- `review` invokes the configured Analyst/Architect role binaries and edits the prompt's frontmatter + `## Review log`. It never moves files or spawns a Worker.
- `run` invokes a Worker adapter, but **only** on a prompt already `status: approved`. It never moves files between `tasks/` folders and never updates RoadBoard.
- `review-output` invokes the configured reviewer and edits `output_status` + `## Output review log`. It never moves files.
- `promote` is the only command that moves a file from `run/` to `done/`, and only after all three gates (output approval, green build+tests, evidence) pass. `--dry-run` reports the same checks without running commands or moving anything.

The CLI is designed to never:

- Spawn a Worker on a prompt that is not `status: approved`
- Move a file from `run/` to `done/` outside of `promote`
- Push commits, modify git state, or touch the git index
- Update RoadBoard task statuses
- Modify `PLAN.md` or `CLAUDE.md`

All `todo/`→`run/` moves and RoadBoard/`PLAN.md` updates are manual actions performed by the Architect or Developer, per `CLAUDE.md`.
