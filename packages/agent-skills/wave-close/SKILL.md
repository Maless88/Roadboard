---
name: wave-close
description: Checklist to close a wave/milestone before marking it complete in RoadBoard — verify prompts done, run the mandatory security review, update changelog/plan, and update the RoadBoard phase via MCP. Use when asked to close or complete a wave/milestone.
---

# Wave close checklist

Before declaring a wave complete in RoadBoard, in this order:

1. **All wave prompts are in `tasks/done/`** — verify the filesystem. Any prompt still in `tasks/run/` or `tasks/todo/` → the wave is NOT complete.
2. **Run `/security-review` (MANDATORY)** on the code delivered in the wave. The wave is not closed until the review completes and every Critical/High finding is resolved or explicitly deferred with a written rationale. If Critical/High remain → open `fix-` prompts before closing.
3. **Update `CHANGELOG.md`** — add the wave's deliverables under `[Unreleased]` (Keep a Changelog sections: Added/Changed/Fixed/Removed/Deprecated/Security).
4. **Flip the wave checkboxes in `PLAN.md`** — only after steps 1–3.
5. **Update the wave status in RoadBoard** — `mcp__roadboard__update_phase` (RoadBoard is the source of truth; the phase state lives there, not in side files).

No wave closes without the security review. Never mark a phase complete in RoadBoard without having actually done steps 1–4.
