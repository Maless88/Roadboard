# Roadboard 2.0 Vision

## Vision Statement
Roadboard 2.0 is a multi-project execution, memory, and collaboration platform for humans and AI agents.

It is designed to manage complex project plans structured into phases, milestones, and tasks; preserve operational memory about what has been done and what must happen next; support shared work across teams; and expose controlled agent access through MCP-aware integrations.

## Product Definition
Roadboard 2.0 is not only a board.
It is not only a memory system.
It is not only an MCP backend.

It is the operational control plane for project work, combining:
- project planning and execution tracking
- durable and working memory
- team collaboration
- controlled agent access
- human-readable dashboards

## Core Goals
- Represent complex projects with roadmap, phases, milestones, tasks, and dependencies.
- Preserve context across sessions, contributors, and agents.
- Support multiple active projects at the same time.
- Enable team collaboration with user identity, roles, grants, and auditability.
- Expose an MCP layer for local agent workflows with optional synchronization to a central team database.
- Provide dashboards that make project state understandable to humans.

## Product Principles
- Multi-project by design
- Human-first, agent-compatible
- Local workflow with centralized team visibility
- Structured data over opaque freeform notes
- Durable knowledge separated from transient session context
- Access control and auditability built in
- Interoperable with multiple agents, not tied to a single vendor

## What Roadboard 2.0 Must Contain
### 1. Planning layer
- projects
- phases
- milestones
- tasks
- dependencies
- statuses and priorities

### 2. Memory layer
- memory of what was done
- memory of what should be done next
- decision records
- session handoff context
- operational notes and learnings

### 3. Collaboration layer
- multi-user access
- team sharing
- project membership
- grants / roles
- audit trail

### 4. Agent integration layer
- dedicated MCP access
- local workflows for agents
- controlled save/read operations
- synchronization to a central team store
- token-based access with scope control

### 5. Human monitoring layer
- dashboards for project status
- milestone tracking
- work progress visibility
- blockers / risk visibility
- recent activity and handoff visibility

## Non-Goals For The First Version
- becoming a full Jira/Linear replacement for every organization shape
- relying on opaque autonomous agent behavior
- forcing one memory model tied only to Claude Code
- requiring semantic/RAG infrastructure from day one
- over-automating capture before the core object model is solid

## Positioning
Roadboard 2.0 should sit between:
- a roadmap/task system
- a project memory system
- a team coordination layer
- an MCP-ready agent workspace backend

## Success Criteria
Roadboard 2.0 is successful if it makes it easier to:
- understand project status quickly
- continue work without re-explaining context
- share project state across a team
- keep memory of decisions and next steps
- let agents operate through safe and structured tools
- move between local work and central team visibility without losing consistency
