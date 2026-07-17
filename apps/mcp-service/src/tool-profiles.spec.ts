import { describe, expect, it, vi } from "vitest";
import type { CoreApiClient } from "./clients/core-api.client.js";
import {
  DEFAULT_TOOL_PROFILE,
  getToolsForProfile,
  handleToolCall,
} from "./main.js";


const WORKFLOW_TOOL_NAMES = new Set(getToolsForProfile("workflow").map((tool) => tool.name));


function jsonPayload(response: { content: Array<{ text: string }> }): Record<string, unknown> {

  return JSON.parse(response.content[0].text) as Record<string, unknown>;
}


function makeClient(overrides: Record<string, unknown> = {}): CoreApiClient {

  const client = {
    getProject: async (projectId: string) => ({ id: projectId, name: "RoadBoard" }),
    countMemory: async () => 17,
    countTasks: async (_projectId: string, status?: string) => {
      const counts: Record<string, number> = {
        todo: 8,
        in_progress: 4,
        done: 20,
        blocked: 2,
        cancelled: 1,
      };
      return counts[status ?? ""] ?? 0;
    },
    listTasks: vi.fn(async (_projectId: string, options: Record<string, unknown>) => ({
      items: [
        {
          id: `task-${String((options.statuses as string[] | undefined)?.join("-") ?? options.status ?? "any")}`,
          title: "Compact task",
          status: Array.isArray(options.statuses) ? options.statuses[0] : options.status,
          priority: "high",
          phaseId: "phase-1",
          description: "verbose body",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
        },
      ],
      nextCursor: "next-task",
    })),
    listMemory: async () => ({
      items: [
        {
          id: "mem-1",
          type: "handoff",
          title: "Recent handoff",
          body: "verbose memory",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
        },
      ],
      nextCursor: "next-memory",
    }),
    getDashboard: async () => ({
      tasks: { total: 35 },
      urgentTasksTotal: 12,
      urgentTasks: [
        {
          id: "urgent-1",
          title: "Urgent task",
          status: "todo",
          priority: "critical",
          phaseId: "phase-1",
          description: "verbose body",
        },
        {
          id: "urgent-2",
          title: "Second urgent task",
          status: "blocked",
          priority: "high",
          phaseId: "phase-1",
        },
      ],
    }),
    listPhasesPage: vi.fn(async () => ({
      items: [{ id: "phase-1", title: "Phase", status: "in_progress" }],
      nextCursor: "next-phase",
    })),
    listDecisions: async (_projectId: string, status?: string) => ({
      items: [{ id: `decision-${status ?? "recent"}`, title: "Decision", status: status ?? "accepted" }],
      nextCursor: "next-decision",
    }),
    getAuditEvents: async (_projectId: string, take: number) => ({
      events: Array.from({ length: take }, (_, index) => ({ id: `audit-${index}` })),
      total: take + 1,
    }),
    ...overrides,
  };

  return client as unknown as CoreApiClient;
}


describe("MCP tool profiles and payload budgets", () => {

  it("keeps full as the compatibility default and exposes all tools", () => {
    expect(DEFAULT_TOOL_PROFILE).toBe("full");
    expect(getToolsForProfile("full")).toHaveLength(50);
  });

  it("keeps workflow profile compact", () => {
    const workflowTools = getToolsForProfile("workflow");
    const bytes = Buffer.byteLength(JSON.stringify({ tools: workflowTools }), "utf8");
    const names = workflowTools.map((tool) => tool.name);

    expect(workflowTools.length).toBeLessThanOrEqual(25);
    expect(bytes).toBeLessThanOrEqual(15_000);
    expect(names).toContain("get_architecture_map");
    expect(names).toContain("link_task_to_node");
  });

  it("keeps initial_instructions under the hard budget", async () => {
    const response = await handleToolCall(
      makeClient(),
      "initial_instructions",
      {},
      ["project.admin"],
      undefined,
      WORKFLOW_TOOL_NAMES,
    );
    const bytes = Buffer.byteLength(JSON.stringify(response), "utf8");

    expect(response.isError).toBeUndefined();
    expect(bytes).toBeLessThanOrEqual(4_096);
    expect(bytes).toBeLessThanOrEqual(2_048);
  });

  it("blocks direct calls to tools outside the active profile", async () => {
    const response = await handleToolCall(
      makeClient(),
      "read_inbox",
      {},
      ["project.admin"],
      undefined,
      WORKFLOW_TOOL_NAMES,
    );

    expect(response.isError).toBe(true);
    expect(response.content[0].text).toContain("not available");
  });
});


