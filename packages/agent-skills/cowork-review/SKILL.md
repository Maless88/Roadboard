---
name: cowork-review
description: Worker-prompt lifecycle and the Architect/Analyst review gate — prompt frontmatter (status, review_round), the draft→in-review→approved loop, the append-only review log, and the tasks/{todo,run,done} transitions. Use when drafting, reviewing, or executing a Worker prompt.
---

# Cowork — prompt lifecycle + review gate

Worker-executable work lives as markdown prompt files under `tasks/{todo,run,done}` (gitignored). Move with plain `mv`.

## Prompt frontmatter (MANDATORY)
```yaml
---
status: draft        # draft | in-review | changes-requested | approved | blocked-review
review_round: 0      # incremented on each resubmission
---
```
A Worker is spawned ONLY when `status: approved`. Filesystem + frontmatter are the single source of truth.

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

## Transitions
| From | To | Who | When |
|---|---|---|---|
| (new) | todo/ | Architect | prompt drafted |
| todo/ | run/ | Worker | picks up an APPROVED prompt |
| run/ | done/ | Worker | acceptance criteria met + verification passes |
| run/ | run/ | Worker | blocked → append `## Failure note`, stop |

## Worker discipline
Never picks up prompts autonomously; executes only the named prompt; never chains; never expands scope beyond `In scope`; commits only if the prompt explicitly asks. PLAN.md: Worker may only flip `[ ]`→`[x]` for the completed prompt — nothing else.
