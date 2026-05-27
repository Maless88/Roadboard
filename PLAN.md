# PLAN.md — Roadboard 2.0

## AI Workflow Loop (Wave 2)

- [x] feat-workflow-role-config — Per-role adapter config + briefing templates
- [x] feat-workflow-loop-runner — Loop runner run --slug (Analyst↔Architect)

## AI Workflow

- [x] feat-ai-workflow-templates — Intake folders and templates
- [x] feat-agent-workflow-cli — Workflow CLI (status, intake, lint stub, report stub, ready stub)
- [x] feat-agent-workflow-lint-ready — Lint validation + ready gate
- [x] feat-agent-workflow-report — Final report packaging
- [x] feat-agent-workflow-queue-sync — Queue sync and TASK_LIST integration
- [x] docs-agent-workflow-protocol — Documentation and operating protocol
- [x] feat-agent-workflow-cli-adapters — Optional model CLI adapters
- [x] enh-agent-workflow-version-flag — `--version` flag on root CLI

## Docs / MCP guide

- [x] feat-mcp-guide-refresh — Refresh schema Zed/VSCode/Claude Code in /mcp-guide page
- [x] feat-mcp-setup-wizard — Wizard interattivo /mcp-guide a 5 step

## CodeFlow Stabilization

- [x] feat-ai-p0-01-drift-validation — Drift validation baseline + runbook
- [x] feat-ai-p0-02-outbox-audit — Outbox audit + alert backlog
- [x] feat-ai-p0-03-impact-precomputation — ImpactAnalysis behavior + orphan check

### CodeFlow / Graph DB migration

- [x] CF-GDB-03b-A — Pre-mirror extension (Link/Annotation + node fields + backfill)
- [x] CF-GDB-03b-B — Impact read swap (flag-gated, Cypher reverse-BFS)
- [ ] CF-GDB-03b-C — Getter cutover and Postgres retire

## Project Visibility — Per-User Archive & Card UX

- [x] feat-per-user-archive — Archiviazione progetto per-utente (visual only)
- [x] fix-dashboard-card-empty-snapshot — Distinguere "snapshot non disponibile" da "progetto vuoto"

## Deep Code Map (Wave 6)

- [x] feat-deep-code-map-adr-schema — ADR schema Memgraph File/Symbol
- [x] BullMQ job deep-code-scan in worker-jobs (ts-morph walker)

### Atlas / Domain grouping

- [x] CF-22 — Domain grouping CRUD + drag-drop UI
- [x] CF-22-enh — Drag-drop nativo Atlas (sostituisce click-to-assign in canvas)

### Agent context tooling

- [x] CF-19 — MCP `get_architecture_snapshot` (compact contract)
- [x] CF-20 — Decision-Aware Graph sub-view (Atlas)
- [x] CF-21 — Agent Context panel (snapshot viewer)
- [x] CF-23 — Auto-attach snapshot in `create_handoff`

## UX & Vibe Coding

- [x] UX-naming — convenzione titoli `Area — descrizione` + retrofit task attivi
- [x] UX-mcp-naming — MCP guidance soft warning su titoli legacy
- [x] UX-skeletons — Skeleton + empty states su project card
- [x] UX-coordinator — Vista web /coordinator read-only sui tasks
- [x] UX-tasklist — Script tasks:list genera TASK_LIST.md a root
- [x] UX-toasts — Toast unificate per Server Actions success/error
- [x] UX-i18n — Glossario IT/EN + pass coerenza dizionari
- [x] UX-mcp-guide — Wizard completion (verify live + token gen + 5 nuovi client)

## AI Assistant

- [x] AI-chatbot-foundation — Chatbot multi-provider (OpenAI / Anthropic / Ollama) per-utente

## Project Discovery

- [x] PD-thumbnail — Preview thumbnail home progetto (homeUrl auto + upload fallback)

## Wave 4 / Team management

- [x] W4-06 — Link "Gestisci inviti" da Settings a pagina team (UI invite canonical in /teams/:slug)

## Observability / Audit

- [x] audit-01 — Gap coverage ActivityEvent + restore tab Audit (filtri estesi)
