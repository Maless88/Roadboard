# Agent context model — 3 layers

How an agent's working context is assembled. Keeps the per-request prompt small
while methodology stays available on demand and project facts stay local.

## Layer 1 — Identity  (who the agent is)
- **Where**: the agent `system_prompt` in the DB (`agent_configs`), rendered by
  `buildAgentContext()` in core-api into the per-request `CLAUDE.md`.
- **Holds**: name, description, what it does / doesn't do, language + style,
  the `[[ASK:<slug>]]` team-consult protocol, and pointers to the skills it owns.
- **Rule**: identity only — no methodology, no project facts. Stays slim.

## Layer 2 — Method  (how we work)
- **Where**: Agent Skills (`SKILL.md`, progressive disclosure) versioned in
  `packages/agent-skills/`, deployed to `~/.claude/skills` by
  `scripts/deploy-agent-skills.mjs`.
- **Holds**: `onboarding`, `serena-nav`, `cowork-review`, `git-conventions`,
  `wave-close`. Only `name` + `description` sit in context; the body loads when
  the skill is relevant.
- **Rule**: situational/heavy procedure lives here, not inlined in the prompt.
  In claude-code skills auto-activate by relevance; the RoadBoard catalog +
  `agent_skills` attachment is the curation/visibility layer (agent cards).

## Layer 3 — Project facts  (what this codebase is)
- **Where**: a per-repo `CLAUDE.md` at the root of each cloned project
  (template: `CLAUDE.project-template.md`).
- **Holds**: stack, layout, run/build/test commands, entry points, conventions,
  gotchas — local dev orientation.
- **Rule**: it is a **render** of the RoadBoard project summary, refreshed during
  onboarding — NOT a parallel store. Project management (tasks/phases/memory/
  decisions/architecture) lives ONLY in RoadBoard via its MCP tools.

## Flow
`onboarding` skill → analyzes the repo with `serena-nav` → populates RoadBoard
via MCP (source of truth) → renders the Layer-3 `CLAUDE.md` from that summary.
Identity (L1) + relevant skills (L2) + project facts (L3) = the working context.
