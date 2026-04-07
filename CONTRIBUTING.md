# Contributing

Thank you for your interest in contributing to RoadBoard 2.0.

## Development setup

See [README.md](README.md) for the full quickstart. You need Node.js 20+, pnpm 9+, and Docker.

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(scope): add something new
fix(scope): fix a bug
chore(scope): maintenance task
docs(scope): documentation only
test(scope): add or update tests
refactor(scope): code change with no feature or fix
```

Scope is the package or app name (e.g. `core-api`, `web-app`, `mcp-service`).

## Pull requests

- One feature or fix per PR
- All tests must pass (`pnpm -r test`)
- All type checks must pass (`pnpm typecheck`)
- Follow the existing code style (TypeScript strict, no `any`)

## Code conventions

- TypeScript strict mode — no `any`
- NestJS module pattern for backend services (controller + service + DTOs)
- No business logic in controllers — keep it in services
- DB columns: snake_case via Prisma `@map`
- No barrel exports in app code — only in shared packages

## Reporting bugs

Please open a GitHub issue with:
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment (OS, Node.js version, relevant env vars without secrets)
