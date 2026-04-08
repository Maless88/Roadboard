import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { optionalEnv } from "@roadboard/config";
import { CoreApiClient } from "./clients/core-api.client.js";


const AUTH_ACCESS_PORT = optionalEnv("AUTH_ACCESS_PORT", "3002");
const MCP_TRANSPORT = optionalEnv("MCP_TRANSPORT", "stdio");
const MCP_HTTP_PORT = Number(optionalEnv("MCP_HTTP_PORT", "3005"));
const MCP_TOKEN = optionalEnv("MCP_TOKEN", "");


const TOOLS = [
  {
    name: "initial_instructions",
    description: "Call this tool ONCE at the start of every session. Returns the RoadBoard 2.0 MCP operational protocol: available tools, when to use them, recommended workflow, and operating rules.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
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
  {
    name: "prepare_task_context",
    description: "Assemble full context for a task: project info, the task itself, sibling tasks in the same phase, and recent memory entries.",
    inputSchema: {
      type: "object" as const,
      properties: {
        projectId: { type: "string", description: "The project ID" },
        taskId: { type: "string", description: "The task ID to build context for" },
      },
      required: ["projectId", "taskId"],
    },
  },
  {
    name: "prepare_project_summary",
    description: "Generate a structured project snapshot for agent onboarding: project details, task counts by status, open tasks, and memory entries.",
    inputSchema: {
      type: "object" as const,
      properties: {
        projectId: { type: "string", description: "The project ID" },
      },
      required: ["projectId"],
    },
  },
  {
    name: "create_handoff",
    description: "Create a structured handoff memory entry from current session activity. Use at end of session to preserve context for the next agent or session.",
    inputSchema: {
      type: "object" as const,
      properties: {
        projectId: { type: "string", description: "The project ID" },
        summary: { type: "string", description: "What was accomplished in this session" },
        next_steps: {
          type: "array",
          items: { type: "string" },
          description: "Ordered list of next actions for the following session",
        },
      },
      required: ["projectId", "summary"],
    },
  },
  {
    name: "list_recent_decisions",
    description: "List decisions for a project, optionally filtered by status",
    inputSchema: {
      type: "object" as const,
      properties: {
        projectId: { type: "string", description: "The project ID" },
        status: {
          type: "string",
          description: "Filter by decision status (open, accepted, rejected, superseded)",
        },
      },
      required: ["projectId"],
    },
  },
  {
    name: "create_decision",
    description: "Record an architectural or project decision",
    inputSchema: {
      type: "object" as const,
      properties: {
        projectId: { type: "string", description: "The project ID" },
        title: { type: "string", description: "Short title for the decision" },
        summary: { type: "string", description: "What was decided" },
        rationale: { type: "string", description: "Why this decision was made" },
        impactLevel: {
          type: "string",
          description: "Impact level: low, medium, high",
          enum: ["low", "medium", "high"],
        },
      },
      required: ["projectId", "title", "summary"],
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

    case "initial_instructions": {
      return jsonResponse({
        instruction_for_agent:
          "Call this tool once at the start of every session. It defines the RoadBoard 2.0 MCP operational protocol.",
        system: {
          name: "RoadBoard 2.0",
          description:
            "Multi-project execution, memory, and collaboration platform for humans and AI agents.",
          transport: "MCP (stdio or HTTP StreamableHTTP)",
        },
        tools: {
          read: [
            {
              name: "list_projects",
              purpose: "Discover all projects accessible with the current token.",
              when: "At session start or when switching project context.",
              required_args: [],
              optional_args: ["status"],
            },
            {
              name: "get_project",
              purpose: "Get full project details including phases and milestones.",
              when: "When you need structured project metadata.",
              required_args: ["projectId"],
              optional_args: [],
            },
            {
              name: "list_active_tasks",
              purpose: "List tasks for a project, optionally filtered by status.",
              when: "When browsing or searching for tasks.",
              required_args: ["projectId"],
              optional_args: ["status"],
            },
            {
              name: "get_project_memory",
              purpose: "Retrieve memory entries (decisions, handoffs, notes) for a project.",
              when: "When you need historical context or past decisions.",
              required_args: ["projectId"],
              optional_args: ["type"],
            },
          ],
          context: [
            {
              name: "prepare_project_summary",
              purpose:
                "Generate a full onboarding snapshot: project details, task counts by status, open tasks, memory entries.",
              when: "Use at the start of work on a project to load its full context in one call.",
              required_args: ["projectId"],
              optional_args: [],
            },
            {
              name: "prepare_task_context",
              purpose:
                "Assemble all context for a specific task: project info, the task itself, sibling tasks in the same phase, and recent memory.",
              when: "Before starting work on a specific task.",
              required_args: ["projectId", "taskId"],
              optional_args: [],
            },
          ],
          write: [
            {
              name: "create_task",
              purpose: "Create a new task in a project.",
              when: "Before starting any unit of work — always open a task first.",
              required_args: ["projectId", "title"],
              optional_args: ["priority"],
            },
            {
              name: "update_task_status",
              purpose: "Update the status of a task.",
              when: "As work progresses and on completion.",
              required_args: ["taskId", "status"],
              optional_args: [],
            },
            {
              name: "create_memory_entry",
              purpose: "Store a decision, note, or context entry for future sessions.",
              when: "After any meaningful decision, architectural choice, or discovery.",
              required_args: ["projectId", "type", "title"],
              optional_args: ["body"],
            },
            {
              name: "create_handoff",
              purpose:
                "Create a structured handoff memory entry summarizing the session and next steps.",
              when: "At the END of every session, before disconnecting.",
              required_args: ["projectId", "summary"],
              optional_args: ["next_steps"],
            },
            {
              name: "create_decision",
              purpose: "Record an architectural or project decision with rationale.",
              when: "After any architectural choice, technology selection, or significant design decision.",
              required_args: ["projectId", "title", "summary"],
              optional_args: ["rationale", "impactLevel"],
            },
          ],
          decisions: [
            {
              name: "list_recent_decisions",
              purpose: "Retrieve recorded decisions for a project.",
              when: "When onboarding on a project or before making a new decision to avoid duplication.",
              required_args: ["projectId"],
              optional_args: ["status"],
            },
          ],
        },
        recommended_workflow: [
          {
            step: 1,
            action: "Call prepare_project_summary(projectId) to load full project context.",
          },
          {
            step: 2,
            action:
              "If working on a specific task, call prepare_task_context(projectId, taskId).",
          },
          {
            step: 3,
            action:
              "Before starting work, ensure a task exists. Use create_task if needed.",
          },
          {
            step: 4,
            action: "Update task status as work progresses via update_task_status.",
          },
          {
            step: 5,
            action:
              "Store important decisions or discoveries with create_memory_entry.",
          },
          {
            step: 6,
            action:
              "At session end, call create_handoff to preserve context for the next agent or session.",
          },
        ],
        operating_rules: [
          "Always call initial_instructions once at session start.",
          "Always open or identify a task before starting work.",
          "Do not report completion without updating the task status.",
          "Use create_memory_entry to persist architectural decisions and key findings.",
          "Always call create_handoff at the end of every session.",
          "Prefer prepare_project_summary over multiple individual reads for onboarding.",
          "If a projectId is unknown, call list_projects first.",
        ],
      });
    }

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

    case "prepare_task_context": {
      const projectId = args.projectId as string;
      const taskId = args.taskId as string;

      const [project, tasks, memory] = await Promise.all([
        client.getProject(projectId),
        client.listTasks(projectId),
        client.listMemory(projectId),
      ]);

      const taskList = tasks as Array<Record<string, unknown>>;
      const task = taskList.find((t) => t.id === taskId);

      if (!task) {
        return errorResponse(`Task ${taskId} not found in project ${projectId}`);
      }

      const relatedTasks = taskList.filter(
        (t) => t.id !== taskId && t.phaseId === task.phaseId,
      );

      return jsonResponse({
        project,
        task,
        related_tasks: relatedTasks,
        recent_memory: (memory as unknown[]).slice(0, 5),
      });
    }

    case "prepare_project_summary": {
      const projectId = args.projectId as string;

      const [project, tasks, memory] = await Promise.all([
        client.getProject(projectId),
        client.listTasks(projectId),
        client.listMemory(projectId),
      ]);

      const taskList = tasks as Array<Record<string, unknown>>;

      const byStatus = taskList.reduce<Record<string, number>>((acc, t) => {
        const s = t.status as string;
        acc[s] = (acc[s] ?? 0) + 1;
        return acc;
      }, {});

      return jsonResponse({
        project,
        task_summary: { total: taskList.length, by_status: byStatus },
        open_tasks: taskList.filter((t) => t.status !== "done"),
        memory,
      });
    }

    case "create_handoff": {
      const projectId = args.projectId as string;
      const summary = args.summary as string;
      const nextSteps = args.next_steps as string[] | undefined;

      const parts: string[] = [`## Summary\n${summary}`];

      if (nextSteps && nextSteps.length > 0) {
        parts.push(`## Next Steps\n${nextSteps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`);
      }

      const result = await client.createMemoryEntry({
        projectId,
        type: "handoff",
        title: `Handoff — ${new Date().toISOString().slice(0, 10)}`,
        body: parts.join("\n\n"),
      });

      return jsonResponse(result);
    }

    case "list_recent_decisions": {
      const result = await client.listDecisions(
        args.projectId as string,
        args.status as string | undefined,
      );
      return jsonResponse(result);
    }

    case "create_decision": {
      const result = await client.createDecision({
        projectId: args.projectId as string,
        title: args.title as string,
        summary: args.summary as string,
        rationale: args.rationale as string | undefined,
        impactLevel: args.impactLevel as string | undefined,
      });
      return jsonResponse(result);
    }

    default:
      return errorResponse(`Unknown tool: ${name}`);
  }
}


function buildServer(client: CoreApiClient): Server {

  const server = new Server(
    { name: "roadboard-mcp", version: "0.0.1" },
    { capabilities: { tools: {} } },
  );

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

  return server;
}


async function validateMcpToken(rawToken: string): Promise<boolean> {

  const res = await fetch(`http://localhost:${AUTH_ACCESS_PORT}/tokens/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: rawToken }),
  }).catch(() => null);

  return res?.ok === true;
}


async function startHttp(): Promise<void> {

  const app = createMcpExpressApp({ host: "0.0.0.0" });

  app.use(async (req, res, next) => {

    const auth = req.headers.authorization;

    if (!auth?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing or invalid Authorization header" });
      return;
    }

    const token = auth.slice(7);
    const valid = await validateMcpToken(token);

    if (!valid) {
      res.status(401).json({ error: "Invalid or revoked MCP token" });
      return;
    }

    (req as Record<string, unknown> & typeof req).mcpToken = token;
    next();
  });

  app.post("/mcp", async (req, res) => {

    const token = (req as Record<string, unknown> & typeof req).mcpToken as string;
    const client = new CoreApiClient(token);
    const server = buildServer(client);

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    await server.connect(transport);

    try {
      await transport.handleRequest(req, res, req.body as unknown);
    } finally {
      res.on("close", () => server.close());
    }
  });

  app.get("/mcp", (_req, res) => {
    res.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null });
  });

  app.delete("/mcp", (_req, res) => {
    res.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null });
  });

  app.listen(MCP_HTTP_PORT, "0.0.0.0", () => {
    console.log(`mcp-service HTTP listening on port ${MCP_HTTP_PORT}`);
    console.log(`MCP endpoint: http://0.0.0.0:${MCP_HTTP_PORT}/mcp`);
  });
}


async function startStdio(): Promise<void> {

  const client = new CoreApiClient(MCP_TOKEN);
  const server = buildServer(client);
  const transport = new StdioServerTransport();

  await server.connect(transport);
}


async function main(): Promise<void> {

  if (MCP_TRANSPORT === "http") {
    await startHttp();
  } else {
    await startStdio();
  }
}


main().catch((err) => {
  console.error("MCP service failed to start:", err);
  process.exit(1);
});
