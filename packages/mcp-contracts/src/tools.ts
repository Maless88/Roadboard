export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export const CREATE_PROJECT_TOOL: McpToolDefinition = {
  name: 'create_project',
  description: 'Create a new project in RoadBoard. Requires an ownerTeamId — retrieve one from list_projects if unknown.',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Project display name' },
      slug: { type: 'string', description: 'Unique URL-safe identifier (e.g. my-project)' },
      ownerTeamId: { type: 'string', description: 'ID of the team that owns the project' },
      description: { type: 'string', description: 'Optional project description' },
      status: {
        type: 'string',
        description: 'Initial project status',
        enum: ['draft', 'active', 'paused', 'completed', 'archived'],
      },
    },
    required: ['name', 'slug', 'ownerTeamId'],
  },
};


export const LIST_PROJECTS_TOOL: McpToolDefinition = {
  name: 'list_projects',
  description: 'List all projects the current token has access to',
  inputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        description: 'Filter by project status',
        enum: ['draft', 'active', 'paused', 'completed', 'archived'],
      },
    },
  },
};

export const GET_PROJECT_TOOL: McpToolDefinition = {
  name: 'get_project',
  description: 'Get details of a specific project',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'The project ID',
      },
    },
    required: ['projectId'],
  },
};

export const LIST_ACTIVE_TASKS_TOOL: McpToolDefinition = {
  name: 'list_active_tasks',
  description:
    'List tasks for a project. Recommended for large projects: pass `compact: true` to drop verbose fields (description, completionNotes), and `limit` for cursor-based pagination — without it the response can exceed MCP token limits. Without parameters returns the full list (back-compat).',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'The project ID',
      },
      status: {
        type: 'string',
        description: 'Filter by task status',
      },
      limit: {
        type: 'number',
        description:
          'Page size (1-200). When provided, response is `{ items, nextCursor }`. Pass nextCursor back as `cursor` for the next page. Omit for legacy flat-array response.',
      },
      cursor: {
        type: 'string',
        description: "Task id from a previous response's `nextCursor`. Requires `limit`.",
      },
      compact: {
        type: 'boolean',
        description:
          'If true, returns only id, title, status, priority, phaseId, dueDate, createdAt — dropping description and other verbose fields. Recommended default for agents browsing a project.',
      },
      fields: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Whitelist of fields to return (alternative to `compact`). Allowed: id, title, description, status, priority, phaseId, projectId, assigneeId, dueDate, completionNotes, completedAt, createdAt, updatedAt, createdByUserId, updatedByUserId. id is always included.',
      },
    },
    required: ['projectId'],
  },
};

export const GET_PROJECT_MEMORY_TOOL: McpToolDefinition = {
  name: 'get_project_memory',
  description: 'List memory entries for a project',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'The project ID',
      },
      type: {
        type: 'string',
        description: 'Filter by memory entry type',
      },
    },
    required: ['projectId'],
  },
};

export const CREATE_TASK_TOOL: McpToolDefinition = {
  name: 'create_task',
  description: 'Create a new task in a project',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'The project ID',
      },
      title: {
        type: 'string',
        description: 'The task title',
      },
      priority: {
        type: 'string',
        description: 'Task priority',
        enum: ['low', 'medium', 'high', 'critical'],
      },
    },
    required: ['projectId', 'title'],
  },
};

export const UPDATE_TASK_STATUS_TOOL: McpToolDefinition = {
  name: 'update_task_status',
  description: 'Update the status of a task',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: {
        type: 'string',
        description: 'The task ID',
      },
      status: {
        type: 'string',
        description: 'The new status',
      },
    },
    required: ['taskId', 'status'],
  },
};

export const CREATE_MEMORY_ENTRY_TOOL: McpToolDefinition = {
  name: 'create_memory_entry',
  description: 'Create a new memory entry in a project',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'The project ID',
      },
      type: {
        type: 'string',
        description: 'The memory entry type',
      },
      title: {
        type: 'string',
        description: 'The memory entry title',
      },
      body: {
        type: 'string',
        description: 'The memory entry body',
      },
    },
    required: ['projectId', 'type', 'title'],
  },
};

export const PREPARE_TASK_CONTEXT_TOOL: McpToolDefinition = {
  name: 'prepare_task_context',
  description: 'Assemble full context for a task: project info, the task itself, sibling tasks in the same phase, and recent memory entries. Use this before starting work on a task.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'The project ID',
      },
      taskId: {
        type: 'string',
        description: 'The task ID to build context for',
      },
    },
    required: ['projectId', 'taskId'],
  },
};

