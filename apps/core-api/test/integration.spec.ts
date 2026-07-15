import { describe, it, expect, beforeAll } from 'vitest';

// Credentials for the live-stack integration run come from the environment —
// never hardcode real passwords in specs.
const TEST_USERNAME = process.env.RB_TEST_USERNAME ?? 'admin';
const TEST_PASSWORD = process.env.RB_TEST_PASSWORD ?? '';


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


interface Decision {
  id: string;
  projectId: string;
  title: string;
  summary: string;
  rationale: string | null;
  status: string;
  impactLevel: string;
}


interface DashboardSnapshot {
  tasksByStatus: Record<string, number>;
  milestonesByStatus: Record<string, number>;
  activePhases: unknown[];
  recentMemory: unknown[];
  recentDecisions: unknown[];
  urgentTasks: unknown[];
}


interface TasksSummary {
  byStatus: Record<string, number>;
  total: number;
}


interface MilestoneProgress {
  total: number;
  completed: number;
  percent: number;
}


interface AuditResponse {
  events: unknown[];
  total: number;
  take: number;
  skip: number;
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
  let decisionId: string;


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
      body: JSON.stringify({ username: TEST_USERNAME, password: TEST_PASSWORD }),
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


  // --- Decisions ---

  it('should create a decision', async () => {

    const res = await fetch(`${CORE_URL}/decisions`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        projectId,
        title: 'Use Prisma as ORM',
        summary: 'We will use Prisma ORM for all database access in the monorepo.',
        rationale: 'Type-safe queries, automatic migrations, good DX.',
        impactLevel: 'high',
      }),
    });

    expect(res.status).toBe(201);

    const data = (await res.json()) as Decision;

    expect(data.id).toBeDefined();
    expect(data.title).toBe('Use Prisma as ORM');
    expect(data.projectId).toBe(projectId);
    expect(data.status).toBe('open');
    expect(data.impactLevel).toBe('high');

    decisionId = data.id;
  });


  it('should list decisions for project', async () => {

    const res = await fetch(`${CORE_URL}/decisions?projectId=${projectId}`, {
      headers: authHeaders(token),
    });

    expect(res.status).toBe(200);

    const data = (await res.json()) as Decision[];

    expect(Array.isArray(data)).toBe(true);

    const created = data.find((d) => d.id === decisionId);

    expect(created).toBeDefined();
    expect(created!.title).toBe('Use Prisma as ORM');
  });


  it('should get a single decision', async () => {

    const res = await fetch(`${CORE_URL}/decisions/${decisionId}`, {
      headers: authHeaders(token),
    });

    expect(res.status).toBe(200);

    const data = (await res.json()) as Decision;

    expect(data.id).toBe(decisionId);
    expect(data.summary).toBe('We will use Prisma ORM for all database access in the monorepo.');
  });


  it('should update a decision', async () => {

    const res = await fetch(`${CORE_URL}/decisions/${decisionId}`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({ status: 'accepted' }),
    });

    expect(res.status).toBe(200);

    const data = (await res.json()) as Decision;

    expect(data.id).toBe(decisionId);
    expect(data.status).toBe('accepted');
  });


  it('should filter decisions by status', async () => {

    const res = await fetch(`${CORE_URL}/decisions?projectId=${projectId}&status=accepted`, {
      headers: authHeaders(token),
    });

    expect(res.status).toBe(200);

    const data = (await res.json()) as Decision[];

    expect(Array.isArray(data)).toBe(true);
    expect(data.every((d) => d.status === 'accepted')).toBe(true);
  });


  // --- Dashboards ---

  it('should get dashboard snapshot', async () => {

    const res = await fetch(`${CORE_URL}/projects/${projectId}/dashboard`, {
      headers: authHeaders(token),
    });

    expect(res.status).toBe(200);

    const data = (await res.json()) as DashboardSnapshot;

    expect(data.tasksByStatus).toBeDefined();
    expect(typeof data.tasksByStatus).toBe('object');
    expect(data.milestonesByStatus).toBeDefined();
    expect(Array.isArray(data.activePhases)).toBe(true);
    expect(Array.isArray(data.recentMemory)).toBe(true);
    expect(Array.isArray(data.recentDecisions)).toBe(true);
    expect(Array.isArray(data.urgentTasks)).toBe(true);
  });


  it('should get tasks summary', async () => {

    const res = await fetch(`${CORE_URL}/projects/${projectId}/dashboard/tasks-summary`, {
      headers: authHeaders(token),
    });

    expect(res.status).toBe(200);

    const data = (await res.json()) as TasksSummary;

    expect(data.byStatus).toBeDefined();
    expect(typeof data.total).toBe('number');
    expect(data.total).toBeGreaterThanOrEqual(0);
  });


  it('should get milestone progress', async () => {

    const res = await fetch(`${CORE_URL}/projects/${projectId}/dashboard/milestone-progress`, {
      headers: authHeaders(token),
    });

    expect(res.status).toBe(200);

    const data = (await res.json()) as MilestoneProgress;

    expect(typeof data.total).toBe('number');
    expect(typeof data.completed).toBe('number');
    expect(typeof data.percent).toBe('number');
    expect(data.percent).toBeGreaterThanOrEqual(0);
    expect(data.percent).toBeLessThanOrEqual(100);
  });


  // --- Audit ---

  it('should return audit events for project', async () => {

    const res = await fetch(`${CORE_URL}/projects/${projectId}/audit`, {
      headers: authHeaders(token),
    });

    expect(res.status).toBe(200);

    const data = (await res.json()) as AuditResponse;

    expect(Array.isArray(data.events)).toBe(true);
    expect(typeof data.total).toBe('number');
    expect(data.take).toBe(50);
    expect(data.skip).toBe(0);
  });


  it('should support take/skip pagination on audit', async () => {

    const res = await fetch(`${CORE_URL}/projects/${projectId}/audit?take=5&skip=0`, {
      headers: authHeaders(token),
    });

    expect(res.status).toBe(200);

    const data = (await res.json()) as AuditResponse;

    expect(data.take).toBe(5);
    expect(data.skip).toBe(0);
    expect(data.events.length).toBeLessThanOrEqual(5);
  });


  it('should return recent audit events globally', async () => {

    const res = await fetch(`${CORE_URL}/audit/recent?take=10`, {
      headers: authHeaders(token),
    });

    expect(res.status).toBe(200);

    const data = (await res.json()) as unknown[];

    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeLessThanOrEqual(10);
  });


  it('should delete a decision', async () => {

    const res = await fetch(`${CORE_URL}/decisions/${decisionId}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });

    expect(res.status).toBe(200);
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
