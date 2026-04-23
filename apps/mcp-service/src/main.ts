import express, { Request, Response, NextFunction } from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { optionalEnv } from "@roadboard/config";
import { CoreApiClient } from "./clients/core-api.client.js";


const CORE_API_HOST = optionalEnv("CORE_API_HOST", "localhost");
const CORE_API_PORT = optionalEnv("CORE_API_PORT", "3001");
const AUTH_ACCESS_HOST = optionalEnv("AUTH_ACCESS_HOST", "localhost");
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
    name: "list_teams",
    description: "List teams the current user belongs to, each with its slug and the caller's role. Call this before create_project to offer the user a concrete choice of ownerTeamSlug (their personal team is the one whose slug matches their username).",
    inputSchema: {
      type: "object" as const,
      properties: {},
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
    name: "list_phases",
    description: "List phases for a project",
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
    name: "create_task",
    description: "Create a new task in a project phase. If phaseId is omitted the first available phase is used automatically. IMPORTANT: immediately after the task is created, if it will modify any code (most tasks), call link_task_to_node for each ArchitectureNode it will touch. Use get_architecture_map to discover the right nodeId. This is mandatory unless the task is purely meta — it is how Roadboard populates the graph that powers future context retrieval.",
    inputSchema: {
      type: "object" as const,
      properties: {
        projectId: {
          type: "string",
          description: "The project ID",
        },
        phaseId: {
          type: "string",
          description: "The phase ID to assign the task to (use list_phases to discover IDs)",
        },
        title: {
          type: "string",
          description: "The task title",
        },
        description: {
          type: "string",
          description: "Detailed description of the task",
        },
        priority: {
          type: "string",
          description: "Task priority",
          enum: ["low", "medium", "high", "critical"],
        },
        assigneeId: {
          type: "string",
          description: "User ID to assign the task to",
        },
        dueDate: {
          type: "string",
          description: "Due date in ISO 8601 format (e.g. 2026-05-01T00:00:00Z)",
        },
      },
      required: ["projectId", "title"],
    },
  },
  {
    name: "update_task_status",
    description: "Update the status of a task. When closing a task (status=done), provide a detailed completionReport describing what was done: files modified with line numbers, tools called, memories written, and any other relevant detail.",
    inputSchema: {
      type: "object" as const,
      properties: {
        taskId: {
          type: "string",
          description: "The task ID",
        },
        status: {
          type: "string",
          description: "The new status (todo, in_progress, done, blocked, cancelled)",
        },
        completionReport: {
          type: "string",
          description: "Detailed markdown report of what was done to complete the task. Required when status=done. Include: files modified (path + line numbers), tools called, memories written, decisions made, timestamp.",
        },
      },
      required: ["taskId", "status"],
    },
  },
  {
    name: "update_task",
    description: "Update fields of an existing task (title, description, priority, phase, assignee, due date). Use update_task_status to change status.",
    inputSchema: {
      type: "object" as const,
      properties: {
        taskId: { type: "string", description: "The task ID" },
        title: { type: "string", description: "New title" },
        description: { type: "string", description: "New description" },
        phaseId: { type: "string", description: "Move task to a different phase" },
        priority: { type: "string", description: "New priority", enum: ["low", "medium", "high", "critical"] },
        assigneeId: { type: "string", description: "User ID to assign the task to" },
        dueDate: { type: "string", description: "Due date in ISO 8601 format" },
      },
      required: ["taskId"],
    },
  },
  {
    name: "create_phase",
    description: "Create a new phase (roadmap milestone) in a project.",
    inputSchema: {
      type: "object" as const,
      properties: {
        projectId: { type: "string", description: "The project ID" },
        title: { type: "string", description: "Phase title" },
        description: { type: "string", description: "Phase description" },
        decisionId: { type: "string", description: "Link this phase to a decision that it resolves" },
        orderIndex: { type: "number", description: "Position in the roadmap (0-based)" },
        status: { type: "string", description: "Phase status", enum: ["planned", "in_progress", "completed", "blocked"] },
        startDate: { type: "string", description: "Start date in ISO 8601 format" },
        endDate: { type: "string", description: "End date in ISO 8601 format" },
      },
      required: ["projectId", "title"],
    },
  },
  {
    name: "update_phase",
    description: "Update fields of an existing phase (title, status, dates, linked decision).",
    inputSchema: {
      type: "object" as const,
      properties: {
        phaseId: { type: "string", description: "The phase ID" },
        title: { type: "string", description: "New title" },
        description: { type: "string", description: "New description" },
        decisionId: { type: "string", description: "Link to a decision ID (or empty string to unlink)" },
        orderIndex: { type: "number", description: "New position in the roadmap" },
        status: { type: "string", description: "New status", enum: ["planned", "in_progress", "completed", "blocked"] },
        startDate: { type: "string", description: "Start date in ISO 8601 format" },
        endDate: { type: "string", description: "End date in ISO 8601 format" },
      },
      required: ["phaseId"],
    },
  },
  {
    name: "update_decision",
    description: "Update an existing decision: change status, record outcome, add rationale, or mark as resolved.",
    inputSchema: {
      type: "object" as const,
      properties: {
        decisionId: { type: "string", description: "The decision ID" },
        title: { type: "string", description: "New title" },
        summary: { type: "string", description: "Updated summary" },
        rationale: { type: "string", description: "Rationale for the decision" },
        outcome: { type: "string", description: "Outcome or result of the decision" },
        status: { type: "string", description: "New status", enum: ["open", "accepted", "rejected", "superseded"] },
        impactLevel: { type: "string", description: "Impact level", enum: ["low", "medium", "high"] },
        resolvedAt: { type: "string", description: "Resolution timestamp in ISO 8601 format" },
      },
      required: ["decisionId"],
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
    description: "Create a new memory entry in a project. Use `type` to classify the entry; only the enum values below are accepted.",
    inputSchema: {
      type: "object" as const,
      properties: {
        projectId: {
          type: "string",
          description: "The project ID",
        },
        type: {
          type: "string",
          description: "Memory entry type. Pick the closest match: done (milestone / completed work), next (planned action), decision (architectural or scope choice — prefer create_decision for formal decisions), handoff (session handoff — prefer create_handoff), architecture (system topology, module boundaries), issue (bug, defect, blocker, problem report), learning (insight, finding, discovery), operational_note (runbook, ops config, deploy detail), open_question (unresolved question).",
          enum: ["done", "next", "decision", "handoff", "architecture", "issue", "learning", "operational_note", "open_question"],
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
  {
    name: "get_project_changelog",
    description: "Generate a structured, agent-readable changelog for a project: task summary, active phases, recent decisions, recent memory entries, and recent audit events. Use this at session start for rapid onboarding.",
    inputSchema: {
      type: "object" as const,
      properties: {
        projectId: { type: "string", description: "The project ID" },
        auditLimit: {
          type: "number",
          description: "Number of recent audit events to include (default: 15)",
        },
      },
      required: ["projectId"],
    },
  },
  {
    name: "search_memory",
    description: "Search memory entries for a project by keyword. Searches both title and body fields.",
    inputSchema: {
      type: "object" as const,
      properties: {
        projectId: { type: "string", description: "The project ID" },
        q: { type: "string", description: "Search query" },
      },
      required: ["projectId", "q"],
    },
  },
  {
    name: "create_project",
    description: "Create a new project in RoadBoard. **IMPORTANT**: before calling this tool, if the user has not explicitly specified the owner team, call list_teams first and ASK the user which team should own the project (their personal team vs a shared team). Never pick an owner team silently. Provide exactly one of ownerTeamId (CUID) or ownerTeamSlug (human-friendly slug, e.g. the username for a personal team).",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Project display name" },
        slug: { type: "string", description: "Unique URL-safe identifier (e.g. my-project)" },
        ownerTeamId: { type: "string", description: "CUID of the team that owns the project" },
        ownerTeamSlug: { type: "string", description: "Slug of the team that owns the project (e.g. 'alessio' for your personal team, or 'core-team')" },
        description: { type: "string", description: "Optional project description" },
        status: {
          type: "string",
          description: "Initial project status",
          enum: ["draft", "active", "paused", "completed", "archived"],
        },
      },
      required: ["name", "slug"],
    },
  },
  {
    name: "get_architecture_map",
    description: "Get the architecture graph for a project: all current nodes (apps, packages, modules) and edges (depends_on, imports, etc.).",
    inputSchema: {
      type: "object" as const,
      properties: {
        projectId: { type: "string", description: "The project ID" },
      },
      required: ["projectId"],
    },
  },
  {
    name: "get_node_context",
    description: "Get full context for an architecture node: annotations, links to tasks/decisions/memory, and impacted-by analysis.",
    inputSchema: {
      type: "object" as const,
      properties: {
        projectId: { type: "string", description: "The project ID" },
        nodeId: { type: "string", description: "The architecture node ID" },
      },
      required: ["projectId", "nodeId"],
    },
  },
  {
    name: "create_architecture_repository",
    description: "Create a CodeRepository record for a project. Required before creating any ArchitectureNode. Typical agent flow: call once at the start of an onboarding scan, then use the returned id as repositoryId for each create_architecture_node call.",
    inputSchema: {
      type: "object" as const,
      properties: {
        projectId: { type: "string", description: "The project ID" },
        name: { type: "string", description: "Repository name (e.g. 'my-monorepo')" },
        repoUrl: { type: "string", description: "Optional repo URL (git or local://)" },
        provider: {
          type: "string",
          enum: ["github", "gitlab", "local", "manual"],
          description: "Source provider. Use 'manual' for an agent-driven scan of a local path",
        },
        defaultBranch: { type: "string", description: "Default branch (default: 'main')" },
      },
      required: ["projectId", "name"],
    },
  },
  {
    name: "create_architecture_node",
    description: "Create an ArchitectureNode (workspace/module/service) in the project graph. Call once per workspace while parsing package.json. Requires a repositoryId from create_architecture_repository.",
    inputSchema: {
      type: "object" as const,
      properties: {
        projectId: { type: "string", description: "The project ID" },
        repositoryId: { type: "string", description: "CodeRepository ID" },
        type: {
          type: "string",
          enum: ["repository", "app", "package", "module", "service", "file"],
          description: "Node type — app/package for monorepo workspaces",
        },
        name: { type: "string", description: "Short name (e.g. 'web-app')" },
        path: { type: "string", description: "Path relative to repo root" },
        description: { type: "string", description: "Optional human description" },
        domainGroup: { type: "string", description: "Optional domain/bounded-context label" },
      },
      required: ["projectId", "repositoryId", "type", "name"],
    },
  },
  {
    name: "create_architecture_edge",
    description: "Create a directed edge between two ArchitectureNodes. Emit edgeType='depends_on' for each workspace-internal dependency from package.json.",
    inputSchema: {
      type: "object" as const,
      properties: {
        projectId: { type: "string", description: "The project ID" },
        fromNodeId: { type: "string", description: "Source node ID" },
        toNodeId: { type: "string", description: "Target node ID" },
        edgeType: {
          type: "string",
          enum: ["depends_on", "imports", "impacts", "linked_to"],
          description: "Relationship type",
        },
        weight: { type: "number", description: "Optional weight (default 1.0)" },
      },
      required: ["projectId", "fromNodeId", "toNodeId", "edgeType"],
    },
  },
  {
    name: "create_architecture_link",
    description: "Link an ArchitectureNode to an existing RB entity (task, decision, milestone, memory entry). Use when the agent reads context and wants to tie a node to its motivating task or decision.",
    inputSchema: {
      type: "object" as const,
      properties: {
        projectId: { type: "string", description: "The project ID" },
        nodeId: { type: "string", description: "Source node ID" },
        entityType: {
          type: "string",
          enum: ["task", "decision", "milestone", "memory_entry"],
          description: "Target entity type",
        },
        entityId: { type: "string", description: "Target entity CUID" },
        linkType: {
          type: "string",
          enum: ["implements", "modifies", "fixes", "addresses", "motivates", "constrains", "delivers", "describes", "warns_about"],
          description: "Semantic relation",
        },
        note: { type: "string", description: "Optional note" },
      },
      required: ["projectId", "nodeId", "entityType", "entityId", "linkType"],
    },
  },
  {
    name: "create_architecture_annotation",
    description: "Attach a free-text annotation to an ArchitectureNode. Use for semantic context that cannot be derived from source (e.g. 'legacy module scheduled for deprecation', 'high-churn hotspot').",
    inputSchema: {
      type: "object" as const,
      properties: {
        projectId: { type: "string", description: "The project ID" },
        nodeId: { type: "string", description: "Node ID" },
        content: { type: "string", description: "Annotation text" },
      },
      required: ["projectId", "nodeId", "content"],
    },
  },
  {
    name: "link_task_to_node",
    description: "Semantic wrapper over create_architecture_link: tie a task to one ArchitectureNode it will touch. Call this immediately after create_task when you know which workspace/module the task modifies. Populates the graph so that subsequent prepare_task_context calls receive richer execution context.",
    inputSchema: {
      type: "object" as const,
      properties: {
        projectId: { type: "string", description: "The project ID" },
        taskId: { type: "string", description: "The task ID" },
        nodeId: { type: "string", description: "The ArchitectureNode ID" },
        linkType: {
          type: "string",
          enum: ["implements", "modifies", "fixes", "addresses", "motivates", "constrains", "delivers", "describes", "warns_about"],
          description: "Semantic relation from task to node. Default: 'modifies'",
        },
        note: { type: "string", description: "Optional note" },
      },
      required: ["projectId", "taskId", "nodeId"],
    },
  },
  {
    name: "ingest_architecture",
    description: "One-shot orchestrator for agent-driven onboarding (B.2 flow). The agent scans the repository locally, builds a manifest (repository + nodes + edges + optional annotations), and sends it as a single tool call. Server fans out atomic writes, resolves node keys to IDs internally. Much faster than dozens of create_architecture_* calls. Use `replaceExisting: true` to re-scan an already-onboarded project idempotently.",
    inputSchema: {
      type: "object" as const,
      properties: {
        projectId: { type: "string", description: "Target project ID" },
        replaceExisting: { type: "boolean", description: "Wipe previous CodeFlow data for this project before ingesting. Makes the call idempotent." },
        repository: {
          type: "object",
          description: "Single CodeRepository to create",
          properties: {
            name: { type: "string" },
            repoUrl: { type: "string" },
            provider: {
              type: "string",
              enum: ["github", "gitlab", "local", "manual"],
            },
            defaultBranch: { type: "string" },
          },
          required: ["name"],
        },
        nodes: {
          type: "array",
          description: "All nodes. 'key' is a payload-local identifier used to resolve edges (typically the npm package name).",
          items: {
            type: "object",
            properties: {
              key: { type: "string" },
              type: {
                type: "string",
                enum: ["repository", "app", "package", "module", "service", "file"],
              },
              name: { type: "string" },
              path: { type: "string" },
              description: { type: "string" },
              domainGroup: { type: "string" },
              annotation: { type: "string" },
            },
            required: ["key", "type", "name"],
          },
        },
        edges: {
          type: "array",
          description: "Directed edges. Reference nodes by 'key'.",
          items: {
            type: "object",
            properties: {
              from: { type: "string" },
              to: { type: "string" },
              type: {
                type: "string",
                enum: ["depends_on", "imports", "impacts", "linked_to"],
              },
              weight: { type: "number" },
            },
            required: ["from", "to", "type"],
          },
        },
      },
      required: ["projectId", "repository", "nodes"],
    },
  },
];


// Tools that require no scope (meta / protocol bootstrap)
const NO_SCOPE_TOOLS = new Set(["initial_instructions"]);

// Maps each tool to the minimum GrantType required
const TOOL_REQUIRED_SCOPES: Record<string, string> = {
  list_projects: "project.read",
  list_teams: "project.read",
  get_project: "project.read",
  list_active_tasks: "project.read",
  list_phases: "project.read",
  get_project_memory: "project.read",
  prepare_task_context: "project.read",
  prepare_project_summary: "project.read",
  get_project_changelog: "project.read",
  search_memory: "project.read",
  list_recent_decisions: "project.read",
  create_task: "task.write",
  update_task: "task.write",
  update_task_status: "task.write",
  create_phase: "project.write",
  update_phase: "project.write",
  create_memory_entry: "memory.write",
  create_handoff: "memory.write",
  create_decision: "decision.write",
  update_decision: "decision.write",
  create_project: "project.admin",
  get_architecture_map: "codeflow.read",
  get_node_context: "codeflow.read",
  create_architecture_repository: "codeflow.write",
  create_architecture_node: "codeflow.write",
  create_architecture_edge: "codeflow.write",
  create_architecture_link: "codeflow.write",
  create_architecture_annotation: "codeflow.write",
  ingest_architecture: "codeflow.write",
  link_task_to_node: "codeflow.write",
};


function checkScope(toolName: string, allowedScopes: string[]): string | null {

  if (NO_SCOPE_TOOLS.has(toolName)) {
    return null;
  }

  const required = TOOL_REQUIRED_SCOPES[toolName];

  if (!required) {
    return null;
  }

  const hasScope =
    allowedScopes.includes(required) || allowedScopes.includes("project.admin");

  if (!hasScope) {
    return `Insufficient scope: tool '${toolName}' requires '${required}'`;
  }

  return null;
}


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
  allowedScopes: string[],
  callerUserId?: string,
): Promise<{ content: { type: "text"; text: string }[]; isError?: true }> {

  const scopeError = checkScope(name, allowedScopes);

  if (scopeError) {
    return errorResponse(scopeError);
  }

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
          project_management: [
            {
              name: "create_project",
              purpose: "Bootstrap a new project in RoadBoard. If the user has not specified the owner team, call list_teams first and ASK the user which team to use.",
              when: "When onboarding a new codebase or work stream that has no RoadBoard project yet.",
              required_args: ["name", "slug"],
              optional_args: ["ownerTeamId", "ownerTeamSlug", "description", "status"],
            },
          ],
          read: [
            {
              name: "list_projects",
              purpose: "Discover all projects accessible with the current token.",
              when: "At session start or when switching project context.",
              required_args: [],
              optional_args: ["status"],
            },
            {
              name: "list_teams",
              purpose: "List teams the current user belongs to (id, slug, role). Use before create_project to let the user pick an owner team.",
              when: "Before create_project when the owner team has not been specified by the user.",
              required_args: [],
              optional_args: [],
            },
            {
              name: "get_project",
              purpose: "Get full project details including phases.",
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
              optional_args: ["phaseId", "description", "priority", "assigneeId", "dueDate"],
            },
            {
              name: "update_task",
              purpose: "Update task fields: title, description, priority, phase, assignee, due date.",
              when: "When task details change during execution (scope change, reassignment, deadline update).",
              required_args: ["taskId"],
              optional_args: ["title", "description", "phaseId", "priority", "assigneeId", "dueDate"],
            },
            {
              name: "update_task_status",
              purpose: "Update the status of a task. Provide completionReport when marking as done.",
              when: "As work progresses and on completion.",
              required_args: ["taskId", "status"],
              optional_args: ["completionReport"],
            },
            {
              name: "create_phase",
              purpose: "Create a new roadmap phase in a project.",
              when: "When planning a new milestone or sprint that groups related tasks.",
              required_args: ["projectId", "title"],
              optional_args: ["description", "decisionId", "orderIndex", "status", "startDate", "endDate"],
            },
            {
              name: "update_phase",
              purpose: "Update phase fields: title, status, dates, linked decision.",
              when: "When a phase progresses, is blocked, or its timeline changes.",
              required_args: ["phaseId"],
              optional_args: ["title", "description", "decisionId", "orderIndex", "status", "startDate", "endDate"],
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
              purpose: "Create a structured handoff memory entry summarizing the session and next steps.",
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
            {
              name: "update_decision",
              purpose: "Update a decision: record outcome, change status, mark as resolved.",
              when: "When a decision is accepted/rejected, its outcome is known, or it is superseded.",
              required_args: ["decisionId"],
              optional_args: ["title", "summary", "rationale", "outcome", "status", "impactLevel", "resolvedAt"],
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
          changelog: [
            {
              name: "get_project_changelog",
              purpose: "Structured agent-readable changelog: task summary, active roadmap phases, decisions, memory, recent audit events. Fastest way to onboard on what changed recently.",
              when: "At session start as an alternative to prepare_project_summary when you need audit trail context too.",
              required_args: ["projectId"],
              optional_args: ["auditLimit"],
            },
          ],
          memory: [
            {
              name: "search_memory",
              purpose: "Full-text search over memory entries (title + body).",
              when: "When looking for a specific past decision, note, or context by keyword.",
              required_args: ["projectId", "q"],
              optional_args: [],
            },
          ],
          architecture: [
            {
              name: "get_architecture_map",
              purpose: "Retrieve the architecture graph for a project: nodes (apps, packages, modules) and edges (depends_on, imports, etc.) at overview or module level.",
              when: "When working on CodeFlow tasks, assessing change impact, or understanding the codebase structure before making architectural decisions.",
              required_args: ["projectId"],
              optional_args: ["level"],
            },
            {
              name: "get_node_context",
              purpose: "Get full context for a specific architecture node: annotations, linked Tasks, Decisions, Memory entries, and impacted-by analysis.",
              when: "When investigating a specific component, before modifying a node, or to understand what RB entities are linked to it.",
              required_args: ["projectId", "nodeId"],
              optional_args: [],
            },
            {
              name: "link_task_to_node",
              purpose: "Tie a task to the ArchitectureNode(s) it will touch. Populates the task↔node graph so that subsequent prepare_task_context calls return richer execution context.",
              when: "IMMEDIATELY after create_task, whenever the task clearly modifies a known workspace/module. Check get_architecture_map first to find the matching nodeId. If multiple nodes are involved, call link_task_to_node once per node.",
              required_args: ["projectId", "taskId", "nodeId"],
              optional_args: ["linkType", "note"],
            },
            {
              name: "ingest_architecture",
              purpose: "One-shot orchestrator for agent-driven repository onboarding (B.2). The agent scans the repo locally, builds a manifest (repository + nodes + edges + optional annotations), and sends it as a single tool call. Use replaceExisting=true to re-scan idempotently.",
              when: "At project onboarding when no architecture graph exists yet, or when re-scanning a repo after structural changes.",
              required_args: ["projectId", "repository", "nodes"],
              optional_args: ["replaceExisting", "edges"],
            },
          ],
        },
        recommended_workflow: [
          {
            step: 1,
            action: "Call get_project_changelog(projectId) or prepare_project_summary(projectId) to load full project context including active roadmap phases.",
          },
          {
            step: 2,
            action: "If working on a specific task, call prepare_task_context(projectId, taskId).",
          },
          {
            step: 3,
            action: "When planning any activity: (a) call list_phases(projectId) to discover existing phases; (b) if the work fits an existing phase, create the task with that phaseId; (c) if no suitable phase exists, call create_phase first, then create_task with the new phaseId. Never create a task without a phaseId. Never create a duplicate phase if one already covers the work.",
          },
          {
            step: 4,
            action: "IMMEDIATELY after create_task: call get_architecture_map(projectId) (if you haven't already) and then call link_task_to_node for every ArchitectureNode the task will touch. This is mandatory for any task that modifies code — it populates the graph so later sessions can reconstruct the execution context. Skip only if the task is purely meta (e.g. renaming a project) and touches no code.",
          },
          {
            step: 5,
            action: "If the task involves broader architecture concerns, also call get_node_context for the touched nodes to read existing annotations and decisions before proposing changes.",
          },
          {
            step: 6,
            action: "Update task status as work progresses via update_task_status.",
          },
          {
            step: 7,
            action: "Store important decisions or discoveries with create_memory_entry or create_decision.",
          },
          {
            step: 8,
            action: "At session end, call create_handoff to preserve context for the next agent or session.",
          },
        ],
        operating_rules: [
          "Always call initial_instructions once at session start.",
          "Always open or identify a task before starting work. Every task MUST have a phaseId.",
          "When planning any activity: call list_phases first, assign the task to an existing phase if one fits, otherwise create a new phase first. Never skip phase assignment.",
          "Right after create_task, if the task modifies code, call link_task_to_node for EVERY ArchitectureNode the task touches. This is not optional — it is how Roadboard builds the graph that powers future context retrieval. If the architecture graph is empty, first run ingest_architecture or create_architecture_node.",
          "Do not report completion without updating the task status.",
          "Use create_memory_entry to persist architectural decisions and key findings.",
          "Use create_decision for any architectural choice, technology selection, or significant design decision.",
          "Always call create_handoff at the end of every session.",
          "Prefer get_project_changelog over multiple individual reads for onboarding — it includes roadmap phases, decisions, memory, and audit in one call.",
          "If a projectId is unknown, call list_projects first.",
          "For CodeFlow or architecture tasks, always call get_architecture_map before proposing changes.",
          "Use search_memory before creating a new memory entry to avoid duplicates.",
        ],
      });
    }

    case "create_project": {

      if (!args.ownerTeamId && !args.ownerTeamSlug) {
        throw new Error("create_project requires either ownerTeamId or ownerTeamSlug");
      }

      const result = await client.createProject({
        name: args.name as string,
        slug: args.slug as string,
        ownerTeamId: args.ownerTeamId as string | undefined,
        ownerTeamSlug: args.ownerTeamSlug as string | undefined,
        description: args.description as string | undefined,
        status: args.status as string | undefined,
      });
      const proj = result as Record<string, unknown>;
      await client.createMemoryEntry({
        projectId: proj.id as string,
        type: "done",
        title: `Progetto creato: ${proj.name as string}`,
        body: args.description ? `${args.description as string}` : undefined,
      }).catch(() => null);
      return jsonResponse(result);
    }

    case "list_teams": {

      if (!callerUserId) {
        return errorResponse("Cannot resolve caller identity from MCP token.");
      }

      const teams = await client.listMyTeams(callerUserId);
      return jsonResponse(teams);
    }

    case "list_projects": {
      const result = await client.listProjects(args.status as string | undefined);
      return jsonResponse(result);
    }

    case "get_project": {
      const result = await client.getProject(args.projectId as string);
      return jsonResponse(result);
    }

    case "list_phases": {
      const result = await client.listPhases(args.projectId as string);
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
      const projectId = args.projectId as string;
      let phaseId = args.phaseId as string | undefined;

      if (!phaseId) {
        const phases = await client.listPhases(projectId) as Array<Record<string, unknown>>;
        const first = phases.find((p) => p.status !== "completed" && p.status !== "archived") ?? phases[0];

        if (!first) {
          return errorResponse("No phases found in project. Create a phase first.");
        }

        phaseId = first.id as string;
      }

      const result = await client.createTask({
        projectId,
        phaseId,
        title: args.title as string,
        description: args.description as string | undefined,
        priority: args.priority as string | undefined,
        assigneeId: args.assigneeId as string | undefined,
        dueDate: args.dueDate as string | undefined,
      });

      const task = result as Record<string, unknown>;
      await client.createMemoryEntry({
        projectId,
        type: "done",
        title: `Task creato: ${task.title as string}`,
        body: `Fase: ${phaseId} · Priorità: ${(task.priority as string) ?? "medium"}`,
      }).catch(() => null);

      return jsonResponse(result);
    }

    case "update_task_status": {
      const result = await client.updateTaskStatus(
        args.taskId as string,
        args.status as string,
        args.completionReport as string | undefined,
      );
      return jsonResponse(result);
    }

    case "update_task": {
      const result = await client.updateTask(args.taskId as string, {
        title: args.title as string | undefined,
        description: args.description as string | undefined,
        phaseId: args.phaseId as string | undefined,
        priority: args.priority as string | undefined,
        assigneeId: args.assigneeId as string | undefined,
        dueDate: args.dueDate as string | undefined,
      });
      return jsonResponse(result);
    }

    case "create_phase": {
      const result = await client.createPhase({
        projectId: args.projectId as string,
        title: args.title as string,
        description: args.description as string | undefined,
        decisionId: args.decisionId as string | undefined,
        orderIndex: args.orderIndex as number | undefined,
        status: args.status as string | undefined,
        startDate: args.startDate as string | undefined,
        endDate: args.endDate as string | undefined,
      });
      return jsonResponse(result);
    }

    case "update_phase": {
      const result = await client.updatePhase(args.phaseId as string, {
        title: args.title as string | undefined,
        description: args.description as string | undefined,
        decisionId: args.decisionId as string | undefined,
        orderIndex: args.orderIndex as number | undefined,
        status: args.status as string | undefined,
        startDate: args.startDate as string | undefined,
        endDate: args.endDate as string | undefined,
      });
      return jsonResponse(result);
    }

    case "update_decision": {
      const result = await client.updateDecision(args.decisionId as string, {
        title: args.title as string | undefined,
        summary: args.summary as string | undefined,
        rationale: args.rationale as string | undefined,
        outcome: args.outcome as string | undefined,
        status: args.status as string | undefined,
        impactLevel: args.impactLevel as string | undefined,
        resolvedAt: args.resolvedAt as string | undefined,
      });
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

      const [project, tasks, memory, decisions, entityLinks] = await Promise.all([
        client.getProject(projectId),
        client.listTasks(projectId),
        client.listMemory(projectId),
        client.listDecisions(projectId).catch(() => []),
        client.listEntityArchitectureLinks(projectId, 'task', taskId).catch(() => ({ links: [], nodes: [] })),
      ]);

      const taskList = tasks as Array<Record<string, unknown>>;
      const task = taskList.find((t) => t.id === taskId);

      if (!task) {
        return errorResponse(`Task ${taskId} not found in project ${projectId}`);
      }

      const relatedTasks = taskList.filter(
        (t) => t.id !== taskId && t.phaseId === task.phaseId,
      );

      // Architecture nodes linkati al task
      const graphPayload = entityLinks as { links?: unknown[]; nodes?: unknown[] };
      const architectureNodes = graphPayload.nodes ?? [];

      // Decisions: (a) linkate al task direttamente via ArchitectureLink entityType='decision'
      //            (b) risolte dalla phase del task (Phase.decisionId)
      const linkedDecisionIds = new Set<string>();
      const directLinks = graphPayload.links ?? [];
      for (const l of directLinks as Array<{ entityType?: string; entityId?: string }>) {
        if (l.entityType === 'decision' && l.entityId) linkedDecisionIds.add(l.entityId);
      }
      const decisionList = decisions as Array<Record<string, unknown>>;
      const phaseId = task.phaseId as string | null | undefined;
      const linkedDecisions = decisionList.filter((d) => linkedDecisionIds.has(d.id as string));
      // Phase-level decision (Phase.decisionId) — resolver opzionale se phase include decisionId
      // Il listPhases non è nel client, skip for now; questa info arriva via future extension.

      // Memory targeted: filtra per tipi rilevanti ad esecuzione task
      const relevantTypes = new Set(['architecture', 'decision', 'issue', 'learning', 'done']);
      const memoryList = memory as Array<Record<string, unknown>>;
      const relatedMemory = memoryList.filter((m) => relevantTypes.has(m.type as string)).slice(0, 10);

      return jsonResponse({
        project,
        task,
        related_tasks: relatedTasks,
        recent_memory: memoryList.slice(0, 5),
        // New fields (CF-AGENT-01a) — additive, backward compatible
        architecture_nodes: architectureNodes,
        architecture_links: directLinks,
        linked_decisions: linkedDecisions,
        related_memory: relatedMemory,
        task_phase_id: phaseId,
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
      const dec = result as Record<string, unknown>;
      const bodyParts = [`Decisione: ${args.summary as string}`];

      if (args.rationale) bodyParts.push(`Rationale: ${args.rationale as string}`);
      if (args.impactLevel) bodyParts.push(`Impatto: ${args.impactLevel as string}`);

      await client.createMemoryEntry({
        projectId: args.projectId as string,
        type: "decision",
        title: `Decisione: ${dec.title as string}`,
        body: bodyParts.join("\n"),
      }).catch(() => null);

      return jsonResponse(result);
    }

    case "get_project_changelog": {
      const projectId = args.projectId as string;
      const auditLimit = (args.auditLimit as number | undefined) ?? 15;

      const [project, dashboard, decisions, memory, auditPage] = await Promise.all([
        client.getProject(projectId),
        client.getDashboard(projectId),
        client.listDecisions(projectId),
        client.listMemory(projectId),
        client.getAuditEvents(projectId, auditLimit),
      ]);

      const snap = dashboard as Record<string, unknown>;
      const memoryList = memory as Array<Record<string, unknown>>;
      const decisionList = decisions as Array<Record<string, unknown>>;
      const audit = auditPage as { events: Array<Record<string, unknown>>; total: number };

      const recentMemory = memoryList.slice(0, 10);

      return jsonResponse({
        generated_at: new Date().toISOString(),
        project,
        task_summary: snap.tasks,
        active_phases: snap.activePhases,
        urgent_tasks: snap.urgentTasks,
        open_decisions: decisionList.filter((d) => d.status === "open"),
        recent_decisions: decisionList.slice(0, 5),
        recent_memory: recentMemory,
        recent_activity: audit.events,
        total_audit_events: audit.total,
      });
    }

    case "search_memory": {
      const result = await client.searchMemory(
        args.projectId as string,
        args.q as string,
      );
      return jsonResponse(result);
    }

    case "get_architecture_map": {
      const result = await client.getArchitectureMap(args.projectId as string);
      return jsonResponse(result);
    }

    case "get_node_context": {
      const result = await client.getNodeContext(
        args.projectId as string,
        args.nodeId as string,
      );
      return jsonResponse(result);
    }

    case "create_architecture_repository": {
      const result = await client.createArchitectureRepository(
        args.projectId as string,
        {
          name: args.name as string,
          repoUrl: args.repoUrl as string | undefined,
          provider: args.provider as string | undefined,
          defaultBranch: args.defaultBranch as string | undefined,
        },
      );
      return jsonResponse(result);
    }

    case "create_architecture_node": {
      const result = await client.createArchitectureNode(
        args.projectId as string,
        {
          repositoryId: args.repositoryId as string,
          type: args.type as string,
          name: args.name as string,
          path: args.path as string | undefined,
          description: args.description as string | undefined,
          domainGroup: args.domainGroup as string | undefined,
        },
      );
      return jsonResponse(result);
    }

    case "create_architecture_edge": {
      const result = await client.createArchitectureEdge(
        args.projectId as string,
        {
          fromNodeId: args.fromNodeId as string,
          toNodeId: args.toNodeId as string,
          edgeType: args.edgeType as string,
          weight: args.weight as number | undefined,
        },
      );
      return jsonResponse(result);
    }

    case "create_architecture_link": {
      const result = await client.createArchitectureLink(
        args.projectId as string,
        args.nodeId as string,
        {
          entityType: args.entityType as string,
          entityId: args.entityId as string,
          linkType: args.linkType as string,
          note: args.note as string | undefined,
        },
      );
      return jsonResponse(result);
    }

    case "create_architecture_annotation": {
      const result = await client.createArchitectureAnnotation(
        args.projectId as string,
        args.nodeId as string,
        args.content as string,
      );
      return jsonResponse(result);
    }

    case "link_task_to_node": {
      const result = await client.createArchitectureLink(
        args.projectId as string,
        args.nodeId as string,
        {
          entityType: 'task',
          entityId: args.taskId as string,
          linkType: (args.linkType as string) ?? 'modifies',
          note: args.note as string | undefined,
        },
      );
      return jsonResponse(result);
    }

    case "ingest_architecture": {
      const projectId = args.projectId as string;
      const replaceExisting = args.replaceExisting === true;
      const repositoryPayload = args.repository as {
        name: string;
        repoUrl?: string;
        provider?: string;
        defaultBranch?: string;
      };

      let reset: { deletedNodes: number; deletedEdges: number } | null = null;

      if (replaceExisting) {
        reset = await client.resetArchitecture(projectId) as { deletedNodes: number; deletedEdges: number };
      }

      const nodesPayload = (args.nodes ?? []) as Array<{
        key: string;
        type: string;
        name: string;
        path?: string;
        description?: string;
        domainGroup?: string;
        annotation?: string;
      }>;
      const edgesPayload = (args.edges ?? []) as Array<{
        from: string;
        to: string;
        type: string;
        weight?: number;
      }>;

      const repo = await client.createArchitectureRepository(projectId, {
        name: repositoryPayload.name,
        repoUrl: repositoryPayload.repoUrl,
        provider: repositoryPayload.provider ?? "manual",
        defaultBranch: repositoryPayload.defaultBranch,
      }) as { id: string };

      const keyToId: Record<string, string> = {};
      let annotationCount = 0;

      for (const n of nodesPayload) {
        const created = await client.createArchitectureNode(projectId, {
          repositoryId: repo.id,
          type: n.type,
          name: n.name,
          path: n.path,
          description: n.description,
          domainGroup: n.domainGroup,
        }) as { id: string };
        keyToId[n.key] = created.id;

        if (n.annotation && n.annotation.trim().length > 0) {
          await client.createArchitectureAnnotation(projectId, created.id, n.annotation).catch(() => null);
          annotationCount++;
        }
      }

      let edgeCount = 0;
      const skippedEdges: Array<{ from: string; to: string; reason: string }> = [];
      for (const e of edgesPayload) {
        const fromId = keyToId[e.from];
        const toId = keyToId[e.to];

        if (!fromId || !toId) {
          skippedEdges.push({ from: e.from, to: e.to, reason: 'unknown key' });
          continue;
        }

        if (fromId === toId) {
          skippedEdges.push({ from: e.from, to: e.to, reason: 'self-edge' });
          continue;
        }

        await client.createArchitectureEdge(projectId, {
          fromNodeId: fromId,
          toNodeId: toId,
          edgeType: e.type,
          weight: e.weight,
        });
        edgeCount++;
      }

      return jsonResponse({
        repositoryId: repo.id,
        nodeCount: Object.keys(keyToId).length,
        edgeCount,
        annotationCount,
        skippedEdges,
        reset,
        nodesByKey: keyToId,
      });
    }

    default:
      return errorResponse(`Unknown tool: ${name}`);
  }
}


function buildServer(client: CoreApiClient, allowedScopes: string[], callerUserId?: string): Server {

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
      return await handleToolCall(client, name, (args ?? {}) as Record<string, unknown>, allowedScopes, callerUserId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResponse(message);
    }
  });

  return server;
}