export const PREPARE_PROJECT_SUMMARY_TOOL: McpToolDefinition = {
  name: 'prepare_project_summary',
  description: 'Generate a structured project snapshot for agent onboarding: project details, task counts by status, open tasks, and memory entries.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'The project ID',
      },
    },
    required: ['projectId'],
  },
};

export const CREATE_HANDOFF_TOOL: McpToolDefinition = {
  name: 'create_handoff',
  description: 'Create a structured handoff memory entry from current session activity. Use at end of session to preserve context for the next agent or session.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'The project ID',
      },
      summary: {
        type: 'string',
        description: 'What was accomplished in this session',
      },
      next_steps: {
        type: 'array',
        items: { type: 'string' },
        description: 'Ordered list of next actions for the following session',
      },
    },
    required: ['projectId', 'summary'],
  },
};

export const LIST_RECENT_DECISIONS_TOOL: McpToolDefinition = {
  name: 'list_recent_decisions',
  description: 'List decisions for a project, optionally filtered by status',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'The project ID',
      },
      status: {
        type: 'string',
        description: 'Filter by decision status (open, accepted, rejected, superseded)',
      },
    },
    required: ['projectId'],
  },
};

export const CREATE_DECISION_TOOL: McpToolDefinition = {
  name: 'create_decision',
  description: 'Record an architectural or project decision',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'The project ID',
      },
      title: {
        type: 'string',
        description: 'Short title for the decision',
      },
      summary: {
        type: 'string',
        description: 'What was decided',
      },
      rationale: {
        type: 'string',
        description: 'Why this decision was made',
      },
      impactLevel: {
        type: 'string',
        description: 'Impact level: low, medium, high',
        enum: ['low', 'medium', 'high'],
      },
    },
    required: ['projectId', 'title', 'summary'],
  },
};

export const GET_PROJECT_CHANGELOG_TOOL: McpToolDefinition = {
  name: 'get_project_changelog',
  description: 'Generate a structured, agent-readable changelog for a project: task summary, active phases, recent decisions, recent memory entries, and recent audit events.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'The project ID',
      },
      auditLimit: {
        type: 'number',
        description: 'Number of recent audit events to include (default: 15)',
      },
    },
    required: ['projectId'],
  },
};


export const SEARCH_MEMORY_TOOL: McpToolDefinition = {
  name: 'search_memory',
  description: 'Search memory entries for a project by keyword. Searches both title and body fields.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'The project ID',
      },
      q: {
        type: 'string',
        description: 'Search query',
      },
    },
    required: ['projectId', 'q'],
  },
};


export const GET_ARCHITECTURE_MAP_TOOL: McpToolDefinition = {
  name: 'get_architecture_map',
  description: 'Get the architecture graph for a project: all current nodes (apps, packages, modules) and edges.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'The project ID',
      },
    },
    required: ['projectId'],
  },
};


export const GET_NODE_CONTEXT_TOOL: McpToolDefinition = {
  name: 'get_node_context',
  description: 'Get full context for an architecture node: annotations, links to tasks/decisions/memory, and impacted-by analysis.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'The project ID',
      },
      nodeId: {
        type: 'string',
        description: 'The architecture node ID',
      },
    },
    required: ['projectId', 'nodeId'],
  },
};


// ── Atomic write tools for agent-driven onboarding (B.2 flow) ──────────

export const CREATE_ARCHITECTURE_REPOSITORY_TOOL: McpToolDefinition = {
  name: 'create_architecture_repository',
  description: 'Create a CodeRepository record for a project. Required before creating any ArchitectureNode. Typical usage from an onboarding agent: call once per project at the start of the scan.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: { type: 'string', description: 'The project ID' },
      name: { type: 'string', description: 'Repository name (e.g. "my-monorepo")' },
      repoUrl: { type: 'string', description: 'Optional repo URL (git or local://)' },
      provider: {
        type: 'string',
        enum: ['github', 'gitlab', 'local', 'manual'],
        description: 'Source provider. Use "manual" when the agent scans a local path without a real remote',
      },
      defaultBranch: { type: 'string', description: 'Default branch (default: "main")' },
    },
    required: ['projectId', 'name'],
  },
};


