import { describe, it, expect, beforeAll } from 'vitest';

const AUTH_URL = 'http://localhost:3002';
const CORE_URL = 'http://localhost:3001';


interface LoginResponse {
  token: string;
  userId: string;
  expiresAt: string;
}


interface Project {
  id: string;
  name: string;
  slug: string;
  status: string;
}


interface Task {
  id: string;
  projectId: string;
  title: string;
  status: string;
  priority: string;
}


interface MemoryEntry {
  id: string;
  projectId: string;
  type: string;
  title: string;
  body: string | null;
}


interface ValidateResponse {
  sessionId: string;
  userId: string;
  username: string;
  displayName: string;
  expiresAt: string;
}


function authHeaders(token: string): Record<string, string> {

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}


describe('Wave 1 Integration', () => {
  let token: string;
  let userId: string;
  let projectId: string;
  let taskId: string;
  let memoryId: string;


  beforeAll(async () => {

    const healthChecks = await Promise.all([
      fetch(`${AUTH_URL}/health`).catch(() => null),
      fetch(`${CORE_URL}/health`).catch(() => null),
    ]);

    if (!healthChecks[0]?.ok || !healthChecks[1]?.ok) {
      throw new Error(
        'Services not running. Start auth-access (:4002) and core-api (:4001) before running integration tests.',
      );
    }
  });


  it('should login and get session token', async () => {

    const res = await fetch(`${AUTH_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'alessio', password: 'roadboard2025' }),
    });

    expect(res.status).toBe(201);

    const data = (await res.json()) as LoginResponse;

    expect(data.token).toBeDefined();
    expect(typeof data.token).toBe('string');
    expect(data.userId).toBeDefined();
    expect(data.expiresAt).toBeDefined();

    token = data.token;
    userId = data.userId;
  });


  it('should list projects with auth', async () => {

    const res = await fetch(`${CORE_URL}/projects`, {
      headers: authHeaders(token),
    });

    expect(res.status).toBe(200);

    const data = (await res.json()) as Project[];

    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);

    const roadboard = data.find((p) => p.slug === 'roadboard-2');

    expect(roadboard).toBeDefined();

    projectId = roadboard!.id;
  });


  it('should create a task', async () => {

    const res = await fetch(`${CORE_URL}/tasks`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        projectId,
        title: 'Integration test task',
        description: 'Created by integration test suite',
        status: 'todo',
        priority: 'medium',
      }),
    });

    expect(res.status).toBe(201);

    const data = (await res.json()) as Task;

    expect(data.id).toBeDefined();
    expect(data.title).toBe('Integration test task');
    expect(data.status).toBe('todo');
    expect(data.priority).toBe('medium');
    expect(data.projectId).toBe(projectId);

    taskId = data.id;
  });


  it('should update task status', async () => {

    const res = await fetch(`${CORE_URL}/tasks/${taskId}`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({
        status: 'in_progress',
      }),
    });

    expect(res.status).toBe(200);

    const data = (await res.json()) as Task;

    expect(data.id).toBe(taskId);
    expect(data.status).toBe('in_progress');
  });


  it('should create a memory entry', async () => {

    const res = await fetch(`${CORE_URL}/memory`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        projectId,
        type: 'done',
        title: 'Integration test memory',
        body: 'This memory entry was created by the integration test suite.',
      }),
    });

    expect(res.status).toBe(201);

    const data = (await res.json()) as MemoryEntry;

    expect(data.id).toBeDefined();
    expect(data.type).toBe('done');
    expect(data.title).toBe('Integration test memory');
    expect(data.projectId).toBe(projectId);

    memoryId = data.id;
  });


  it('should list memory entries for project', async () => {

    const res = await fetch(`${CORE_URL}/memory?projectId=${projectId}`, {
      headers: authHeaders(token),
    });

    expect(res.status).toBe(200);

    const data = (await res.json()) as MemoryEntry[];

    expect(Array.isArray(data)).toBe(true);

    const created = data.find((m) => m.id === memoryId);

    expect(created).toBeDefined();
    expect(created!.title).toBe('Integration test memory');
  });


  it('should validate session token', async () => {

    const res = await fetch(`${AUTH_URL}/sessions/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    expect(res.status).toBe(201);

    const data = (await res.json()) as ValidateResponse;

    expect(data.userId).toBe(userId);
    expect(data.username).toBe('alessio');
    expect(data.sessionId).toBeDefined();
    expect(data.expiresAt).toBeDefined();
  });


  it('should reject request without token', async () => {

    const res = await fetch(`${CORE_URL}/projects`);

    expect(res.status).toBe(401);
  });


  it('should logout and invalidate session', async () => {

    const res = await fetch(`${AUTH_URL}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(201);

    const data = (await res.json()) as { success: boolean };

    expect(data.success).toBe(true);
  });


  it('should reject request after logout', async () => {

    const res = await fetch(`${CORE_URL}/projects`, {
      headers: authHeaders(token),
    });

    expect(res.status).toBe(401);
  });
});
