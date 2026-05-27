# Architect Handoff Template

Use this when asking Architect to convert Analyst planning material into a verified proposal or Worker prompts.

Set the mode explicitly:

- `planning-only`: Architect writes proposals/questions only; no `tasks/todo/`.
- `worker-prompt`: Architect may create verified Worker prompts in `tasks/todo/`.

## Mode

- [ ] planning-only
- [ ] worker-prompt

## Source Brief

`tasks/briefs/<brief-file>.md`

## Goal

## Repository Areas To Verify

- `PLAN.md`:
- `docs/`:
- `tasks/`:
- source files:
- tests:

## RoadBoard Checks

- phase:
- task:
- status:
- related memories / decisions:

## Expected Prompt Split

1.
2.
3.

## Acceptance Criteria For Architect Output

- [ ] Brief claims verified against repo state.
- [ ] RoadBoard and filesystem task queue are aligned.
- [ ] If planning-only: proposal written under `tasks/proposals/` and no new `tasks/todo/` files created.
- [ ] If worker-prompt: Worker prompt files created under `tasks/todo/`.
- [ ] Prompt files include scope, acceptance criteria, notes, verification commands, and `PLAN.md` update rules.
- [ ] Consumed brief removed or left with a short pending note.