interface TokenValidation {
  userId: string;
  scopes: string[];
}


async function validateMcpToken(rawToken: string): Promise<TokenValidation | null> {

  const res = await fetch(`http://${AUTH_ACCESS_HOST}:${AUTH_ACCESS_PORT}/tokens/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: rawToken }),
  }).catch(() => null);

  if (!res?.ok) {
    return null;
  }

  return res.json() as Promise<TokenValidation>;
}


async function fetchDependencyHealth(url: string): Promise<"ok" | "unreachable"> {

  const res = await fetch(url).catch(() => null);

  return res?.ok ? "ok" : "unreachable";
}


async function startHttp(): Promise<void> {

  const app = express();
  app.use(express.json());

  app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} auth=${req.headers.authorization?.slice(0, 20) ?? 'none'}`);
    next();
  });

  // Reject OAuth discovery — this server uses static Bearer tokens only
  app.use("/.well-known", (_req: Request, res: Response) => {
    res.status(404).json({ error: "OAuth not supported. Use static Bearer token." });
  });

  app.post("/register", (_req: Request, res: Response) => {
    res.status(404).json({ error: "Dynamic client registration not supported." });
  });

  app.get("/health", async (_req: Request, res: Response) => {
    const [coreApi, authAccess] = await Promise.all([
      fetchDependencyHealth(`http://${CORE_API_HOST}:${CORE_API_PORT}/health`),
      fetchDependencyHealth(`http://${AUTH_ACCESS_HOST}:${AUTH_ACCESS_PORT}/health`),
    ]);
    const healthy = coreApi === "ok" && authAccess === "ok";

    res.status(healthy ? 200 : 503).json({
      status: healthy ? "ok" : "degraded",
      service: "mcp-service",
      transport: "http",
      dependencies: { coreApi, authAccess },
    });
  });

  app.use(async (req: Request, res: Response, next: NextFunction) => {

    if (req.path === "/health") {
      next();
      return;
    }

    const auth = req.headers.authorization;

    if (!auth?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing or invalid Authorization header" });
      return;
    }

    const token = auth.slice(7);
    const validation = await validateMcpToken(token);

    if (!validation) {
      res.status(401).json({ error: "Invalid or revoked MCP token" });
      return;
    }

    const enriched = req as Request & { mcpToken: string; mcpScopes: string[]; mcpUserId: string };
    enriched.mcpToken = token;
    enriched.mcpScopes = validation.scopes;
    enriched.mcpUserId = validation.userId;
    next();
  });

  app.post("/mcp", async (req: Request, res: Response) => {

    const enriched = req as Request & { mcpToken: string; mcpScopes: string[]; mcpUserId: string };
    const client = new CoreApiClient(enriched.mcpToken);
    const server = buildServer(client, enriched.mcpScopes, enriched.mcpUserId);

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    await server.connect(transport);

    try {
      await transport.handleRequest(req, res, req.body as unknown);
    } finally {
      res.on("close", () => void server.close());
    }
  });

  app.all("/mcp", (_req: Request, res: Response) => {
    res.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed." }, id: null });
  });

  app.listen(MCP_HTTP_PORT, "0.0.0.0", () => {
    console.log(`mcp-service HTTP listening on port ${MCP_HTTP_PORT}`);
    console.log(`MCP endpoint: http://0.0.0.0:${MCP_HTTP_PORT}/mcp`);
  });
}


async function startStdio(): Promise<void> {

  const client = new CoreApiClient(MCP_TOKEN);

  let scopes: string[] = ["project.admin"];
  let userId: string | undefined;

  if (MCP_TOKEN) {
    const validation = await validateMcpToken(MCP_TOKEN).catch(() => null);

    if (validation) {
      scopes = validation.scopes;
      userId = validation.userId;
    }
  }

  const server = buildServer(client, scopes, userId);
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
