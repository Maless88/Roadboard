# Roadboard 2.0 MVP Slimming Decision

## Goal
Make the MVP slimmer, easier to start, and faster to implement without losing the core identity of Roadboard 2.0.

## New MVP Principle
The MVP should prove only one thing:

**Roadboard can already manage real project execution with continuity and basic controlled access.**

Everything else should wait until after the first usable slice is alive.

## What Stays In The MVP

### 1. Multi-project planning backbone
Keep:
- projects
- phases
- milestones
- tasks
- task status
- task priority

Why:
This is the minimum structure needed for Roadboard to manage complex work.

### 2. Basic user access
Keep:
- users
- login/session
- basic project grants

Why:
Roadboard must already support controlled access.
But this should stay minimal in the MVP.

### 3. Team collaboration base
Keep:
- teams
- team memberships
- team-scoped grants

Why:
The development team is composed of 4 people who will use Roadboard from the beginning, so multi-user collaboration is required in the MVP.
This should stay basic, but it cannot be postponed entirely.

### 4. Basic memory
Keep only:
- memory entries linked to a project
- distinction between done / next

Why:
This is the smallest version of context continuity that makes Roadboard different from a plain task board.

## What Moves Out Of The MVP

### Remove from MVP and postpone
- advanced grant matrix
- MCP token issuance UI
- local-sync-bridge
- worker-jobs
- advanced dashboards
- decision records as a separate first-class feature
- session handoffs as a separate first-class feature
- semantic retrieval / RAG
- public GitHub publication polish
- advanced audit features

## Reframed MVP Scope
The MVP becomes:

### Core capabilities
- create and manage projects
- break projects into phases, milestones, and tasks
- authenticate a user
- protect project access at a basic level
- support a small collaborating team through teams, memberships, and team-scoped grants
- store simple memory entries about what was done and what happens next
- show a basic project view and a basic project status dashboard

### Explicitly not required in MVP
- sophisticated agent workflows
- local-first sync
- async job system
- rich token lifecycle UX
- deep reporting
- public open-source readiness

## New MVP Service Shape
For MVP implementation, prioritize only:
- `web-app`
- `core-api`
- `auth-access`

Other services remain in the architecture, but are not required for MVP delivery:
- `mcp-service` -> post-MVP / MVP+1
- `worker-jobs` -> post-MVP
- `local-sync-bridge` -> post-MVP

## New MVP Entity Set
### Keep in MVP
- Project
- Phase
- Milestone
- Task
- User
- Team
- TeamMembership
- ProjectGrant
- MemoryEntry (basic)

### Move after MVP
- Decision
- SessionHandoff
- MCPToken
- AgentSession
- ContextBundle
- ActivityEvent (full version)
- SyncRecord

## New MVP UI Scope
### Keep
- login page
- project list
- project detail page
- phase/milestone/task management
- simple memory section per project
- simple dashboard snapshot
- basic team management view

### Postpone
- token management UI
- handoff UI
- decision timeline UI
- sync status UI
- advanced dashboard widgets

## New MVP Testing Scope
### Keep
- auth/login tests
- project CRUD tests
- task flow tests
- basic project grant tests
- basic team and membership tests
- basic memory creation/read tests
- one end-to-end UI flow

### Postpone
- MCP contract tests
- sync reliability tests
- worker-job tests
- deep permission matrix tests
- token lifecycle tests

## Recommended MVP Build Order (Updated)
1. mono-repo bootstrap
2. `core-api` project/phase/milestone/task backbone
3. `auth-access` minimal login + basic project grant
4. `web-app` login + project list + project detail
5. add basic teams and memberships
6. add basic memory entries (`done` / `next`)
7. add simple dashboard snapshot
8. start tracking Roadboard inside Roadboard

## Why This MVP Is Better
This slimmer MVP:
- starts faster
- reduces service load early
- reduces auth complexity early without removing necessary multi-user collaboration
- keeps the differentiating feature (basic memory)
- avoids building agent/platform complexity before the core product proves value
- still supports the real 4-person development team from the beginning

## Final Recommendation
Roadboard 2.0 MVP should be redefined as:

**a multi-project planning tool with basic access control, basic team collaboration, and basic continuity memory**

not yet as the full team/agent/local-sync platform.

That broader vision remains valid, but should be delivered in later phases after the MVP is alive and useful.
