# agent-skills

Versioned **Agent Skills** for the RoadBoard agents (Ada and the rest). Each
skill is a directory with a `SKILL.md` using progressive disclosure: only its
`name` + `description` frontmatter stays in the agent context; the body loads
on demand when the skill is relevant.

These are the *methodology* skills — the "how we work" layer — kept out of the
agent `system_prompt` (which holds only identity) and out of per-repo
`CLAUDE.md` (which holds project facts).

## Skills

| Skill | Purpose |
|---|---|
| `onboarding` | Analyze a cloned repo and populate RoadBoard (project/phase/tasks/memory + Atlas) via the MCP tools. |
| `serena-nav` | Navigate/edit code with Serena (LSP semantic tools) instead of grep/Read. |
| `cowork-review` | Worker-prompt lifecycle + the Architect/Analyst review gate (single-agent model). |
| `git-conventions` | Commit format, branch model, git safety rules. |
| `wave-close` | Checklist to close a wave/milestone (mandatory security review, update RoadBoard phase via MCP). |

## Deploy

The bridge runs `claude` on the host and reads skills from `~/.claude/skills`.
Deploy syncs this versioned source to that dir:

```sh
node scripts/deploy-agent-skills.mjs
```

To also refresh the RoadBoard skills catalog (so the agent cards reflect the
current set), pass a RoadBoard MCP token (`project.write` scope):

```sh
RB_MCP_TOKEN=<token> node scripts/deploy-agent-skills.mjs
```

The per-agent attachment (which agent shows which skill) lives in the
`agent_skills` table and is managed via the RoadBoard MCP tools
`attach_skill` / `detach_skill`.

> Note: in claude-code skills auto-activate by relevance regardless of
> attachment. The RoadBoard catalog + attachment is the curation/visibility
> layer surfaced in the agent profile card.
