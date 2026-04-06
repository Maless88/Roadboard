# Roadboard 2.0 Design Index

## Purpose
This directory contains the working design blueprint for Roadboard 2.0.

It covers:
- product vision
- domain model
- MVP scope
- technology choices
- service architecture
- monorepo structure
- publication plan
- test automation plan
- implementation sequencing

## Reading Order

### 1. Product definition
- `vision.md`
- `entities.md`
- `mvp-scope.md`

### 2. Technology choices
- `technology-stack.md`
- `technology-decisions.md`

### 3. Platform architecture
- `service-architecture.md`
- `service-communication-and-data-ownership.md`
- `repository-structure.md`
- `initial-monorepo-layout.md`

### 4. Service internals
- `core-api-structure.md`
- `auth-access-structure.md`
- `mcp-service-structure.md`
- `local-sync-bridge-structure.md`
- `worker-jobs-structure.md`

### 5. Publication and quality
- `github-publication-plan.md`
- `test-automation-plan.md`

### 6. Execution plan
- `implementation-roadmap.md`

## Current Design Direction
Roadboard 2.0 is being designed as a:
- multi-project execution platform
- operational memory system
- team collaboration platform
- MCP-aware agent integration platform
- dashboard-driven monitoring tool for humans

## Architectural Summary
- mono-repo
- TypeScript-first
- Next.js frontend
- NestJS backend services
- PostgreSQL central source of truth
- SQLite local agent/bridge state
- dedicated MCP service
- explicit grants/tokens/auth service
- async worker service for derived processing

## Build Philosophy
A key design principle is:
**build first the parts that help build the rest well.**

That means early implementation should prioritize:
- shared domain model
- auth and access rules
- core project/task structures
- MCP-safe contracts
- the internal tooling needed to use Roadboard itself while building it

## Notes
This folder currently contains design-stage documents.
Over time, some public-facing documentation may be promoted into `docs/` or repository root files.
