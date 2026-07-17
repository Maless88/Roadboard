import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'child_process';
import { resolve } from 'path';

// Credentials for the live-stack integration run come from the environment —
// never hardcode real passwords in specs.
const TEST_USERNAME = process.env.RB_TEST_USERNAME ?? 'admin';
const TEST_PASSWORD = process.env.RB_TEST_PASSWORD ?? '';


const AUTH_URL = 'http://localhost:3002';
const CORE_URL = 'http://localhost:3001';
const RUN_LIVE_INTEGRATION = process.env.RB_RUN_LIVE_MCP_INTEGRATION === '1';
const describeLive = RUN_LIVE_INTEGRATION ? describe : describe.skip;

const SVC_ENTRY = resolve(__dirname, '../dist/main.js');


interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}


interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}


function sendRequest(proc: ChildProcess, req: JsonRpcRequest): Promise<JsonRpcResponse> {

  return new Promise((resolve, reject) => {

    const timeout = setTimeout(() => reject(new Error('MCP response timeout')), 8000);
    let buffer = '';

    const onData = (chunk: Buffer) => {

      buffer += chunk.toString();

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {

        const trimmed = line.trim();

        if (!trimmed) continue;

        try {
          const parsed = JSON.parse(trimmed) as JsonRpcResponse;

          if (parsed.id === req.id) {
            clearTimeout(timeout);
            proc.stdout?.off('data', onData);
            resolve(parsed);
          }
        } catch {
          // not JSON yet, keep buffering
        }
      }
    };

    proc.stdout?.on('data', onData);
    proc.stdin?.write(JSON.stringify(req) + '\n');
  });
}


