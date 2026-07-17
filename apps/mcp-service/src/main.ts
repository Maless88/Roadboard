import { fileURLToPath } from "node:url";
import express, { Request, Response, NextFunction } from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { optionalEnv } from "@roadboard/config";
import { checkLegacyTitle } from "@roadboard/mcp-contracts";
import { CoreApiClient } from "./clients/core-api.client.js";


const CORE_API_HOST = optionalEnv("CORE_API_HOST", "localhost");
const CORE_API_PORT = optionalEnv("CORE_API_PORT", "3001");
const AUTH_ACCESS_HOST = optionalEnv("AUTH_ACCESS_HOST", "localhost");
const AUTH_ACCESS_PORT = optionalEnv("AUTH_ACCESS_PORT", "3002");
const EMAIL_HELPER_URL = optionalEnv("EMAIL_HELPER_URL", "http://host.docker.internal:8789");
const EMAIL_HELPER_TOKEN = optionalEnv("EMAIL_HELPER_TOKEN", "");
const CALENDAR_HELPER_URL = optionalEnv("CALENDAR_HELPER_URL", "http://host.docker.internal:8790");
const CALENDAR_HELPER_TOKEN = optionalEnv("CALENDAR_HELPER_TOKEN", "");
const MCP_TRANSPORT = optionalEnv("MCP_TRANSPORT", "stdio");
const MCP_HTTP_PORT = Number(optionalEnv("MCP_HTTP_PORT", "3005"));
const MCP_TOKEN = optionalEnv("MCP_TOKEN", "");
const MCP_TOOL_PROFILE = optionalEnv("MCP_TOOL_PROFILE", "full");

const TOOL_PROFILES = ["workflow", "atlas", "personal", "full"] as const;
type ToolProfile = (typeof TOOL_PROFILES)[number];

const TASK_STATUSES = ["todo", "in_progress", "done", "blocked", "cancelled"] as const;
const OPEN_TASK_STATUSES = ["todo", "in_progress", "blocked"] as const;
const DEFAULT_SUMMARY_TASK_LIMIT = 25;
const DEFAULT_SUMMARY_MEMORY_LIMIT = 10;
const DEFAULT_CHANGELOG_AUDIT_LIMIT = 15;
const DEFAULT_CHANGELOG_MEMORY_LIMIT = 10;
const DEFAULT_CHANGELOG_DECISION_LIMIT = 5;
const DEFAULT_CHANGELOG_URGENT_TASK_LIMIT = 10;
const DEFAULT_CHANGELOG_PHASE_LIMIT = 10;
const MAX_AGGREGATE_LIMIT = 50;
const MAX_CHANGELOG_URGENT_TASK_LIMIT = 10;


export function parseToolProfile(value: string): ToolProfile {

  if ((TOOL_PROFILES as readonly string[]).includes(value)) {
    return value as ToolProfile;
  }

  throw new Error(`Invalid MCP_TOOL_PROFILE '${value}'. Allowed values: ${TOOL_PROFILES.join(", ")}`);
}