export const CREATE_ARCHITECTURE_NODE_TOOL: McpToolDefinition = {
  name: 'create_architecture_node',
  description: 'Create an ArchitectureNode (workspace/module/service) inside the project graph. Call once per workspace when onboarding a monorepo. Requires a repositoryId created via create_architecture_repository.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: { type: 'string', description: 'The project ID' },
      repositoryId: { type: 'string', description: 'The CodeRepository ID (from create_architecture_repository)' },
      type: {
        type: 'string',
        enum: ['repository', 'app', 'package', 'module', 'service', 'file'],
        description: 'Node type — app/package for monorepo workspaces, module/service for finer grain',
      },
      name: { type: 'string', description: 'Short name (e.g. "web-app")' },
      path: { type: 'string', description: 'Path relative to repo root (e.g. "apps/web-app")' },
      description: { type: 'string', description: 'Optional human description (e.g. the full npm name)' },
      domainGroup: { type: 'string', description: 'Optional domain/bounded-context label (e.g. "billing")' },
    },
    required: ['projectId', 'repositoryId', 'type', 'name'],
  },
};


export const CREATE_ARCHITECTURE_EDGE_TOOL: McpToolDefinition = {
  name: 'create_architecture_edge',
  description: 'Create a directed edge between two ArchitectureNodes. The common case is edgeType="depends_on" emitted for each workspace-internal dependency discovered while parsing package.json.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: { type: 'string', description: 'The project ID' },
      fromNodeId: { type: 'string', description: 'Source node ID (the one that depends on the target)' },
      toNodeId: { type: 'string', description: 'Target node ID (the dependency)' },
      edgeType: {
        type: 'string',
        enum: ['depends_on', 'imports', 'impacts', 'linked_to'],
        description: 'Relationship type. depends_on for package.json deps, imports for ts-morph-parsed imports',
      },
      weight: { type: 'number', description: 'Optional weight (default 1.0)' },
    },
    required: ['projectId', 'fromNodeId', 'toNodeId', 'edgeType'],
  },
};


export const CREATE_ARCHITECTURE_LINK_TOOL: McpToolDefinition = {
  name: 'create_architecture_link',
  description: 'Link an ArchitectureNode to an existing RB entity (task, decision, milestone, memory entry). Use when the agent reads context (README, decision records) and wants to tie a node to its motivating task or architectural decision.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: { type: 'string', description: 'The project ID' },
      nodeId: { type: 'string', description: 'The source ArchitectureNode ID' },
      entityType: {
        type: 'string',
        enum: ['task', 'decision', 'milestone', 'memory_entry'],
        description: 'Type of target RB entity',
      },
      entityId: { type: 'string', description: 'CUID of the target RB entity' },
      linkType: {
        type: 'string',
        enum: ['implements', 'modifies', 'fixes', 'addresses', 'motivates', 'constrains', 'delivers', 'describes', 'warns_about'],
        description: 'Semantic relation from node to entity',
      },
      note: { type: 'string', description: 'Optional free-text note' },
    },
    required: ['projectId', 'nodeId', 'entityType', 'entityId', 'linkType'],
  },
};


export const CREATE_ARCHITECTURE_ANNOTATION_TOOL: McpToolDefinition = {
  name: 'create_architecture_annotation',
  description: 'Attach a free-text annotation to an ArchitectureNode. Use when the agent identifies something non-obvious from scanning code (e.g. "legacy module, scheduled for deprecation", "high-churn hotspot").',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: { type: 'string', description: 'The project ID' },
      nodeId: { type: 'string', description: 'The ArchitectureNode ID' },
      content: { type: 'string', description: 'Annotation text' },
    },
    required: ['projectId', 'nodeId', 'content'],
  },
};


export const LINK_TASK_TO_NODE_TOOL: McpToolDefinition = {
  name: 'link_task_to_node',
  description: 'Semantic wrapper over create_architecture_link: tie a task to one ArchitectureNode it will touch. Call this immediately after create_task when you know which workspace/module the task modifies. Populates the graph so that subsequent prepare_task_context calls receive richer execution context (related nodes, annotations, dependencies).',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: { type: 'string', description: 'The project ID' },
      taskId: { type: 'string', description: 'The task ID' },
      nodeId: { type: 'string', description: 'The ArchitectureNode ID' },
      linkType: {
        type: 'string',
        enum: ['implements', 'modifies', 'fixes', 'addresses', 'motivates', 'constrains', 'delivers', 'describes', 'warns_about'],
        description: "Semantic relation from task to node. Default: 'modifies'",
      },
      note: { type: 'string', description: 'Optional free-text note' },
    },
    required: ['projectId', 'taskId', 'nodeId'],
  },
};


