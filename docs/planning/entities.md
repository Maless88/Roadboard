# Roadboard 2.0 Entities

## Entity Model Overview
Roadboard 2.0 should be built around a small set of first-class entities with explicit relations.

The goal is to avoid mixing planning, memory, collaboration, and agent access inside the same generic object type.

## Core Domain Entities

### Project
Represents a project workspace.

Key fields:
- id
- name
- slug
- description
- status
- owner_team_id
- visibility
- created_at
- updated_at

### Phase
Represents a major phase of a project plan.

Key fields:
- id
- project_id
- title
- description
- order_index
- status
- start_date
- end_date

### Milestone
Represents a checkpoint or delivery target inside a phase or project.

Key fields:
- id
- project_id
- phase_id
- title
- description
- due_date
- status
- order_index

### Task
Represents actionable work.

Key fields:
- id
- project_id
- phase_id
- milestone_id
- title
- description
- status
- priority
- assignee_user_id
- created_by_user_id
- due_date
- estimate
- created_at
- updated_at

### TaskDependency
Represents a dependency between tasks.

Key fields:
- id
- from_task_id
- to_task_id
- dependency_type

## Memory and Knowledge Entities

### MemoryEntry
Represents stored project memory.

Key fields:
- id
- project_id
- category
- title
- body
- status
- durability
- source_type
- source_ref
- created_by_user_id
- created_at
- updated_at

Suggested categories:
- activity
- next_step
- decision_context
- architecture
- issue
- learning
- operational_note
- open_question

### Decision
Represents an explicit decision record.

Key fields:
- id
- project_id
- title
- summary
- rationale
- status
- impact_level
- created_by_user_id
- created_at
- updated_at

### SessionHandoff
Represents the summary of a work session for continuity.

Key fields:
- id
- project_id
- user_id
- title
- summary
- what_was_done
- next_steps
- blockers
- created_at

### FileReference
Represents a relevant file/module/repo path linked to work context.

Key fields:
- id
- project_id
- repo_name
- path
- description
- reference_type

## Collaboration Entities

### User
Represents a human account.

Key fields:
- id
- username
- display_name
- email
- status
- created_at

### Team
Represents a group of users.

Key fields:
- id
- name
- slug
- description
- created_at

### TeamMembership
Represents membership of a user in a team.

Key fields:
- id
- team_id
- user_id
- role
- status

### ProjectGrant
Represents a project-scoped permission assignment.

Key fields:
- id
- project_id
- subject_type
- subject_id
- grant_type
- granted_by_user_id
- created_at

Suggested grant types:
- project.read
- project.write
- task.write
- memory.write
- decision.write
- dashboard.read
- token.manage
- project.admin

## Agent / MCP Entities

### MCPToken
Represents an access token for MCP or agent usage.

Key fields:
- id
- owner_type
- owner_id
- token_name
- token_hash
- scope
- status
- expires_at
- created_at
- revoked_at

### AgentSession
Represents an interaction session through MCP or an integrated agent.

Key fields:
- id
- project_id
- token_id
- user_id
- agent_type
- started_at
- ended_at
- status

### ContextBundle
Represents a generated context package for an agent or human workflow.

Key fields:
- id
- project_id
- target_type
- target_id
- bundle_type
- content_ref
- created_by_type
- created_at

Bundle types might include:
- project_summary
- task_context
- handoff_context
- decision_digest
- active_work_snapshot

## Monitoring / Audit Entities

### ActivityEvent
Represents a logged action in the platform.

Key fields:
- id
- project_id
- actor_type
- actor_id
- event_type
- target_type
- target_id
- metadata
- created_at

### SyncRecord
Represents synchronization state between local MCP workflows and central storage.

Key fields:
- id
- project_id
- source_node
- sync_type
- status
- started_at
- finished_at
- details

## Relations To Preserve Explicitly
- Project -> has many -> Phase
- Project -> has many -> Milestone
- Project -> has many -> Task
- Project -> has many -> MemoryEntry
- Project -> has many -> Decision
- Project -> has many -> SessionHandoff
- Project -> has many -> ActivityEvent
- Phase -> has many -> Milestone
- Milestone -> has many -> Task
- Task -> may depend on -> Task
- Task -> may link to -> Decision
- Task -> may link to -> MemoryEntry
- SessionHandoff -> may produce -> MemoryEntry
- Decision -> may be supported by -> MemoryEntry
- User -> belongs to -> Team
- Team/User -> may receive -> ProjectGrant
- MCPToken -> may open -> AgentSession

## Recommended V1 First-Class Entities
For the first working version, the minimum strong entities should be:
- Project
- Phase
- Milestone
- Task
- MemoryEntry
- Decision
- User
- Team
- ProjectGrant
- MCPToken

The following can be introduced early if effort remains reasonable:
- SessionHandoff
- ActivityEvent
- ContextBundle
