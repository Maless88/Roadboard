# Roadmap

> **Status: pre-beta — active development.** No stable release has been published. APIs and interfaces may change without notice.

## Current focus

**Agent platform hardening** *(in progress)*

- LLM Runtime: provider registry, native adapters (OpenAI / Anthropic / Gemini), openai-compatible + Ollama baseline, per-role routing policy and budgets
- Durable agent memory replicated to production (pgvector + embeddings)
- Telegram bridge: live turn streaming, per-agent bots
- Human-in-the-loop permission approval for agent actions
- Context compaction (read-time prompt assembly, async summary refresh)
- Security review of the agentic system

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
| 12 | Test Automation Hardening | done |
| Wave 3 | Memory and intelligence layer | done |
| Wave 4 | Team and access hardening (MCP token scopes, team dashboards, invite flows) | done |
| Wave 5 | CodeFlow / Atlas: architecture graph, repo scanning, impact analysis, agent-native MCP tools | done |
| Wave 5.x | Graph DB migration: CodeFlow storage cut over from Postgres to Memgraph (CF-GDB-03) | done |
| Wave 6 | Deep Code Map: file/symbol-level scanning via ts-morph (`deep-code-scan` queue) | done |
| — | Agent workspace: life-OS agents, rooms/Boardchat, scheduling, skills, photorealistic avatars | done |

See the architecture design record: [docs/design/codeflow.md](docs/design/codeflow.md) (historical) and [docs/adr/0001-deep-code-map-memgraph-schema.md](docs/adr/0001-deep-code-map-memgraph-schema.md).

---

## Upcoming

These are planned directions, not committed delivery dates.

- Atlas: generalized impact view in the node drawer; advanced filters (symbol search, callers/callees, blast radius)
- Multi-language scanning adapters (tree-sitter: Python, Rust, Go)
- Onboarding orchestration for existing projects (`onboard_existing_project` MCP tool)
- Per-user runtime containers and BYO API keys / local models (Ollama)
- Usage visibility: per-user token consumption in Settings

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
