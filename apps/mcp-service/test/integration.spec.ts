import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'child_process';
import { resolve } from 'path';

const AUTH_URL = 'http://localhost:3002';
const CORE_URL = 'http://localhost:3001';

const SVC_ENTRY = resolve(__dirname, '../src/main.ts');


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


describe('mcp-service Integration', () => {
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
      body: JSON.stringify({ username: 'alessio', password: 'roadboard2025' }),
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
    mcpProc = spawn('node', ['--import', 'tsx/esm', SVC_ENTRY], {
      env: { ...process.env, MCP_TOKEN: mcpToken, CORE_API_PORT: '4001', AUTH_ACCESS_PORT: '4002' },
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
});


describe('mcp-service — invalid token', () => {
  let invalidProc: ChildProcess;
  let reqId = 100;


  beforeAll(async () => {

    invalidProc = spawn('node', ['--import', 'tsx/esm', SVC_ENTRY], {
      env: { ...process.env, MCP_TOKEN: 'invalid-token-xyz', CORE_API_PORT: '4001', AUTH_ACCESS_PORT: '4002' },
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
