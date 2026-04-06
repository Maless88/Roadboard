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

export const MCP_TOOLS = [LIST_PROJECTS_TOOL, GET_PROJECT_TOOL] as const;
