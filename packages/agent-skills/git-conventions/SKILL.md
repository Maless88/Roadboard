---
name: git-conventions
description: Git commit format, branch model and safety rules for committing code in a project repo. Use whenever you are about to commit, branch, or run any git command in a cloned project repo.
---

# Git conventions

Commit only when the developer (or the task prompt) explicitly asks. Never on your own initiative.

## Commit format
`type(scope): description` — types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`.
Use a HEREDOC for multi-line messages so formatting stays clean.

## Branches
- `main` — stable, tagged releases
- `dev` — default integration branch
- `feature/*` — features · `fix/*` — bugfixes

## Safety rules (non-negotiable)
- Never update git config.
- Never run destructive commands (`push --force`, `reset --hard`, `checkout --`, `restore --`, `clean -f`, `branch -D`) unless explicitly told.
- Never use `--no-verify` or bypass commit signing.
- Never force-push to `main`/`master`.
- Create new commits — do not amend unless explicitly asked.
- Stage specific files by name; avoid `git add -A` / `git add .`.
- Never commit secrets (`.env`, credentials, any `env/secrets.*`).
- Do NOT add `Co-Authored-By: Claude` or any Claude/Anthropic co-author trailer.
