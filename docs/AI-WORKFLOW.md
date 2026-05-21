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

1. Developer states a goal.
2. Analyst prepares a brief under `tasks/briefs/` for non-trivial planning work.
3. Architect verifies the brief against repo state, RoadBoard, `PLAN.md`, docs, and source files.
4. Architect creates one or more Worker prompts under `tasks/todo/`.
5. Architect moves a prompt to `tasks/run/` and spawns a Worker.
6. Worker implements and verifies exactly that prompt.
7. Worker moves the prompt to `tasks/done/` when acceptance criteria pass.
8. Architect reviews the result and updates RoadBoard / `PLAN.md` according to `CLAUDE.md`.
9. When Architect finds questions or findings that need Analyst review, it writes them under `tasks/for-analyst/`.

## Folder Contract

```text
tasks/
  briefs/       # Analyst planning briefs, not executable
  for-analyst/  # Architect questions/findings for Analyst review
  todo/         # Architect-verified Worker prompts
  run/          # Worker prompts in progress
  done/         # Completed Worker prompts
```

`tasks/` is gitignored. Treat these files as local operating artifacts unless the developer explicitly asks to publish or commit one.

`tasks/briefs/` and `tasks/for-analyst/` are inboxes, not archives. Delete consumed files after they are converted into the next workflow artifact, unless they are intentionally kept with a short pending note.

Repository state beats memory. RoadBoard and `PLAN.md` state must be verified before planning.