describeLive('mcp-service Integration', () => {
  let mcpProc: ChildProcess;
  let mcpToken: string;
  let projectId: string;
  let taskId: string;
  let reqId = 1;


  beforeAll(async () => {

    // Check services are up
    const checks = await Promise.all([
      fetch(`${AUTH_URL}/health`).catch(() => null),
      fetch(`${CORE_URL}/health`).catch(() => null),
    ]);

    if (!checks[0]?.ok || !checks[1]?.ok) {
      throw new Error('auth-access (:4002) and core-api (:4001) must be running for mcp-service tests.');
    }

    // Login and issue MCP token
    const loginRes = await fetch(`${AUTH_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: TEST_USERNAME, password: TEST_PASSWORD }),
    });

    const { token: sessionToken, userId } = (await loginRes.json()) as {
      token: string;
      userId: string;
    };

    const tokenRes = await fetch(`${AUTH_URL}/tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({ userId, name: 'mcp-test-token', scope: 'read write' }),
    });

    const tokenData = (await tokenRes.json()) as { token: string };
    mcpToken = tokenData.token;

    // Get a project ID to use in tests
    const projectsRes = await fetch(`${CORE_URL}/projects`, {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });

    const projects = (await projectsRes.json()) as Array<{ id: string; slug: string }>;
    const project = projects.find((p) => p.slug === 'roadboard-2') ?? projects[0];

    if (!project) {
      throw new Error('No projects found in core-api. Run db:seed first.');
    }

    projectId = project.id;

    // Spawn mcp-service with valid token
    mcpProc = spawn('node', [SVC_ENTRY], {
      env: { ...process.env, MCP_TOKEN: mcpToken, CORE_API_PORT: '3001', AUTH_ACCESS_PORT: '3002', MCP_TOOL_PROFILE: 'full' },
      stdio: ['pipe', 'pipe', 'inherit'],
    });

    // Wait for process to be ready
    await new Promise((res) => setTimeout(res, 500));
  });


  afterAll(() => {

    mcpProc?.kill();
  });


  it('should list available tools', async () => {

    const res = await sendRequest(mcpProc, {
      jsonrpc: '2.0',
      id: reqId++,
      method: 'tools/list',
    });

    expect(res.error).toBeUndefined();

    const result = res.result as { tools: Array<{ name: string }> };

    expect(Array.isArray(result.tools)).toBe(true);

    const names = result.tools.map((t) => t.name);

    expect(names).toContain('list_projects');
    expect(names).toContain('get_project');
    expect(names).toContain('list_active_tasks');
    expect(names).toContain('get_project_memory');
    expect(names).toContain('create_task');
    expect(names).toContain('update_task_status');
    expect(names).toContain('create_memory_entry');
    expect(names).toContain('prepare_task_context');
    expect(names).toContain('prepare_project_summary');
    expect(names).toContain('create_handoff');
  });


  it('should list projects with a valid token', async () => {

    const res = await sendRequest(mcpProc, {
      jsonrpc: '2.0',
      id: reqId++,
      method: 'tools/call',
      params: { name: 'list_projects', arguments: {} },
    });

    expect(res.error).toBeUndefined();

    const result = res.result as { content: Array<{ text: string }> };
    const projects = JSON.parse(result.content[0].text) as unknown[];

    expect(Array.isArray(projects)).toBe(true);
    expect(projects.length).toBeGreaterThan(0);
  });


  it('should get a project by id', async () => {

    const res = await sendRequest(mcpProc, {
      jsonrpc: '2.0',
      id: reqId++,
      method: 'tools/call',
      params: { name: 'get_project', arguments: { projectId } },
    });

    expect(res.error).toBeUndefined();

    const result = res.result as { content: Array<{ text: string }> };
    const project = JSON.parse(result.content[0].text) as { id: string };

    expect(project.id).toBe(projectId);
  });


  it('should list active tasks for a project', async () => {

    const res = await sendRequest(mcpProc, {
      jsonrpc: '2.0',
      id: reqId++,
      method: 'tools/call',
      params: { name: 'list_active_tasks', arguments: { projectId } },
    });

    expect(res.error).toBeUndefined();

    const result = res.result as { content: Array<{ text: string }> };
    const tasks = JSON.parse(result.content[0].text) as unknown[];

    expect(Array.isArray(tasks)).toBe(true);
  });


  it('should create a task via MCP', async () => {

    const res = await sendRequest(mcpProc, {
      jsonrpc: '2.0',
      id: reqId++,
      method: 'tools/call',
      params: {
        name: 'create_task',
        arguments: { projectId, title: 'MCP integration test task', priority: 'low' },
      },
    });

    expect(res.error).toBeUndefined();

    const result = res.result as { content: Array<{ text: string }> };
    const task = JSON.parse(result.content[0].text) as { id: string; title: string };

    expect(task.id).toBeDefined();
    expect(task.title).toBe('MCP integration test task');

    taskId = task.id;
  });


  it('should update task status via MCP', async () => {

    const res = await sendRequest(mcpProc, {
      jsonrpc: '2.0',
      id: reqId++,
      method: 'tools/call',
      params: {
        name: 'update_task_status',
        arguments: { taskId, status: 'in_progress' },
      },
    });

    expect(res.error).toBeUndefined();

    const result = res.result as { content: Array<{ text: string }> };
    const task = JSON.parse(result.content[0].text) as { id: string; status: string };

    expect(task.id).toBe(taskId);
    expect(task.status).toBe('in_progress');
  });


  it('should create a memory entry via MCP', async () => {

    const res = await sendRequest(mcpProc, {
      jsonrpc: '2.0',
      id: reqId++,
      method: 'tools/call',
      params: {
        name: 'create_memory_entry',
        arguments: { projectId, type: 'done', title: 'MCP test memory entry' },
      },
    });

    expect(res.error).toBeUndefined();

    const result = res.result as { content: Array<{ text: string }> };
    const entry = JSON.parse(result.content[0].text) as { id: string; title: string };

    expect(entry.id).toBeDefined();
    expect(entry.title).toBe('MCP test memory entry');
  });


  it('should get project memory via MCP', async () => {

    const res = await sendRequest(mcpProc, {
      jsonrpc: '2.0',
      id: reqId++,
      method: 'tools/call',
      params: { name: 'get_project_memory', arguments: { projectId } },
    });

    expect(res.error).toBeUndefined();

    const result = res.result as { content: Array<{ text: string }> };
    const entries = JSON.parse(result.content[0].text) as unknown[];

    expect(Array.isArray(entries)).toBe(true);
    expect(entries.length).toBeGreaterThan(0);
  });


  it('should prepare task context via MCP', async () => {

    const res = await sendRequest(mcpProc, {
      jsonrpc: '2.0',
      id: reqId++,
      method: 'tools/call',
      params: { name: 'prepare_task_context', arguments: { projectId, taskId } },
    });

    expect(res.error).toBeUndefined();

    const result = res.result as { content: Array<{ text: string }> };
    const ctx = JSON.parse(result.content[0].text) as {
      project: { id: string };
      task: { id: string };
      related_tasks: unknown[];
      recent_memory: unknown[];
    };

    expect(ctx.project).toBeDefined();
    expect(ctx.task.id).toBe(taskId);
    expect(Array.isArray(ctx.related_tasks)).toBe(true);
    expect(Array.isArray(ctx.recent_memory)).toBe(true);
  });


  it('should prepare project summary via MCP', async () => {

    const res = await sendRequest(mcpProc, {
      jsonrpc: '2.0',
      id: reqId++,
      method: 'tools/call',
      params: { name: 'prepare_project_summary', arguments: { projectId } },
    });

    expect(res.error).toBeUndefined();

    const result = res.result as { content: Array<{ text: string }> };
    const summary = JSON.parse(result.content[0].text) as {
      project: { id: string };
      task_summary: { total: number; by_status: Record<string, number> };
      open_tasks: unknown[];
      memory: unknown[];
      collection_metadata: { memory: { total: number; returned: number } };
      truncation: Record<string, unknown>;
    };

    expect(summary.project).toBeDefined();
    expect(typeof summary.task_summary.total).toBe('number');
    expect(Array.isArray(summary.open_tasks)).toBe(true);
    expect(Array.isArray(summary.memory)).toBe(true);
    expect(typeof summary.collection_metadata.memory.total).toBe('number');
    expect(summary.truncation).toBeDefined();
  });


  it('should create a handoff via MCP', async () => {

    const res = await sendRequest(mcpProc, {
      jsonrpc: '2.0',
      id: reqId++,
      method: 'tools/call',
      params: {
        name: 'create_handoff',
        arguments: {
          projectId,
          summary: 'Completed FASE 8 workflow tools implementation.',
          next_steps: ['Write integration tests', 'Commit and push'],
        },
      },
    });

    expect(res.error).toBeUndefined();

    const result = res.result as { content: Array<{ text: string }> };
    const entry = JSON.parse(result.content[0].text) as {
      id: string;
      type: string;
      body: string;
    };

    expect(entry.id).toBeDefined();
    expect(entry.type).toBe('handoff');
    expect(entry.body).toContain('## Summary');
    expect(entry.body).toContain('## Next Steps');
  });
});


describeLive('mcp-service — invalid token', () => {
  let invalidProc: ChildProcess;
  let reqId = 100;


  beforeAll(async () => {

    invalidProc = spawn('node', [SVC_ENTRY], {
      env: { ...process.env, MCP_TOKEN: 'invalid-token-xyz', CORE_API_PORT: '3001', AUTH_ACCESS_PORT: '3002', MCP_TOOL_PROFILE: 'full' },
      stdio: ['pipe', 'pipe', 'inherit'],
    });

    await new Promise((res) => setTimeout(res, 500));
  });


  afterAll(() => {

    invalidProc?.kill();
  });


  it('should return error when token is invalid', async () => {

    const res = await sendRequest(invalidProc, {
      jsonrpc: '2.0',
      id: reqId++,
      method: 'tools/call',
      params: { name: 'list_projects', arguments: {} },
    });

    // Either a JSON-RPC error or an isError response with denied message
    const hasError =
      res.error !== undefined ||
      (res.result as { isError?: boolean } | undefined)?.isError === true;

    expect(hasError).toBe(true);
  });
});
