# Roadboard 2.0 MVP Scope

## MVP Objective
Deliver a first usable version of Roadboard 2.0 that supports complex project planning, operational memory, multi-project work, team visibility, and controlled MCP-based agent access.

The MVP must already be useful for real work.
It should not be only a prototype of ideas.

## Included In MVP

### 1. Multi-Project Planning
The MVP must support:
- multiple projects
- project overview
- phases
- milestones
- tasks
- task status and priority
- basic task dependencies

### 2. Memory And Decision Tracking
The MVP must support:
- memory entries linked to a project
- distinction between what was done and what should happen next
- explicit decision records
- linking memory/decisions to tasks where relevant

### 3. Team Collaboration Foundations
The MVP must support:
- users
- teams
- project membership / grants
- basic access control by project

### 4. MCP / Agent Access Foundations
The MVP must support:
- MCP-aware access model
- token creation and revocation
- scoped access for agent operations
- local usage model with save/read against the central backend

### 5. Human Dashboards
The MVP must support at least:
- project status dashboard
- milestone progress visibility
- active tasks visibility
- recent memory / decision visibility

## Deliberately Not In MVP
These items are valuable, but should not block the first useful release:
- advanced semantic retrieval / RAG
- autonomous workflow orchestration across many agents
- highly granular enterprise-grade permission matrix
- complex offline conflict resolution engine
- full audit analytics and deep reporting
- broad third-party integrations beyond the MCP foundation
- polished executive reporting suite

## MVP User Stories

### As a project owner
I want to define phases, milestones, and tasks for multiple projects so that I can manage complex work in a structured way.

### As a contributor
I want to see what has been done and what should happen next so that I can continue work without losing context.

### As a team lead
I want a dashboard of project and milestone status so that I can monitor progress and blockers.

### As a team member
I want project access to be controlled by grants and roles so that collaboration is safe and organized.

### As an AI agent operator
I want MCP tokens with scoped access so that local agents can interact with Roadboard safely.

## Minimum Required Screens / Interfaces
- project list
- project detail view
- phase / milestone / task management view
- memory and decision view
- team / grant management view
- token management view
- project dashboard

## Minimum Required Backend Capabilities
- CRUD for projects, phases, milestones, tasks
- CRUD for memory entries and decisions
- user/team/grant management
- MCP token issuance and revocation
- read/write APIs for MCP consumers
- dashboard query endpoints

## Suggested Read MCP Tools For MVP
- get_project
- list_projects
- list_project_milestones
- list_active_tasks
- get_task_context
- get_project_memory
- list_recent_decisions
- get_dashboard_snapshot

## Suggested Write MCP Tools For MVP
- create_task
- update_task_status
- create_memory_entry
- create_decision
- create_session_handoff
- issue_mcp_token
- revoke_mcp_token

## Suggested Workflow MCP Tools For MVP
- prepare_task_context
- prepare_project_summary
- create_handoff_from_recent_activity

## MVP Success Criteria
The MVP is successful if it allows a small team to:
- manage more than one project
- keep project plan and execution state visible
- preserve useful memory of completed and next work
- safely let an agent read and write through controlled MCP access
- understand project state quickly through dashboards

## Recommended Build Order
### Step 1
Core planning objects:
- Project
- Phase
- Milestone
- Task

### Step 2
Memory and decision objects:
- MemoryEntry
- Decision

### Step 3
Collaboration foundation:
- User
- Team
- ProjectGrant

### Step 4
Agent access foundation:
- MCPToken
- basic MCP read/write endpoints

### Step 5
Human visibility:
- dashboards
- recent activity summaries

## MVP Boundary Rule
If a feature does not directly improve one of these five areas,
- planning
- memory
- collaboration
- MCP access
- dashboard visibility

then it should probably wait until after the MVP.
