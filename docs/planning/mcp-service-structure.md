# Roadboard 2.0 MCP Service Structure

## Goal
Define the internal structure of the `mcp-service`.

This service is the controlled agent-facing surface of Roadboard 2.0.

It is responsible for:
- exposing MCP tools
- validating MCP token scope and access context
- orchestrating safe reads and writes against central services
- enforcing workflow guardrails for agents
- auditing agent activity

It must not become a second hidden business backend.

## Architectural Role
The `mcp-service` is a **protocol and workflow layer**, not the owner of canonical business entities.

It owns:
- MCP protocol surface
- tool definitions
- workflow composition
- token/principal enforcement at the MCP boundary
- agent-specific guardrails
- MCP-level audit metadata

It does **not** own:
- projects
- tasks
- memory entries
- decisions
- grants
- user identity

Those remain owned by `core-api` and `auth-access`.

## Recommended Technology
- TypeScript
- dedicated MCP service/process
- thin clients toward `core-api` and `auth-access`
- structured validation via shared MCP contracts

## Suggested Internal Layout

```text
apps/mcp-service/
  src/
    main.ts
    server/
      mcp.server.ts
      tool-registry.ts
    common/
      guards/
      decorators/
      pipes/
      filters/
      dto/
      utils/
      context/
    tools/
      read/
      write/
      workflow/
    workflows/
      task-context/
      project-summary/
      handoff/
      memory-capture/
    clients/
      core-api/
      auth-access/
    policies/
      token-scope/
      tool-usage/
      workflow-rules/
    audit/
    config/
  test/
    integration/
    contract/
  package.json
  tsconfig.json
```

## High-Level Design

### 1. `server/`
Contains the MCP server bootstrap and tool registration.

Responsibilities:
- initialize MCP server
- register tools
- bind tool handlers
- attach request context creation

Files:
- `mcp.server.ts`
- `tool-registry.ts`

### 2. `tools/read`
Contains read-only MCP tools.

Examples:
- `get_project`
- `list_projects`
- `list_active_tasks`
- `get_task_context`
- `get_project_memory`
- `list_recent_decisions`
- `get_dashboard_snapshot`

Design principle:
read tools should be frequent, safe, and easy for agents to use.

### 3. `tools/write`
Contains write-oriented MCP tools.

Examples:
- `create_task`
- `update_task_status`
- `create_memory_entry`
- `create_decision`
- `create_session_handoff`
- `issue_mcp_token`
- `revoke_mcp_token`

Design principle:
write tools must be narrower, more validated, and more strongly guarded than read tools.

### 4. `tools/workflow`
Contains higher-level workflow tools.

Examples:
- `prepare_task_context`
- `prepare_project_summary`
- `create_handoff_from_recent_activity`
- `suggest_memory_from_recent_work`

Design principle:
workflow tools reduce orchestration burden on the model.
They should encode safe, common multi-step flows.

## Workflow Layer

### `workflows/task-context`
Responsible for assembling task-focused context bundles.

May combine:
- task details
- related memory
- related decisions
- next steps
- blockers

### `workflows/project-summary`
Responsible for assembling concise project state.

May combine:
- project info
- milestone progress
- active tasks
- recent decisions
- recent memory

### `workflows/handoff`
Responsible for creating structured session handoffs.

May combine:
- recent activity
- open tasks
- blockers
- next steps
- continuity notes

### `workflows/memory-capture`
Responsible for controlled memory suggestion/capture flows.

May combine:
- recent work
- candidate learnings
- proposed durable memory entries

Important rule:
workflow modules orchestrate safe use of domain APIs, but do not own canonical domain rules.

## Clients Layer

### `clients/core-api`
Contains typed clients/adapters for:
- project reads
- task operations
- memory operations
- decision operations
- dashboard reads
- handoff operations

### `clients/auth-access`
Contains typed clients/adapters for:
- token validation
- principal resolution
- grant checks
- token metadata lookup
- optional token issuance/revocation when allowed

Important rule:
all service-to-service calls should flow through clients/adapters, not through scattered raw HTTP calls.

## Policies Layer

### `policies/token-scope`
Responsible for:
- token scope validation
- scope-to-tool mapping
- denial rules
- expiration and revocation checks

### `policies/tool-usage`
Responsible for:
- validating whether a tool is allowed in a given context
- requiring project/task resolution before certain writes
- preventing ambiguous or unsafe writes

### `policies/workflow-rules`
Responsible for:
- rules like:
  - read before write
  - resolve target before mutate
  - no durable memory without category and project
  - no task close without status-compatible action

Important rule:
agent guidance should not live only in prose prompts.
It should be backed by policy code where possible.

## Audit Layer

### `audit/`
Responsible for:
- MCP request logging
- tool invocation audit
- denied action audit
- token usage audit metadata
- correlation IDs for traceability

Important rule:
MCP operations must be auditable separately from ordinary human UI activity.

## Common Layer

### `common/context`
Contains:
- current MCP principal
- resolved project/task context helpers
- request metadata helpers

### `common/guards`
Contains:
- token guard
- scope guard
- tool access guards

### `common/pipes`
Contains:
- parameter validation
- normalization/parsing helpers

### `common/filters`
Contains:
- MCP error mapping
- downstream service error normalization

Important rule:
keep domain-specific workflow logic out of `common/`.

## Tool Design Principles

### Principle 1
Prefer many clear tools over a few vague ones.

### Principle 2
Read tools should be simple and composable.

### Principle 3
Write tools should require explicit, typed intent.

### Principle 4
Workflow tools should reflect real use cases, not generic abstraction.

### Principle 5
Never design a tool that invites the model to dump arbitrary unstructured state into the system.

Bad example:
- `write_anything_to_memory`

Good example:
- `create_memory_entry(project_id, category, title, body, related_task_id?)`

## Token and Principal Resolution Flow
Recommended request flow:
1. incoming MCP request
2. resolve token
3. validate token status and expiration
4. resolve principal and scopes
5. map scopes to allowed tools/actions
6. execute allowed tool via workflow or client
7. audit outcome

## Recommended Tool Classes For MVP

### Read tools
- `get_project`
- `list_projects`
- `list_project_milestones`
- `list_active_tasks`
- `get_task_context`
- `get_project_memory`
- `list_recent_decisions`
- `get_dashboard_snapshot`

### Write tools
- `create_task`
- `update_task_status`
- `create_memory_entry`
- `create_decision`
- `create_session_handoff`

### Workflow tools
- `prepare_task_context`
- `prepare_project_summary`
- `create_handoff_from_recent_activity`

## Rules To Lock In

### Rule 1
The MCP service must never bypass `auth-access` for token/grant decisions.

### Rule 2
The MCP service must never become the place where core project business rules are duplicated.

### Rule 3
The MCP service should make the model safer by design through tool contracts and workflow constraints.

### Rule 4
Every write-capable tool should be auditable.

### Rule 5
The service should be designed for multiple agent consumers, not only one vendor.

## Testing Strategy
Must include:
- contract tests for each tool
- scope enforcement tests
- denied action tests
- downstream service failure handling tests
- workflow tool integration tests

## Final Recommendation
The `mcp-service` should be a dedicated, policy-aware orchestration layer that makes Roadboard 2.0 safely usable by agents.

It should guide model behavior through:
- clear tool design
- strong token/scope validation
- workflow-aware orchestration
- auditability

without taking ownership away from the real domain services.
