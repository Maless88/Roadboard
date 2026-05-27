# Analyst Brief Template

Save project-specific copies under `tasks/briefs/`.

Suggested filename:

```text
<type>-<short-kebab-slug>-brief.md
```

Examples:

- `feat-architecture-snapshot-brief.md`
- `fix-auth-context-brief.md`

## Goal

## Cycle Mode

`planning-only` / `worker-prompt`

## Current Repo State

## Relevant Local Sources

- `PLAN.md`:
- `docs/`:
- `tasks/`:
- source files:

## External Research

- Sources:
- Findings:
- Constraints:
- Uncertainties:

## Milestone / Spec Mapping

## Proposed Task Type

`feat` / `fix` / `enh` / `rework`

## Dependencies And Blockers

## Risks

Consider schema/data loss, auth, permissions, privacy, API contracts, service coupling, migration impact, RoadBoard sync, and task queue state.

## Recommended Task Split

1.
2.
3.

## Verification Stance

## Open Questions

## Draft Architect Handoff

Use this as Analyst-prepared material, not verified repository truth. Architect must verify files, RoadBoard state, `PLAN.md`, docs, and code before creating proposals or Worker prompts. If the cycle is `planning-only`, Architect must not create files in `tasks/todo/`.
