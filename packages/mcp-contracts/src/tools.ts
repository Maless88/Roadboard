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

export const MCP_TOOLS = [
  LIST_PROJECTS_TOOL,
  GET_PROJECT_TOOL,
  LIST_ACTIVE_TASKS_TOOL,
  GET_PROJECT_MEMORY_TOOL,
  CREATE_TASK_TOOL,
  UPDATE_TASK_STATUS_TOOL,
  CREATE_MEMORY_ENTRY_TOOL,
] as const;
