export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

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
  description: 'List tasks for a project, optionally filtered by status',
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

export const MCP_TOOLS = [
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
] as const;