export const INGEST_ARCHITECTURE_TOOL: McpToolDefinition = {
  name: 'ingest_architecture',
  description: 'One-shot orchestrator for agent-driven onboarding (B.2 flow). The agent scans the repository locally, builds a manifest (repository + nodes + edges + optional annotations), and sends it as a single tool call. Server fans out atomic writes, resolves node keys to IDs internally, and returns the mapping. Much faster than dozens of create_architecture_* calls. Node keys inside the payload are arbitrary string identifiers (usually package names) used only to link edges to nodes; they have no meaning in the database. Use `replaceExisting: true` to re-scan an already-onboarded project idempotently (wipes previous CodeFlow data for the project first).',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: { type: 'string', description: 'Target project ID' },
      replaceExisting: { type: 'boolean', description: 'If true, wipe all CodeFlow data (repositories, nodes, edges, links, annotations, snapshots) for this project before ingesting. Makes the call idempotent — safe to re-run on every scan. Default false.' },
      repository: {
        type: 'object',
        description: 'Single CodeRepository to create for this scan',
        properties: {
          name: { type: 'string', description: 'Repository name' },
          repoUrl: { type: 'string', description: 'Optional repo URL' },
          provider: {
            type: 'string',
            enum: ['github', 'gitlab', 'local', 'manual'],
            description: 'Source provider (default: manual)',
          },
          defaultBranch: { type: 'string', description: 'Default branch (default: main)' },
        },
        required: ['name'],
      },
      nodes: {
        type: 'array',
        description: 'All ArchitectureNodes to create — one per workspace/module. The "key" field is an identifier local to this payload (e.g. the npm package name) used only to resolve edges.',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string', description: 'Payload-local key, usually the npm package name' },
            type: {
              type: 'string',
              enum: ['repository', 'app', 'package', 'module', 'service', 'file'],
            },
            name: { type: 'string', description: 'Short display name' },
            path: { type: 'string', description: 'Path relative to repo root' },
            description: { type: 'string', description: 'Optional description' },
            domainGroup: { type: 'string', description: 'Optional domain/bounded-context label' },
            annotation: { type: 'string', description: 'Optional free-text annotation created together with the node — use this to attach semantic insight the agent derived from reading README/docs/comments' },
          },
          required: ['key', 'type', 'name'],
        },
      },
      edges: {
        type: 'array',
        description: 'Directed edges between nodes. Reference nodes by their "key" (not by id).',
        items: {
          type: 'object',
          properties: {
            from: { type: 'string', description: 'Source node key (must appear in nodes[])' },
            to: { type: 'string', description: 'Target node key (must appear in nodes[])' },
            type: {
              type: 'string',
              enum: ['depends_on', 'imports', 'impacts', 'linked_to'],
              description: 'Edge relationship',
            },
            weight: { type: 'number', description: 'Optional weight (default 1.0)' },
          },
          required: ['from', 'to', 'type'],
        },
      },
    },
    required: ['projectId', 'repository', 'nodes'],
  },
};


export const MCP_TOOLS = [
  CREATE_PROJECT_TOOL,
  LIST_PROJECTS_TOOL,
  GET_PROJECT_TOOL,
  LIST_ACTIVE_TASKS_TOOL,
  GET_PROJECT_MEMORY_TOOL,
  CREATE_TASK_TOOL,
  UPDATE_TASK_STATUS_TOOL,
  CREATE_MEMORY_ENTRY_TOOL,
  PREPARE_TASK_CONTEXT_TOOL,
  PREPARE_PROJECT_SUMMARY_TOOL,
  CREATE_HANDOFF_TOOL,
  LIST_RECENT_DECISIONS_TOOL,
  CREATE_DECISION_TOOL,
  GET_PROJECT_CHANGELOG_TOOL,
  SEARCH_MEMORY_TOOL,
  GET_ARCHITECTURE_MAP_TOOL,
  GET_NODE_CONTEXT_TOOL,
  CREATE_ARCHITECTURE_REPOSITORY_TOOL,
  CREATE_ARCHITECTURE_NODE_TOOL,
  CREATE_ARCHITECTURE_EDGE_TOOL,
  CREATE_ARCHITECTURE_LINK_TOOL,
  CREATE_ARCHITECTURE_ANNOTATION_TOOL,
  INGEST_ARCHITECTURE_TOOL,
  LINK_TASK_TO_NODE_TOOL,
] as const;