const ACTIVE_TOOL_PROFILE = parseToolProfile(MCP_TOOL_PROFILE);


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
          enum: ["draft", "active", "paused", "completed"],
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
    name: "get_user",
    description: "Look up a user by ID and return their public profile: id, username, displayName, email. Use this to resolve raw userId/assigneeId references into human-readable names.",
    inputSchema: {
      type: "object" as const,
      properties: {
        userId: {
          type: "string",
          description: "The user ID to resolve",
        },
      },
      required: ["userId"],
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
    description:
      "List tasks for a project. Recommended for large projects: pass `compact: true` to drop verbose fields (description, completionNotes), and `limit` for cursor-based pagination — without it the response can exceed MCP token limits. Without parameters returns the full list (back-compat).",
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
        limit: {
          type: "number",
          description:
            "Page size (1-200). When provided, response is `{ items, nextCursor }`. Pass nextCursor back as `cursor` for the next page. Omit for legacy flat-array response.",
        },
        cursor: {
          type: "string",
          description: "Task id from a previous response's `nextCursor`. Requires `limit`.",
        },
        compact: {
          type: "boolean",
          description:
            "If true, returns only id, title, status, priority, phaseId, dueDate, createdAt — dropping description and other verbose fields. Recommended default for agents browsing a project.",
        },
        fields: {
          type: "array",
          items: { type: "string" },
          description:
            "Whitelist of fields to return (alternative to `compact`). Allowed: id, title, description, status, priority, phaseId, projectId, assigneeId, dueDate, completionNotes, completedAt, createdAt, updatedAt, createdByUserId, updatedByUserId. id is always included.",
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
    description: `Create a task in a project phase. If it modifies code, use get_architecture_map then link_task_to_node for each touched ArchitectureNode. Title format: "Area — description"; avoid legacy codes like CF-XX-YY, [W4-06], audit-01.`,
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
          description: 'The task title. MUST follow the convention "Area — description" (e.g. "Atlas — Gruppi di dominio (CRUD)", "Memgraph — Estendi mirror a Link"). Do NOT use legacy codes like CF-XX-YY or [W4-06].',
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
    name: "delete_task",
    description: "Permanently delete a task. Irreversible — there is no soft-delete or undo. Use only when the task was created in error or is no longer relevant; prefer update_task_status with status='cancelled' to preserve history.",
    inputSchema: {
      type: "object" as const,
      properties: {
        taskId: { type: "string", description: "The task ID to delete" },
      },
      required: ["taskId"],
    },
  },
  {
    name: "create_phase",
    description: `Create a new phase (roadmap milestone) in a project.

TITLE NAMING CONVENTION: Phase title MUST follow the format "Area — description". Examples: "Atlas — Architettura base e onboarding", "Memgraph — Migration e schema graph DB", "Workspaces — Team invite flow". Avoid legacy codes like CF-XX-YY, [W4-06], audit-01 in the title.`,
    inputSchema: {
      type: "object" as const,
      properties: {
        projectId: { type: "string", description: "The project ID" },
        title: { type: "string", description: 'Phase title. MUST follow the convention "Area — description" (e.g. "Atlas — Architettura base e onboarding"). Do NOT use legacy codes.' },
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
    description: "Generate a bounded project snapshot for agent onboarding: project details, task counts by status, limited compact open tasks, and limited memory entries.",
    inputSchema: {
      type: "object" as const,
      properties: {
        projectId: { type: "string", description: "The project ID" },
        taskLimit: { type: "number", description: "Max open tasks to return (1-50, default 25)." },
        memoryLimit: { type: "number", description: "Max memory entries to return (1-50, default 10)." },
        compact: { type: "boolean", description: "Return compact task and memory shapes by default. Set false for full returned items." },
        taskCursor: { type: "string", description: "Cursor from collection_metadata.open_tasks.nextCursor for the next open_tasks page." },
        statuses: {
          type: "array",
          uniqueItems: true,
          items: { type: "string", enum: ["todo", "in_progress", "done", "blocked", "cancelled"] },
          description: "Task statuses to include in open_tasks. Default: todo, in_progress, blocked.",
        },
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
    description: "Generate a bounded, agent-readable changelog for a project: task summary, active phases, decisions, memory, urgent tasks, and audit events. Use this at session start for rapid onboarding.",
    inputSchema: {
      type: "object" as const,
      properties: {
        projectId: { type: "string", description: "The project ID" },
        auditLimit: {
          type: "number",
          description: "Number of recent audit events to include (1-50, default: 15)",
        },
        memoryLimit: { type: "number", description: "Number of recent memory entries to include (1-50, default: 10)." },
        decisionLimit: { type: "number", description: "Number of decisions per section to include (1-50, default: 5)." },
        urgentTaskLimit: { type: "number", description: "Number of urgent tasks to include (1-10, default: 10; dashboard currently pages at 10)." },
        phaseLimit: { type: "number", description: "Number of active/recent phases to include (1-50, default: 10)." },
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
          enum: ["draft", "active", "paused", "completed"],
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
    name: "get_architecture_snapshot",
    description:
      "Get a compact architecture snapshot for a project: summary by node/edge type, top 5 highest-impact nodes, and the 10 most recent annotations. Payload is always < 8 KB — suitable for agent context windows.",
    inputSchema: {
      type: "object" as const,
      properties: {
        projectId: { type: "string", description: "The project ID" },
      },
      required: ["projectId"],
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
  {
    name: "list_skills",
    description:
      "List the agent-skills catalog. Without args returns the full catalog ({name, description}). With `agentSlug`, returns each skill plus an `attached` flag for that agent.",
    inputSchema: {
      type: "object" as const,
      properties: {
        agentSlug: { type: "string", description: "Agent slug to annotate attachment for (optional)." },
      },
    },
  },
  {
    name: "attach_skill",
    description: "Attach a skill (by catalog name) to an agent. Surfaces in the agent profile card.",
    inputSchema: {
      type: "object" as const,
      properties: {
        agentSlug: { type: "string", description: "Agent slug." },
        name: { type: "string", description: "Skill name (must exist in the catalog)." },
      },
      required: ["agentSlug", "name"],
    },
  },
  {
    name: "detach_skill",
    description: "Detach a skill from an agent.",
    inputSchema: {
      type: "object" as const,
      properties: {
        agentSlug: { type: "string", description: "Agent slug." },
        name: { type: "string", description: "Skill name." },
      },
      required: ["agentSlug", "name"],
    },
  },
  {
    name: "sync_skills_catalog",
    description:
      "Upsert the skills catalog from the host SKILL.md frontmatters. Pass `skills` as an array of {name, description}.",
    inputSchema: {
      type: "object" as const,
      properties: {
        skills: {
          type: "array",
          items: {
            type: "object",
            properties: { name: { type: "string" }, description: { type: "string" } },
            required: ["name"],
          },
        },
      },
      required: ["skills"],
    },
  },
  {
    name: "read_inbox",
    description:
      "Read recent emails (read-only, does not mark them read) from a configured account. Returns sender, subject, date, unread flag and a short snippet. Use to triage the user's inbox.",
    inputSchema: {
      type: "object" as const,
      properties: {
        account: { type: "string", description: "Mailbox account name as configured in the email helper (defaults to EMAIL_DEFAULT_ACCOUNT)." },
        limit: { type: "number", description: "How many recent messages (1-30, default 10)." },
      },
    },
  },
  {
    name: "mark_read",
    description:
      "Mark specific emails as read (sets the IMAP \\Seen flag). Use ONLY when the user explicitly asks to mark email(s) as read. Pass the uid values returned by read_inbox.",
    inputSchema: {
      type: "object" as const,
      properties: {
        account: { type: "string", description: "Mailbox account name as configured in the email helper (defaults to EMAIL_DEFAULT_ACCOUNT)." },
        uids: { type: "array", items: { type: "number" }, description: "UIDs of the messages to mark read (from read_inbox)." },
      },
      required: ["uids"],
    },
  },
  {
    name: "create_draft",
    description:
      "Save an email DRAFT in the user's mailbox (Drafts folder). This NEVER sends the email — the user reviews it in their mail client and sends it manually. Use to prepare replies or new messages on the user's behalf. For a reply, pass in_reply_to = the message_id from read_inbox so it threads.",
    inputSchema: {
      type: "object" as const,
      properties: {
        account: { type: "string", description: "Mailbox account name as configured in the email helper (defaults to EMAIL_DEFAULT_ACCOUNT)." },
        to: { type: "string", description: "Recipient address(es), comma-separated." },
        subject: { type: "string", description: "Subject line." },
        body: { type: "string", description: "Plain-text body." },
        cc: { type: "string", description: "Optional Cc address(es)." },
        in_reply_to: { type: "string", description: "Optional Message-ID being replied to (from read_inbox), for threading." },
      },
      required: ["to", "body"],
    },
  },
  {
    name: "list_events",
    description:
      "List the user's upcoming calendar events (Nextcloud) in the next N days. Returns start, end, summary, location, calendar. Use to check the agenda / answer 'what's coming up'.",
    inputSchema: {
      type: "object" as const,
      properties: {
        days: { type: "number", description: "Horizon in days (1-120, default 14)." },
        calendar: { type: "string", description: "Optional calendar name to filter." },
      },
    },
  },
  {
    name: "create_event",
    description:
      "Create a calendar event (Nextcloud). start/end are ISO datetimes (es. 2026-07-02T15:00:00, timezone Europe/Rome se senza offset) oppure una data YYYY-MM-DD per un evento tutto-il-giorno. Use to schedule meetings/appointments on the user's request.",
    inputSchema: {
      type: "object" as const,
      properties: {
        summary: { type: "string", description: "Event title." },
        start: { type: "string", description: "ISO datetime or YYYY-MM-DD (all-day)." },
        end: { type: "string", description: "Optional ISO datetime / date; default +1h (or +1 day all-day)." },
        description: { type: "string", description: "Optional details." },
        location: { type: "string", description: "Optional location." },
        calendar: { type: "string", description: "Optional target calendar name (default the user's primary)." },
      },
      required: ["summary", "start"],
    },
  },
  {
    name: "delete_event",
    description:
      "Delete a calendar event by its href (the value returned by create_event / present in the event). Use only on explicit user request.",
    inputSchema: {
      type: "object" as const,
      properties: { href: { type: "string", description: "Event href (CalDAV URL)." } },
      required: ["href"],
    },
  },
  {
    name: "notify",
    description:
      "Send a proactive notification to the user (delivered via Telegram by the notification hub). Use for things worth telling the user without being asked. Keep it short.",
    inputSchema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Short headline." },
        body: { type: "string", description: "Optional detail." },
        level: { type: "string", enum: ["info", "warn", "alert"], description: "Severity (default info)." },
        from: { type: "string", description: "Your agent slug, for attribution (optional)." },
      },
      required: ["title"],
    },
  },
  {
    name: "create_scheduled_activity",
    description:
      "Schedule a recurring or one-off activity: an agent runs `promptTemplate` on a cadence. kind=cron (cronExpr, 5-field), kind=interval (everyMs), kind=once (runAt ISO). The run is delivered into the agent's room. Use to set up periodic agent work (e.g. a daily digest).",
    inputSchema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Short human title." },
        agentSlug: { type: "string", description: "Slug of the agent that runs each occurrence." },
        promptTemplate: { type: "string", description: "The instruction given to the agent on every run." },
        kind: { type: "string", enum: ["cron", "interval", "once"], description: "Schedule kind." },
        cronExpr: { type: "string", description: "5-field cron expression (kind=cron), evaluated in tz." },
        everyMs: { type: "number", description: "Interval in milliseconds (kind=interval)." },
        runAt: { type: "string", description: "ISO datetime for a one-off run (kind=once)." },
        tz: { type: "string", description: "IANA timezone (default Europe/Rome)." },
        projectId: { type: "string", description: "Optional project to associate." },
        deliveryRoomId: { type: "string", description: "Room to deliver into; omit to auto-use the agent's direct room." },
      },
      required: ["title", "agentSlug", "promptTemplate", "kind"],
    },
  },
  {
    name: "create_reminder",
    description:
      "Set a reminder for the user. At the scheduled time the `text` is delivered straight to the user (Telegram) — no agent run, no cost. Provide exactly one of: at (ISO datetime, one-off), cron (5-field, recurring), every_minutes (recurring interval). Use for 'remind me…' requests, birthdays, recurring nudges.",
    inputSchema: {
      type: "object" as const,
      properties: {
        text: { type: "string", description: "The reminder message delivered to the user." },
        at: { type: "string", description: "ISO datetime for a one-off reminder (kind=once)." },
        cron: { type: "string", description: "5-field cron expression for a recurring reminder, evaluated in tz." },
        every_minutes: { type: "number", description: "Recurring interval in minutes." },
        title: { type: "string", description: "Optional short title (defaults to the text)." },
        tz: { type: "string", description: "IANA timezone (default Europe/Rome)." },
      },
      required: ["text"],
    },
  },
  {
    name: "list_scheduled_activities",
    description: "List the caller's scheduled activities (optionally filtered by projectId).",
    inputSchema: {
      type: "object" as const,
      properties: { projectId: { type: "string", description: "Optional project filter." } },
    },
  },
  {
    name: "pause_scheduled_activity",
    description: "Pause a scheduled activity (stops future runs until resumed).",
    inputSchema: { type: "object" as const, properties: { id: { type: "string" } }, required: ["id"] },
  },
  {
    name: "delete_scheduled_activity",
    description: "Permanently delete a scheduled activity.",
    inputSchema: { type: "object" as const, properties: { id: { type: "string" } }, required: ["id"] },
  },
];

const TOOL_PROFILE_NAMES: Record<ToolProfile, readonly string[]> = {
  workflow: [
    "initial_instructions",
    "list_projects",
    "get_project",
    "list_active_tasks",
    "list_phases",
    "create_task",
    "update_task_status",
    "update_task",
    "create_phase",
    "update_phase",
    "create_memory_entry",
    "prepare_task_context",
    "prepare_project_summary",
    "create_handoff",
    "list_recent_decisions",
    "create_decision",
    "update_decision",
    "get_project_changelog",
    "search_memory",
    "get_architecture_map",
    "link_task_to_node",
  ],
  atlas: [
    "initial_instructions",
    "list_projects",
    "get_project",
    "list_active_tasks",
    "prepare_task_context",
    "get_project_changelog",
    "get_architecture_map",
    "get_node_context",
    "get_architecture_snapshot",
    "create_architecture_repository",
    "create_architecture_node",
    "create_architecture_edge",
    "create_architecture_link",
    "create_architecture_annotation",
    "link_task_to_node",
    "ingest_architecture",
  ],
  personal: [
    "initial_instructions",
    "read_inbox",
    "mark_read",
    "create_draft",
    "list_events",
    "create_event",
    "delete_event",
    "notify",
    "create_scheduled_activity",
    "create_reminder",
    "list_scheduled_activities",
    "pause_scheduled_activity",
    "delete_scheduled_activity",
  ],
  full: TOOLS.map((tool) => tool.name),
};

export const SUPPORTED_TOOL_PROFILES = TOOL_PROFILES;
export const DEFAULT_TOOL_PROFILE = "full";


export function getToolsForProfile(profile: ToolProfile = ACTIVE_TOOL_PROFILE): typeof TOOLS {

  const names = new Set(TOOL_PROFILE_NAMES[profile]);
  return TOOLS.filter((tool) => names.has(tool.name));
}


function getToolNameSet(profile: ToolProfile = ACTIVE_TOOL_PROFILE): Set<string> {

  return new Set(getToolsForProfile(profile).map((tool) => tool.name));
}


// Tools that require no scope (meta / protocol bootstrap)
const NO_SCOPE_TOOLS = new Set(["initial_instructions"]);

// Maps each tool to the minimum GrantType required
const TOOL_REQUIRED_SCOPES: Record<string, string> = {
  list_projects: "project.read",
  list_teams: "project.read",
  get_project: "project.read",
  get_user: "project.read",
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
  delete_task: "task.write",
  create_phase: "project.write",
  update_phase: "project.write",
  create_memory_entry: "memory.write",
  create_handoff: "memory.write",
  create_decision: "decision.write",
  update_decision: "decision.write",
  create_project: "project.admin",
  list_skills: "project.read",
  attach_skill: "project.write",
  detach_skill: "project.write",
  sync_skills_catalog: "project.write",
  read_inbox: "project.read",
  mark_read: "project.write",
  create_draft: "project.write",
  list_events: "project.read",
  create_event: "project.write",
  delete_event: "project.write",
  notify: "project.write",
  list_scheduled_activities: "project.read",
  create_scheduled_activity: "project.write",
  create_reminder: "project.write",
  pause_scheduled_activity: "project.write",
  delete_scheduled_activity: "project.write",
  get_architecture_map: "codeflow.read",
  get_node_context: "codeflow.read",
  get_architecture_snapshot: "codeflow.read",
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
    // Default-deny: every tool must be explicitly mapped (or listed in
    // NO_SCOPE_TOOLS). An unmapped tool is a wiring bug, not an open door.
    return `Tool '${toolName}' has no scope mapping — denied by default`;
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


function boundedNumber(
  value: unknown,
  defaultValue: number,
  max: number,
  name: string,
): number {

  if (value === undefined || value === null) {
    return defaultValue;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > max) {
    throw new Error(`${name} must be an integer between 1 and ${max}`);
  }

  return value;
}


function pageItems(value: unknown): Array<Record<string, unknown>> {

  if (Array.isArray(value)) {
    return value as Array<Record<string, unknown>>;
  }

  if (
    value !== null &&
    typeof value === "object" &&
    Array.isArray((value as { items?: unknown }).items)
  ) {
    return (value as { items: Array<Record<string, unknown>> }).items;
  }

  return [];
}


function nextCursor(value: unknown): string | null {

  if (value !== null && typeof value === "object" && "nextCursor" in value) {
    const cursor = (value as { nextCursor?: unknown }).nextCursor;
    return typeof cursor === "string" ? cursor : null;
  }

  return null;
}


function compactTask(task: Record<string, unknown>): Record<string, unknown> {

  return {
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    phaseId: task.phaseId,
    assigneeId: task.assigneeId,
    dueDate: task.dueDate,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}


function compactMemory(entry: Record<string, unknown>, compact: boolean): Record<string, unknown> {

  if (!compact) {
    return entry;
  }

  return {
    id: entry.id,
    type: entry.type,
    title: entry.title,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}


function parseSummaryStatuses(value: unknown): string[] {

  if (value === undefined) {
    return [...OPEN_TASK_STATUSES];
  }

  if (!Array.isArray(value)) {
    throw new Error("statuses must be an array of task status strings");
  }

  if (value.length === 0) {
    throw new Error("statuses must contain at least one task status");
  }

  const statuses: string[] = [];

  for (const item of value) {

    if (typeof item !== "string") {
      throw new Error("statuses must contain only task status strings");
    }

    if (!(TASK_STATUSES as readonly string[]).includes(item)) {
      throw new Error(`statuses contains invalid task status '${item}'`);
    }

    if (!statuses.includes(item)) {
      statuses.push(item);
    }
  }

  return statuses;
}


function responseByteSize(response: { content: { type: "text"; text: string }[]; isError?: true }): number {

  return Buffer.byteLength(JSON.stringify(response), "utf8");
}


function logToolCall(
  name: string,
  durationMs: number,
  response: { content: { type: "text"; text: string }[]; isError?: true },
): void {

  console.error(JSON.stringify({
    event: "mcp.tool_call",
    tool: name,
    responseBytes: responseByteSize(response),
    durationMs,
    success: response.isError !== true,
  }));
}


export async function handleToolCall(
  client: CoreApiClient,
  name: string,
  args: Record<string, unknown>,
  allowedScopes: string[],
  callerUserId?: string,
  allowedToolNames: Set<string> = getToolNameSet(),
): Promise<{ content: { type: "text"; text: string }[]; isError?: true }> {

  const startedAt = Date.now();
  let response: { content: { type: "text"; text: string }[]; isError?: true };

  if (!allowedToolNames.has(name)) {
    response = errorResponse(`Tool '${name}' is not available in MCP_TOOL_PROFILE='${ACTIVE_TOOL_PROFILE}'`);
    logToolCall(name, Date.now() - startedAt, response);
    return response;
  }

  const scopeError = checkScope(name, allowedScopes);

  if (scopeError) {
    response = errorResponse(scopeError);
    logToolCall(name, Date.now() - startedAt, response);
    return response;
  }

  try {
    response = await (async (): Promise<{ content: { type: "text"; text: string }[]; isError?: true }> => {
      switch (name) {

    case "initial_instructions": {
      return jsonResponse({
        instruction_for_agent: "RoadBoard keeps project execution state, tasks, phases, decisions, memory, handoffs, and architecture context for human/AI work.",
        system: {
          name: "RoadBoard 2.0",
          toolProfile: ACTIVE_TOOL_PROFILE,
          defaultToolProfile: DEFAULT_TOOL_PROFILE,
          profileEnv: "MCP_TOOL_PROFILE",
        },
        recommended_workflow: [
          "If projectId is unknown, call list_projects.",
          "At project start, call get_project_changelog or prepare_project_summary with compact=true and explicit limits.",
          "For task work, call prepare_task_context, update status as work progresses, persist material findings, and create_handoff at session end.",
          "For planning, inspect list_phases first, reuse a matching phase, and avoid duplicate phases.",
        ],
        operating_rules: [
          "Tool schemas are authoritative for arguments; this response intentionally does not repeat the catalog.",
          "Use compact=true, limit, and cursor for list_active_tasks and aggregate helpers.",
          "Aggregated context responses may be truncated; inspect counts/truncation metadata before assuming completeness.",
          "A tool omitted by the active profile is unavailable even if its name is known.",
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

    case "list_skills": {
      const result = await client.listSkills(args.agentSlug as string | undefined);
      return jsonResponse(result);
    }

    case "attach_skill": {
      const result = await client.attachSkill(args.agentSlug as string, args.name as string);
      return jsonResponse(result);
    }

    case "detach_skill": {
      const result = await client.detachSkill(args.agentSlug as string, args.name as string);
      return jsonResponse(result);
    }

    case "sync_skills_catalog": {
      const result = await client.syncSkillsCatalog(
        (args.skills as { name: string; description?: string }[]) ?? [],
      );
      return jsonResponse(result);
    }

    case "read_inbox": {
      const account = (args.account as string) || process.env.EMAIL_DEFAULT_ACCOUNT || "default";
      const limit = Math.max(1, Math.min(30, Number(args.limit) || 10));
      const r = await fetch(`${EMAIL_HELPER_URL}/inbox?account=${encodeURIComponent(account)}&limit=${limit}`, {
        headers: EMAIL_HELPER_TOKEN ? { Authorization: `Bearer ${EMAIL_HELPER_TOKEN}` } : {},
      });
      if (!r.ok) return errorResponse(`email helper ${r.status}: ${await r.text()}`);
      return jsonResponse(await r.json());
    }

    case "mark_read": {
      const account = (args.account as string) || process.env.EMAIL_DEFAULT_ACCOUNT || "default";
      const uids = Array.isArray(args.uids) ? (args.uids as unknown[]).map((u) => Number(u)).filter((u) => Number.isFinite(u)) : [];
      if (uids.length === 0) return errorResponse("mark_read: 'uids' must be a non-empty array of message UIDs (from read_inbox).");
      const r = await fetch(`${EMAIL_HELPER_URL}/mark_read`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(EMAIL_HELPER_TOKEN ? { Authorization: `Bearer ${EMAIL_HELPER_TOKEN}` } : {}) },
        body: JSON.stringify({ account, uids }),
      });
      if (!r.ok) return errorResponse(`email helper ${r.status}: ${await r.text()}`);
      return jsonResponse(await r.json());
    }

    case "create_draft": {
      const account = (args.account as string) || process.env.EMAIL_DEFAULT_ACCOUNT || "default";
      if (!args.to || !args.body) return errorResponse("create_draft: 'to' and 'body' are required.");
      const r = await fetch(`${EMAIL_HELPER_URL}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(EMAIL_HELPER_TOKEN ? { Authorization: `Bearer ${EMAIL_HELPER_TOKEN}` } : {}) },
        body: JSON.stringify({
          account,
          to: args.to as string,
          subject: (args.subject as string) || "",
          body: args.body as string,
          cc: args.cc as string | undefined,
          in_reply_to: args.in_reply_to as string | undefined,
        }),
      });
      if (!r.ok) return errorResponse(`email helper ${r.status}: ${await r.text()}`);
      return jsonResponse(await r.json());
    }

    case "list_events": {
      const days = Math.max(1, Math.min(120, Number(args.days) || 14));
      const cal = args.calendar ? `&calendar=${encodeURIComponent(args.calendar as string)}` : "";
      const r = await fetch(`${CALENDAR_HELPER_URL}/events?days=${days}${cal}`, {
        headers: CALENDAR_HELPER_TOKEN ? { Authorization: `Bearer ${CALENDAR_HELPER_TOKEN}` } : {},
      });
      if (!r.ok) return errorResponse(`calendar helper ${r.status}: ${await r.text()}`);
      return jsonResponse(await r.json());
    }

    case "create_event": {
      if (!args.summary || !args.start) return errorResponse("create_event: 'summary' and 'start' are required.");
      const r = await fetch(`${CALENDAR_HELPER_URL}/event`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(CALENDAR_HELPER_TOKEN ? { Authorization: `Bearer ${CALENDAR_HELPER_TOKEN}` } : {}) },
        body: JSON.stringify({
          summary: args.summary as string,
          start: args.start as string,
          end: args.end as string | undefined,
          description: args.description as string | undefined,
          location: args.location as string | undefined,
          calendar: args.calendar as string | undefined,
        }),
      });
      if (!r.ok) return errorResponse(`calendar helper ${r.status}: ${await r.text()}`);
      return jsonResponse(await r.json());
    }

    case "delete_event": {
      if (!args.href) return errorResponse("delete_event: 'href' is required.");
      const r = await fetch(`${CALENDAR_HELPER_URL}/event?href=${encodeURIComponent(args.href as string)}`, {
        method: "DELETE",
        headers: CALENDAR_HELPER_TOKEN ? { Authorization: `Bearer ${CALENDAR_HELPER_TOKEN}` } : {},
      });
      if (!r.ok) return errorResponse(`calendar helper ${r.status}: ${await r.text()}`);
      return jsonResponse(await r.json());
    }

    case "notify": {
      const result = await client.notify({
        title: args.title as string,
        body: args.body as string | undefined,
        level: args.level as string | undefined,
        from: args.from as string | undefined,
      });
      return jsonResponse(result);
    }

    case "create_scheduled_activity": {
      const result = await client.createScheduledActivity({
        title: args.title as string,
        agentSlug: args.agentSlug as string,
        promptTemplate: args.promptTemplate as string,
        kind: args.kind as "cron" | "once" | "interval",
        cronExpr: args.cronExpr as string | undefined,
        everyMs: args.everyMs as number | undefined,
        runAt: args.runAt as string | undefined,
        tz: args.tz as string | undefined,
        projectId: args.projectId as string | undefined,
        deliveryRoomId: args.deliveryRoomId as string | undefined,
      });
      return jsonResponse(result);
    }

    case "create_reminder": {
      const text = args.text as string;
      if (!text) return errorResponse("create_reminder: 'text' is required.");
      const at = args.at as string | undefined;
      const cron = args.cron as string | undefined;
      const everyMin = args.every_minutes as number | undefined;
      let kind: "once" | "cron" | "interval";
      if (at) kind = "once";
      else if (cron) kind = "cron";
      else if (everyMin && everyMin > 0) kind = "interval";
      else return errorResponse("create_reminder: provide exactly one of 'at', 'cron', or 'every_minutes'.");
      const title = (args.title as string) || (text.length > 80 ? text.slice(0, 77) + "…" : text);
      const result = await client.createScheduledActivity({
        title,
        agentSlug: "__reminder__", // sentinel: dispatcher delivers text directly, no agent run
        promptTemplate: text,
        kind,
        runAt: at,
        cronExpr: cron,
        everyMs: everyMin ? Math.round(everyMin * 60000) : undefined,
        tz: args.tz as string | undefined,
      });
      return jsonResponse(result);
    }

    case "list_scheduled_activities": {
      const result = await client.listScheduledActivities(args.projectId as string | undefined);
      return jsonResponse(result);
    }

    case "pause_scheduled_activity": {
      const result = await client.pauseScheduledActivity(args.id as string);
      return jsonResponse(result);
    }

    case "delete_scheduled_activity": {
      const result = await client.deleteScheduledActivity(args.id as string);
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
      const limit = args.limit === undefined
        ? undefined
        : boundedNumber(args.limit, 50, 200, "limit");

      const result = await client.listTasks(args.projectId as string, {
        status: args.status as string | undefined,
        limit,
        cursor: args.cursor as string | undefined,
        compact: args.compact as boolean | undefined,
        fields: args.fields as string[] | undefined,
      });
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

      const titleWarning = checkLegacyTitle(args.title as string);
      const responsePayload = titleWarning
        ? { ...task, warning: titleWarning }
        : task;

      return jsonResponse(responsePayload);
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

    case "delete_task": {
      const result = await client.deleteTask(args.taskId as string);
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

      const phaseWarning = checkLegacyTitle(args.title as string);
      const phasePayload = phaseWarning
        ? { ...(result as Record<string, unknown>), warning: phaseWarning }
        : result;

      return jsonResponse(phasePayload);
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

      const [project, taskRaw, memory, decisions, entityLinks] = await Promise.all([
        client.getProject(projectId),
        client.getTask(taskId),
        client.listMemory(projectId, undefined, { limit: 10 }),
        client.listDecisions(projectId, undefined, { limit: 10 }).catch(() => []),
        client.listEntityArchitectureLinks(projectId, 'task', taskId).catch(() => ({ links: [], nodes: [] })),
      ]);

      const task = taskRaw as Record<string, unknown>;

      if (task.id !== taskId) {
        return errorResponse(`Task ${taskId} not found in project ${projectId}`);
      }

      const relatedPage = task.phaseId
        ? await client.listTasks(projectId, {
            phaseId: task.phaseId as string,
            limit: 20,
            compact: true,
          })
        : { items: [], nextCursor: null };
      const relatedTasks = pageItems(relatedPage)
        .filter((t) => t.id !== taskId)
        .map(compactTask);

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
      const decisionList = pageItems(decisions);
      const phaseId = task.phaseId as string | null | undefined;
      const linkedDecisions = decisionList.filter((d) => linkedDecisionIds.has(d.id as string));
      // Phase-level decision (Phase.decisionId) — resolver opzionale se phase include decisionId
      // Il listPhases non è nel client, skip for now; questa info arriva via future extension.

      // Memory targeted: filtra per tipi rilevanti ad esecuzione task
      const relevantTypes = new Set(['architecture', 'decision', 'issue', 'learning', 'done']);
      const memoryList = pageItems(memory);
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
        truncation: {
          related_tasks: nextCursor(relatedPage) !== null,
          memory: nextCursor(memory) !== null,
          decisions: nextCursor(decisions) !== null,
        },
      });
    }

    case "prepare_project_summary": {
      const projectId = args.projectId as string;
      const taskLimit = boundedNumber(
        args.taskLimit,
        DEFAULT_SUMMARY_TASK_LIMIT,
        MAX_AGGREGATE_LIMIT,
        "taskLimit",
      );
      const memoryLimit = boundedNumber(
        args.memoryLimit,
        DEFAULT_SUMMARY_MEMORY_LIMIT,
        MAX_AGGREGATE_LIMIT,
        "memoryLimit",
      );
      const compact = args.compact !== false;
      const statuses = parseSummaryStatuses(args.statuses);

      const [project, memoryPage, memoryTotal, ...taskCounts] = await Promise.all([
        client.getProject(projectId),
        client.listMemory(projectId, undefined, { limit: memoryLimit }),
        client.countMemory(projectId),
        ...TASK_STATUSES.map((status) => client.countTasks(projectId, status)),
      ]);

      const taskPage = await client.listTasks(projectId, {
        statuses,
        limit: taskLimit,
        cursor: args.taskCursor as string | undefined,
        compact,
      });
      const openTasks = pageItems(taskPage);
      const memoryItems = pageItems(memoryPage).map((entry) => compactMemory(entry, compact));
      const byStatus = TASK_STATUSES.reduce<Record<string, number>>((acc, status, index) => {
        acc[status] = taskCounts[index] ?? 0;
        return acc;
      }, {});
      const totalTasks = Object.values(byStatus).reduce((sum, count) => sum + count, 0);
      const openTaskTotal = statuses.reduce((sum, status) => sum + (byStatus[status] ?? 0), 0);
      const taskNextCursor = nextCursor(taskPage);
      const memoryNextCursor = nextCursor(memoryPage);

      return jsonResponse({
        project,
        task_summary: {
          total: totalTasks,
          by_status: byStatus,
          returned_open_tasks: openTasks.length,
          open_task_total: openTaskTotal,
        },
        open_tasks: compact ? openTasks.map(compactTask) : openTasks,
        memory: memoryItems,
        collection_metadata: {
          open_tasks: {
            total: openTaskTotal,
            returned: openTasks.length,
            nextCursor: taskNextCursor,
            statuses,
          },
          memory: {
            total: memoryTotal,
            returned: memoryItems.length,
            nextCursor: memoryNextCursor,
          },
        },
        truncation: {
          open_tasks: openTasks.length < openTaskTotal || taskNextCursor !== null,
          memory: memoryItems.length < memoryTotal || memoryNextCursor !== null,
          taskLimit,
          memoryLimit,
          compact,
          statuses,
        },
      });
    }

    case "create_handoff": {
      const projectId = args.projectId as string;
      const summary = args.summary as string;
      const nextSteps = args.next_steps as string[] | undefined;
      const attachArchitecture = args.attachArchitecture !== false;

      const parts: string[] = [`## Summary\n${summary}`];

      if (nextSteps && nextSteps.length > 0) {
        parts.push(`## Next Steps\n${nextSteps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`);
      }

      if (attachArchitecture) {

        const snapshot = await client.getArchitectureSnapshot(projectId).catch((err: unknown) => {
          console.warn(`[create_handoff] architecture snapshot unavailable for project ${projectId}: ${String(err)}`);
          return null;
        });

        if (snapshot !== null) {
          const snap = snapshot as Record<string, unknown>;
          const nodeCount = snap.node_count ?? snap.nodeCount ?? '?';
          const edgeCount = snap.edge_count ?? snap.edgeCount ?? '?';
          const generatedAt = snap.generated_at ?? snap.generatedAt ?? new Date().toISOString();
          parts.push(`## Architecture Snapshot\n_Generated: ${generatedAt} — ${nodeCount} nodes, ${edgeCount} edges_\n\n\`\`\`json\n${JSON.stringify(snapshot, null, 2)}\n\`\`\``);
        }
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
      const auditLimit = boundedNumber(args.auditLimit, DEFAULT_CHANGELOG_AUDIT_LIMIT, MAX_AGGREGATE_LIMIT, "auditLimit");
      const memoryLimit = boundedNumber(args.memoryLimit, DEFAULT_CHANGELOG_MEMORY_LIMIT, MAX_AGGREGATE_LIMIT, "memoryLimit");
      const decisionLimit = boundedNumber(args.decisionLimit, DEFAULT_CHANGELOG_DECISION_LIMIT, MAX_AGGREGATE_LIMIT, "decisionLimit");
      const urgentTaskLimit = boundedNumber(args.urgentTaskLimit, DEFAULT_CHANGELOG_URGENT_TASK_LIMIT, MAX_CHANGELOG_URGENT_TASK_LIMIT, "urgentTaskLimit");
      const phaseLimit = boundedNumber(args.phaseLimit, DEFAULT_CHANGELOG_PHASE_LIMIT, MAX_AGGREGATE_LIMIT, "phaseLimit");

      const [project, dashboard, phasesPage, openDecisionsPage, recentDecisionsPage, memoryPage, memoryTotal, auditPage] = await Promise.all([
        client.getProject(projectId),
        client.getDashboard(projectId),
        client.listPhasesPage(projectId, { status: "in_progress", limit: phaseLimit }),
        client.listDecisions(projectId, "open", { limit: decisionLimit }),
        client.listDecisions(projectId, undefined, { limit: decisionLimit }),
        client.listMemory(projectId, undefined, { limit: memoryLimit }),
        client.countMemory(projectId),
        client.getAuditEvents(projectId, auditLimit),
      ]);

      const snap = dashboard as Record<string, unknown>;
      const audit = auditPage as { events: Array<Record<string, unknown>>; total: number };
      const urgentSource = Array.isArray(snap.urgentTasks) ? snap.urgentTasks as Array<Record<string, unknown>> : [];
      const urgentTasksTotal = typeof snap.urgentTasksTotal === "number"
        ? snap.urgentTasksTotal
        : urgentSource.length;
      const urgentTasks = urgentSource.slice(0, urgentTaskLimit).map(compactTask);
      const activePhases = pageItems(phasesPage);
      const openDecisions = pageItems(openDecisionsPage);
      const recentDecisions = pageItems(recentDecisionsPage);
      const recentMemory = pageItems(memoryPage).map((entry) => compactMemory(entry, true));

      return jsonResponse({
        generated_at: new Date().toISOString(),
        project,
        task_summary: snap.tasks,
        active_phases: activePhases,
        urgent_tasks: urgentTasks,
        open_decisions: openDecisions,
        recent_decisions: recentDecisions,
        recent_memory: recentMemory,
        recent_activity: audit.events,
        total_audit_events: audit.total,
        collection_metadata: {
          active_phases: {
            total: null,
            returned: activePhases.length,
            nextCursor: nextCursor(phasesPage),
          },
          urgent_tasks: {
            total: urgentTasksTotal,
            returned: urgentTasks.length,
            nextCursor: null,
          },
          open_decisions: {
            total: null,
            returned: openDecisions.length,
            nextCursor: nextCursor(openDecisionsPage),
          },
          recent_decisions: {
            total: null,
            returned: recentDecisions.length,
            nextCursor: nextCursor(recentDecisionsPage),
          },
          recent_memory: {
            total: memoryTotal,
            returned: recentMemory.length,
            nextCursor: nextCursor(memoryPage),
          },
          recent_activity: {
            total: audit.total,
            returned: audit.events.length,
            nextCursor: null,
          },
        },
        truncation: {
          audit: audit.events.length < audit.total,
          memory: recentMemory.length < memoryTotal || nextCursor(memoryPage) !== null,
          decisions: nextCursor(openDecisionsPage) !== null || nextCursor(recentDecisionsPage) !== null,
          urgent_tasks: urgentTasks.length < urgentTasksTotal,
          phases: nextCursor(phasesPage) !== null,
          limits: { auditLimit, memoryLimit, decisionLimit, urgentTaskLimit, phaseLimit },
        },
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

    case "get_architecture_snapshot": {
      const result = await client.getArchitectureSnapshot(args.projectId as string);
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

    case "get_user": {
      const user = await client.getUser(args.userId as string);

      if (!user) {
        return jsonResponse({ error: "not_found", userId: args.userId });
      }

      return jsonResponse(user);
    }

    default:
      return errorResponse(`Unknown tool: ${name}`);
    }
    })();
    logToolCall(name, Date.now() - startedAt, response);
    return response;
  } catch (err) {
    response = errorResponse(err instanceof Error ? err.message : String(err));
    logToolCall(name, Date.now() - startedAt, response);
    return response;
  }
}


export function buildServer(
  client: CoreApiClient,
  allowedScopes: string[],
  callerUserId?: string,
  allowedToolNames: Set<string> = getToolNameSet(),
): Server {

  const server = new Server(
    { name: "roadboard-mcp", version: "0.0.1" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {

    const tools = TOOLS.filter((tool) => allowedToolNames.has(tool.name));
    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {

    const { name, arguments: args } = request.params;

    try {
      return await handleToolCall(
        client,
        name,
        (args ?? {}) as Record<string, unknown>,
        allowedScopes,
        callerUserId,
        allowedToolNames,
      );
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
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} auth=${req.headers.authorization ? 'bearer:present' : 'none'}`);
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


export async function main(): Promise<void> {

  if (MCP_TRANSPORT === "http") {
    await startHttp();
  } else {
    await startStdio();
  }
}


if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error("MCP service failed to start:", err);
    process.exit(1);
  });
}