describe("bounded aggregate helpers", () => {

  it("prepare_project_summary defaults to compact bounded collections with counts", async () => {
    const listTasks = vi.fn(async (_projectId: string, options: Record<string, unknown>) => ({
      items: [
        {
          id: "task-default",
          title: "Compact task",
          status: "todo",
          priority: "high",
          phaseId: "phase-1",
          description: "verbose body",
        },
      ],
      nextCursor: "next-task",
    }));
    const response = await handleToolCall(
      makeClient({ listTasks }),
      "prepare_project_summary",
      { projectId: "project-1" },
      ["project.admin"],
      undefined,
      WORKFLOW_TOOL_NAMES,
    );
    const payload = jsonPayload(response);
    const openTasks = payload.open_tasks as Array<Record<string, unknown>>;
    const memory = payload.memory as Array<Record<string, unknown>>;
    const metadata = payload.collection_metadata as Record<string, { total: number; returned: number; nextCursor: string | null }>;
    const truncation = payload.truncation as Record<string, unknown>;

    expect(response.isError).toBeUndefined();
    expect(listTasks).toHaveBeenCalledWith("project-1", expect.objectContaining({
      statuses: ["todo", "in_progress", "blocked"],
    }));
    expect(openTasks[0].description).toBeUndefined();
    expect(Array.isArray(memory)).toBe(true);
    expect(memory[0].body).toBeUndefined();
    expect(metadata.memory.total).toBe(17);
    expect(metadata.memory.returned).toBe(1);
    expect(truncation.open_tasks).toBe(true);
    expect(truncation.memory).toBe(true);
  });

  it.each([
    ["numeric element", ["todo", 42], "statuses must contain only task status strings"],
    ["null element", ["todo", null], "statuses must contain only task status strings"],
    ["unknown enum", ["todo", "unknown"], "statuses contains invalid task status 'unknown'"],
    ["non-array value", "todo", "statuses must be an array"],
    ["empty array", [], "statuses must contain at least one task status"],
  ])("prepare_project_summary rejects invalid statuses: %s", async (_label, statuses, message) => {
    const getProject = vi.fn(async () => ({ id: "project-1" }));
    const listTasks = vi.fn();
    const response = await handleToolCall(
      makeClient({ getProject, listTasks }),
      "prepare_project_summary",
      { projectId: "project-1", statuses },
      ["project.admin"],
      undefined,
      WORKFLOW_TOOL_NAMES,
    );

    expect(response.isError).toBe(true);
    expect(response.content[0].text).toContain(message);
    expect(getProject).not.toHaveBeenCalled();
    expect(listTasks).not.toHaveBeenCalled();
  });

  it("prepare_project_summary deduplicates statuses and exposes a reusable task cursor", async () => {
    const listTasks = vi.fn(async (_projectId: string, options: Record<string, unknown>) => ({
      items: [
        { id: "task-2", title: "Second", status: "blocked", priority: "high", phaseId: "phase-1", description: "drop" },
        { id: "task-1", title: "First", status: "todo", priority: "high", phaseId: "phase-1", description: "drop" },
      ],
      nextCursor: "task-1",
    }));
    const response = await handleToolCall(
      makeClient({ listTasks }),
      "prepare_project_summary",
      {
        projectId: "project-1",
        taskLimit: 2,
        taskCursor: "task-3",
        statuses: ["todo", "todo", "blocked"],
      },
      ["project.admin"],
      undefined,
      WORKFLOW_TOOL_NAMES,
    );
    const payload = jsonPayload(response);
    const metadata = payload.collection_metadata as Record<string, { statuses: string[]; nextCursor: string | null }>;
    const openTasks = payload.open_tasks as Array<Record<string, unknown>>;

    expect(response.isError).toBeUndefined();
    expect(listTasks).toHaveBeenCalledTimes(1);
    expect(listTasks.mock.calls[0][1]).toMatchObject({
      statuses: ["todo", "blocked"],
      limit: 2,
      cursor: "task-3",
      compact: true,
    });
    expect(openTasks.map((task) => task.id)).toEqual(["task-2", "task-1"]);
    expect(metadata.open_tasks.statuses).toEqual(["todo", "blocked"]);
    expect(metadata.open_tasks.nextCursor).toBe("task-1");
  });

  it("prepare_project_summary rejects invalid limits", async () => {
    const response = await handleToolCall(
      makeClient(),
      "prepare_project_summary",
      { projectId: "project-1", taskLimit: 51 },
      ["project.admin"],
      undefined,
      WORKFLOW_TOOL_NAMES,
    );

    expect(response.isError).toBe(true);
    expect(response.content[0].text).toContain("taskLimit");
  });

  it("get_project_changelog bounds every expandable collection", async () => {
    const listPhasesPage = vi.fn(async () => ({
      items: [{ id: "phase-1", title: "Active", status: "in_progress" }],
      nextCursor: "next-phase",
    }));
    const response = await handleToolCall(
      makeClient({ listPhasesPage }),
      "get_project_changelog",
      { projectId: "project-1", auditLimit: 2, memoryLimit: 1, decisionLimit: 1, urgentTaskLimit: 1, phaseLimit: 1 },
      ["project.admin"],
      undefined,
      WORKFLOW_TOOL_NAMES,
    );
    const payload = jsonPayload(response);
    const activePhases = payload.active_phases as unknown[];
    const urgent = payload.urgent_tasks as Array<Record<string, unknown>>;
    const openDecisions = payload.open_decisions as unknown[];
    const recentDecisions = payload.recent_decisions as unknown[];
    const metadata = payload.collection_metadata as Record<string, { total: number | null; returned: number; nextCursor: string | null }>;
    const truncation = payload.truncation as Record<string, unknown>;

    expect(response.isError).toBeUndefined();
    expect(listPhasesPage).toHaveBeenCalledWith("project-1", { status: "in_progress", limit: 1 });
    expect(Array.isArray(activePhases)).toBe(true);
    expect(activePhases).toEqual([{ id: "phase-1", title: "Active", status: "in_progress" }]);
    expect(Array.isArray(urgent)).toBe(true);
    expect(Array.isArray(openDecisions)).toBe(true);
    expect(Array.isArray(recentDecisions)).toBe(true);
    expect(urgent).toHaveLength(1);
    expect(metadata.urgent_tasks.returned).toBe(1);
    expect(metadata.urgent_tasks.total).toBe(12);
    expect(urgent[0].description).toBeUndefined();
    expect(truncation.audit).toBe(true);
    expect(truncation.memory).toBe(true);
    expect(truncation.decisions).toBe(true);
    expect(truncation.urgent_tasks).toBe(true);
    expect(truncation.phases).toBe(true);
  });

  it("get_project_changelog rejects urgentTaskLimit above dashboard page capacity", async () => {
    const response = await handleToolCall(
      makeClient(),
      "get_project_changelog",
      { projectId: "project-1", urgentTaskLimit: 11 },
      ["project.admin"],
      undefined,
      WORKFLOW_TOOL_NAMES,
    );

    expect(response.isError).toBe(true);
    expect(response.content[0].text).toContain("urgentTaskLimit");
  });
});
