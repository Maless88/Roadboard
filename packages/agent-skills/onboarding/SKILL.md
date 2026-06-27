---
name: onboarding
description: Onboard a code project into RoadBoard — analyze the cloned repo and populate RoadBoard (project, phase, tasks, memory and the architecture graph / Atlas) via the RoadBoard MCP tools, then render the per-repo CLAUDE.md. Use when the user asks to onboard a project, or when a project that has a repo is not yet onboarded in RoadBoard.
---

# Project onboarding (into RoadBoard)

You onboard a project that already has its repo cloned locally (the clone path is in your context under "Repo del progetto"). Populate RoadBoard **only via its MCP tools** — never parallel stores.

## First, refresh tool knowledge
Call `initial_instructions` once to get the current RoadBoard MCP operating manual before using other tools.

## Steps
1. **Analyze the repo** (read-only): identify stack, entry points, modules/services, dependencies, structure and conventions. Use Serena for code navigation (see the `serena-nav` skill) — do not grep for symbols.
2. **Discovery**: summarize stack + structure (what is built, wired, stubbed).
3. **Baseline memory**: save an architectural baseline as a RoadBoard memory entry (`create_memory_entry`, type `architecture`).
4. **Architecture / Atlas**: map workspace/modules/services and their dependencies into RoadBoard via `ingest_architecture` (one-shot) OR the granular tools: `create_architecture_repository` → `create_architecture_node` (per app/module/service) → `create_architecture_edge` (depends_on, etc.) → `create_architecture_link` / `create_architecture_annotation` for semantic context.
5. **Plan/phase**: create the onboarding phase and tasks (`create_phase`, `create_task`) reflecting current state and next steps; record key decisions (`create_decision`) when relevant.
6. **Render the project CLAUDE.md** (Layer 3 / project facts): write a `CLAUDE.md` at the repo root with local dev orientation — stack, layout, run/build/test commands, entry points, conventions, gotchas, and the RoadBoard project id. This is a **render of the RoadBoard summary**, not a separate store: derive it from what you just put in RoadBoard. Do not put task/phase/decision data in it.
7. **Handoff**: write a handoff memory entry with the next steps (navigation, state, gaps).

## Hard rules
- RoadBoard is the single source of truth for project management (tasks, phases, memory, decisions, architecture): every such artifact goes in via MCP, not in side files.
- The per-repo `CLAUDE.md` is the ONLY allowed local file, and only as dev-orientation rendered from RoadBoard — never as a competing store of project-management data.
- Read/analyze the repo freely; **never commit** — code commits happen only on the user's explicit request.
- Never claim you onboarded / created something without having actually called the tool.
- Report a concise summary of what you created (phase, tasks, Atlas nodes/edges, memory, CLAUDE.md).
