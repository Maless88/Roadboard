# Roadboard 2.0 MVP Resequencing Decision

## Decision
The MVP should be built **API/MCP-first**, with the human web application postponed until after the first agent-oriented operational backbone is working.

## New MVP Principle
Before building the full human-facing UI, Roadboard 2.0 should first be able to:
- store project and work data centrally
- support controlled access through grants and tokens
- expose a usable MCP surface for LLM-driven workflows
- preserve a minimal local/remote operational model

The human web application remains important, but it is no longer required for the earliest MVP slice.

## Why This Change Makes Sense
The product vision is not only a human dashboard application.
A core part of Roadboard 2.0 is being an operational platform for AI agents.

If the platform cannot:
- store data cleanly
- enforce permissions
- expose safe MCP tools
- support local and remote state patterns

then the UI would only sit on top of an immature foundation.

This resequencing prioritizes the real platform backbone before the visual product layer.

## What Moves Earlier
### Move earlier in priority
- central data model and persistence
- auth and access control
- grants
- token lifecycle
- MCP service
- MCP contracts
- local/remote storage model
- first local staging / sync design primitives

## What Moves Later
### Move later in priority
- full `web-app`
- project list UI
- project detail UI
- task management UI
- dashboard UI for humans
- admin/token management UI

## Updated MVP Shape
### MVP becomes
A platform-first MVP with:
- central project/task storage
- minimal continuity memory
- auth
- basic grants
- token support
- MCP read/write tools
- initial local/remote storage pattern

### Post-MVP / MVP+1 becomes
- human web interface
- richer dashboards
- broader collaboration UX
- advanced admin surfaces

## Updated Service Priority
### Must exist in MVP
- `core-api`
- `auth-access`
- `mcp-service`
- `packages/domain`
- `packages/database`
- `packages/auth`
- `packages/grants`
- `packages/mcp-contracts`
- initial local storage model support

### Can move after MVP
- `web-app`
- `worker-jobs` (unless needed for a specific MCP-supporting operation)
- `local-sync-bridge` as a full daemon/service

## Clarification About Local/Remote Storage
For the MVP, the important thing is not to deliver the full sync bridge UI/ops surface.

The important thing is to establish the storage pattern correctly:
- central PostgreSQL as source of truth
- local persistent layer for agent-side operational state
- explicit rules for what is local, what is remote, and what is synchronized

A thin first implementation is enough if it proves the architecture.

## Updated MVP Entity Priority
### Highest priority
- Project
- Phase
- Milestone
- Task
- User
- ProjectGrant
- MCPToken
- MemoryEntry (basic)

### Later priority
- Team
- TeamMembership
- Decision
- SessionHandoff
- AgentSession
- ContextBundle
- SyncRecord

## Updated First Useful Slice
The first useful slice is no longer:
- login -> project list UI

It becomes:
- auth works
- core project data exists
- grants work
- token works
- MCP can read project/task state
- MCP can perform a few controlled writes

This is the first proof that Roadboard works for LLM-driven workflows.

## Recommended Build Order (Updated)
1. mono-repo bootstrap
2. central DB schema bootstrap
3. `core-api` project/phase/milestone/task backbone
4. `auth-access` users/auth/grants/tokens backbone
5. `mcp-contracts`
6. `mcp-service` read tools
7. `mcp-service` narrow write tools
8. basic local persistent layer / local storage primitives
9. only after that, start `web-app`

## Updated Definition Of Early Success
Early success means:
- data can be stored centrally
- access is controlled
- agents can interact safely through MCP
- a minimal local/remote architecture exists
- Roadboard can start helping LLM-based workflows before the human UI is complete

## Final Recommendation
Yes: Roadboard 2.0 should first become a reliable platform for LLM workflows, and only after that become a polished human-facing application.

That means the MVP sequence should be:
**storage -> access -> grants/tokens -> MCP -> local/remote pattern -> human UI**
