# Roadmap

> **Status: pre-beta — active development.** No stable release has been published. APIs and interfaces may change without notice.

## Current milestone

**Phase 12 — Test Automation Hardening** *(in progress)*

- Unit tests for all shared packages (`domain`, `auth`, `grants`, `config`)
- Playwright end-to-end tests for `web-app`
- CI enforcement: all tests required to pass on every push and PR

---

## Completed phases

| Phase | Title | Status |
|-------|-------|--------|
| 0 | Foundation Blueprint | done |
| 1 | Core Domain Backbone | done |
| 2 | Access Backbone | done |
| 3 | MCP Foundation | done |
| 4 | Memory Backbone | done |
| 5 | Wave 1 Hardening | done |
| 6 | Roadboard Builds Roadboard | done |
| 7 | Human Web UI Layer | done |
| 8 | MCP Workflow Tools | done |
| 9 | Async & Operational Reliability | done |
| 10 | Local Sync Bridge | done |
| 11 | GitHub Publication Readiness | done |

---

## Upcoming

These are planned directions, not committed delivery dates.

### Wave 2 — Stability and developer experience
- Improved error reporting and validation messages across all APIs
- OpenAPI / Swagger documentation for core-api and auth-access
- Healthcheck endpoints for all services
- Docker Compose profile for full local stack (all services)
- Improved seed data for onboarding

### Wave 3 — Memory and intelligence layer
- Semantic search over memory entries
- Automatic memory summarization via background jobs
- Richer decision record model with outcome tracking
- Agent-readable changelog per project

### Wave 4 — Team and access hardening
- Fine-grained permission scopes on MCP tokens
- Team-level dashboards
- Audit log API for compliance use cases
- Invite and onboarding flows in web-app

---

## Deliberately out of scope (for now)

- Becoming a full Jira/Linear replacement
- Autonomous agent orchestration without human oversight
- Semantic/RAG infrastructure before the core object model is stable
- Enterprise permission matrix
- Third-party integrations beyond the MCP foundation

---

## Contributing to the roadmap

Open a GitHub issue with the label `roadmap` to propose a direction or raise a priority.
