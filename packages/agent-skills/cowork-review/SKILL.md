---
name: cowork-review
description: Worker-prompt lifecycle and the Architect/Analyst review gates — prompt frontmatter (status, review_round, output_status), the draft→in-review→approved loop, the append-only review logs, the output gate (review-output → promote), and the tasks/{todo,run,done} transitions. Use when drafting, reviewing, or executing a Worker prompt.
---

# Cowork — prompt lifecycle + review gates

Worker-executable work lives as markdown prompt files under `tasks/{todo,run,done}` (gitignored). Move with plain `mv` — except `run/`→`done/`, which only `promote` may perform.

## Prompt frontmatter (MANDATORY)
```yaml
---
status: draft        # draft | in-review | changes-requested | approved | blocked-review
review_round: 0      # incremented on each resubmission
# --- output-gate fields (populated after the Worker runs) ---
output_status: none  # none | pending | approved | changes-requested | blocked-review
output_round: 0      # incremented by review-output on each verdict
verification:        # filled by `promote` (build/tests) and by the Worker (evidence)
  build: unknown     # unknown | pass | fail
  tests: unknown     # unknown | pass | fail
  evidence: ""       # path to screenshot/log; required for UI tasks
---
```
A Worker is spawned ONLY when `status: approved`. A prompt reaches `done/` ONLY when `output_status: approved` + build/tests green + evidence satisfied. Filesystem + frontmatter are the single source of truth.

## Review gate (before any Worker execution)
1. Architect drafts the prompt in `tasks/todo/` (`status: draft`, `review_round: 0`).
2. Architect submits it (`status: in-review`) to the Analyst (a review step — in the single-agent chatboard this is a dedicated review pass / a security-or-review agent like Argo, not a third session-role).
3. Analyst writes a verdict (`approved` / `changes-requested`) into the frontmatter and APPENDS one round to `## Review log` (never overwrites prior rounds).
4. `changes-requested` → Architect revises in place, `review_round++`, `status: in-review`, resubmit.
5. `approved` → proceed to execute.
6. Loop cap: after 3 rounds without `approved` → `status: blocked-review`, escalate to the developer.

Analyst defaults to `changes-requested` when the prompt is ambiguous/under-specified/unverifiable/risky. Approval is earned. Analyst never writes code or moves files.

## Review log (append-only)
```markdown
## Review log
### Round 1 — changes-requested
- <rationale> / Requested: <precise change>
### Round 2 — approved
- <what was resolved>
```

## Output gate (run → done)
The Worker does NOT close its own task. `run/`→`done/` is gated:
1. Worker finishes → sets `output_status: pending` on the prompt in `tasks/run/` and STOPS. No file move.
2. `pnpm agent:workflow review-output --slug <slug>` — Analyst reviews the RESULT (`git diff HEAD` vs `## Scope` + `## Acceptance criteria`); writes `output_status: approved|changes-requested`, `output_round++`, appends one round to `## Output review log` (append-only). Defaults to `changes-requested` when uncertain; 3 rounds → `blocked-review`.
3. `pnpm agent:workflow promote --slug <slug>` — the ONLY run→done path. Refuses unless: `output_status: approved` AND re-executed build + tests exit 0 (recorded in `verification`) AND evidence satisfied (UI-labeled prompts need `verification.evidence` pointing to an existing file).

PLAN.md flips and RoadBoard updates stay manual, after `promote` succeeds.

## Transitions
| From | To | Who | When |
|---|---|---|---|
| (new) | todo/ | Architect | prompt drafted (`status: draft`) |
| todo/ | run/ | Architect | prompt is `approved`; before spawning the Worker |
| run/ | run/ | Worker | implementation done → sets `output_status: pending`, stops (does NOT move) |
| run/ | run/ | Analyst | `review-output` writes an `output_status` verdict + Output review log round |
| run/ | done/ | `promote` | `output_status: approved` + build/tests exit 0 + evidence satisfied |
| run/ | run/ | Worker | blocked → append `## Failure note`, stop |

## Worker discipline
Never picks up prompts autonomously; executes only the named prompt; never chains; never expands scope beyond `In scope`; never moves its prompt to `done/`; commits only if the prompt explicitly asks. PLAN.md: Worker may only flip `[ ]`→`[x]` for the completed prompt — nothing else.
