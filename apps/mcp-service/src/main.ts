import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { optionalEnv } from "@roadboard/config";
import { CoreApiClient } from "./clients/core-api.client.js";


const MCP_TOKEN = optionalEnv("MCP_TOKEN", "");


const TOOLS = [
  {
    name: "list_projects",
    description: "List all projects the current token has access to",
    inputSchema: {
      type: "object" as const,
      properties: {
        status: {
          type: "string",
          description: "Filter by project status",
          enum: ["draft", "active", "paused", "completed", "archived"],
        },
      },
    },
  },
  {
    name: "get_project",
    description: "Get details of a specific project",
    inputSchema: {
      type: "object" as const,
      properties: {
        projectId: {
          type: "string",
          description: "The project ID",
        },
      },
      required: ["projectId"],
    },
  },
  {
    name: "list_active_tasks",
    description: "List tasks for a project, optionally filtered by status",
    inputSchema: {
      type: "object" as const,
      properties: {
        projectId: {
          type: "string",
          description: "The project ID",
        },
        status: {
          type: "string",
          description: "Filter by task status",
        },
      },
      required: ["projectId"],
    },
  },
  {
    name: "create_task",
    description: "Create a new task in a project",
    inputSchema: {
      type: "object" as const,
      properties: {
        projectId: {
          type: "string",
          description: "The project ID",
        },
        title: {
          type: "string",
          description: "The task title",
        },
        priority: {
          type: "string",
          description: "Task priority",
          enum: ["low", "medium", "high", "critical"],
        },
      },
      required: ["projectId", "title"],
    },
  },
  {
    name: "update_task_status",
    description: "Update the status of a task",
    inputSchema: {
      type: "object" as const,
      properties: {
        taskId: {
          type: "string",
          description: "The task ID",
        },
        status: {
          type: "string",
          description: "The new status",
        },
      },
      required: ["taskId", "status"],
    },
  },
  {
    name: "get_project_memory",
    description: "List memory entries for a project",
    inputSchema: {
      type: "object" as const,
      properties: {
        projectId: {
          type: "string",
          description: "The project ID",
        },
        type: {
          type: "string",
          description: "Filter by memory entry type",
        },
      },
      required: ["projectId"],
    },
  },
  {
    name: "create_memory_entry",
    description: "Create a new memory entry in a project",
    inputSchema: {
      type: "object" as const,
      properties: {
        projectId: {
          type: "string",
          description: "The project ID",
        },
        type: {
          type: "string",
          description: "The memory entry type",
        },
        title: {
          type: "string",
          description: "The memory entry title",
        },
        body: {
          type: "string",
          description: "The memory entry body",
        },
      },
      required: ["projectId", "type", "title"],
    },
  },
];


function jsonResponse(data: unknown): { content: { type: "text"; text: string }[] } {

  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}


function errorResponse(message: string): { content: { type: "text"; text: string }[]; isError: true } {

  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}


async function handleToolCall(
  client: CoreApiClient,
  name: string,
  args: Record<string, unknown>,
): Promise<{ content: { type: "text"; text: string }[]; isError?: true }> {

  switch (name) {
    case "list_projects": {
      const result = await client.listProjects(args.status as string | undefined);
      return jsonResponse(result);
    }

    case "get_project": {
      const result = await client.getProject(args.projectId as string);
      return jsonResponse(result);
    }

    case "list_active_tasks": {
      const result = await client.listTasks(
        args.projectId as string,
        args.status as string | undefined,
      );
      return jsonResponse(result);
    }

    case "create_task": {
      const result = await client.createTask({
        projectId: args.projectId as string,
        title: args.title as string,
        priority: args.priority as string | undefined,
      });
      return jsonResponse(result);
    }

    case "update_task_status": {
      const result = await client.updateTaskStatus(
        args.taskId as string,
        args.status as string,
      );
      return jsonResponse(result);
    }

    case "get_project_memory": {
      const result = await client.listMemory(
        args.projectId as string,
        args.type as string | undefined,
      );
      return jsonResponse(result);
    }

    case "create_memory_entry": {
      const result = await client.createMemoryEntry({
        projectId: args.projectId as string,
        type: args.type as string,
        title: args.title as string,
        body: args.body as string | undefined,
      });
      return jsonResponse(result);
    }

    default:
      return errorResponse(`Unknown tool: ${name}`);
  }
}


async function main(): Promise<void> {

  const server = new Server(
    { name: "roadboard-mcp", version: "0.0.1" },
    { capabilities: { tools: {} } },
  );

  const client = new CoreApiClient(MCP_TOKEN);

  server.setRequestHandler(ListToolsRequestSchema, async () => {

    return { tools: TOOLS };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {

    const { name, arguments: args } = request.params;

    try {
      return await handleToolCall(client, name, (args ?? {}) as Record<string, unknown>);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResponse(message);
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("MCP service failed to start:", err);
  process.exit(1);
});
