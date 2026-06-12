/**
 * Sync Endpoints Integration Suite
 *
 * Exercises the two codeboard sync primitives end-to-end against the local stack:
 *   - Change A: client-provided `id` on create → idempotent upsert (projects + phases + tasks).
 *   - Change B: `updatedSince` watermark filtering with ASC ordering + keyset pagination.
 *
 * Self-contained: registers a throwaway user via auth-access `/auth/register`
 * (no demo seed) and creates its own project with a client-provided id. Project
 * creation grants the calling user a direct PROJECT_ADMIN grant, so every
 * subsequent project-scoped request is authorized. No reliance on pre-seeded
 * users, passwords, or projects.
 */

import { describe, it, expect, beforeAll } from 'vitest';

const AUTH_URL = 'http://localhost:3002';
const CORE_URL = 'http://localhost:3001';

const RUN_ID = Date.now();


interface RegisterResponse {
  token: string;
  userId: string;
  expiresAt: string;
}


interface Project {
  id: string;
  slug: string;
  ownerTeamId?: string;
}


interface Phase {
  id: string;
  projectId: string;
  title: string;
  status: string;
}


interface Task {
  id: string;
  projectId: string;
  phaseId: string;
  title: string;
  status: string;
  updatedAt: string;
}


interface PaginatedTasks {
  items: Task[];
  nextCursor: string | null;
}


function authHeaders(token: string): Record<string, string> {

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}


describe('Sync Endpoints Integration', () => {

  let token: string;
  const username = `cbsync${RUN_ID}`;
  const projectId = `cb-proj-${RUN_ID}`;
  const phaseId = `cb-phase-${RUN_ID}`;
  const taskId = `cb-task-${RUN_ID}`;


  beforeAll(async () => {

    const [auth, core] = await Promise.all([
      fetch(`${AUTH_URL}/health`).catch(() => null),
      fetch(`${CORE_URL}/health`).catch(() => null),
    ]);

    if (!auth?.ok || !core?.ok) {
      throw new Error('Services not running. Start auth-access (:3002) and core-api (:3001) first.');
    }

    // Register a throwaway user without the demo seed. Returns a usable session token.
    const registerRes = await fetch(`${AUTH_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        displayName: `CB Sync ${RUN_ID}`,
        email: `${username}@example.test`,
        password: 'cb-sync-throwaway-pw',
        seedDemoProject: false,
      }),
    });

    expect(registerRes.status).toBe(201);
    const register = (await registerRes.json()) as RegisterResponse;
    token = register.token;
    expect(typeof token).toBe('string');

    // Create our own project with a client-provided id (Change A on projects).
    // ownerTeamSlug resolves to the personal team auto-created at registration
    // (slug == sanitized username). Creating it grants the caller PROJECT_ADMIN.
    const projectRes = await fetch(`${CORE_URL}/projects`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        id: projectId,
        name: `CB Sync Project ${RUN_ID}`,
        slug: `cb-sync-${RUN_ID}`,
        ownerTeamSlug: username,
        status: 'active',
      }),
    });

    expect(projectRes.status).toBe(201);
    const project = (await projectRes.json()) as Project;
    expect(project.id).toBe(projectId);
  });


  it('creates a phase with a client-provided id (Change A on phases)', async () => {

    const res = await fetch(`${CORE_URL}/phases`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        id: phaseId,
        projectId,
        title: `Sync test phase ${RUN_ID}`,
      }),
    });

    expect(res.status).toBe(201);
    const phase = (await res.json()) as Phase;
    expect(phase.id).toBe(phaseId);
    expect(phase.projectId).toBe(projectId);
  });


  it('creates a task with a client-provided id that round-trips', async () => {

    const res = await fetch(`${CORE_URL}/tasks`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        id: taskId,
        projectId,
        phaseId,
        title: 'Sync test task v1',
        status: 'todo',
        priority: 'medium',
      }),
    });

    expect(res.status).toBe(201);
    const task = (await res.json()) as Task;
    expect(task.id).toBe(taskId);
    expect(task.title).toBe('Sync test task v1');

    const getRes = await fetch(`${CORE_URL}/tasks/${taskId}`, { headers: authHeaders(token) });
    expect(getRes.status).toBe(200);
    const fetched = (await getRes.json()) as Task;
    expect(fetched.id).toBe(taskId);
  });


  it('re-POSTing the same id updates in place without creating a duplicate', async () => {

    const res = await fetch(`${CORE_URL}/tasks`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        id: taskId,
        projectId,
        phaseId,
        title: 'Sync test task v2',
        status: 'in_progress',
        priority: 'high',
      }),
    });

    expect(res.status).toBe(201);
    const task = (await res.json()) as Task;
    expect(task.id).toBe(taskId);
    expect(task.title).toBe('Sync test task v2');
    expect(task.status).toBe('in_progress');

    // No duplicate: exactly one task carries this id.
    const listRes = await fetch(`${CORE_URL}/tasks?projectId=${projectId}`, {
      headers: authHeaders(token),
    });
    const all = (await listRes.json()) as Task[];
    expect(all.filter((t) => t.id === taskId)).toHaveLength(1);
  });


  it('GET /tasks?updatedSince returns only newer rows ordered updatedAt ASC', async () => {

    // Capture a watermark, then mutate the task so it sorts after the watermark.
    const watermark = new Date().toISOString();

    await new Promise((r) => setTimeout(r, 50));

    const patchRes = await fetch(`${CORE_URL}/tasks/${taskId}`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({ title: 'Sync test task v3' }),
    });
    expect(patchRes.status).toBe(200);

    const res = await fetch(
      `${CORE_URL}/tasks?projectId=${projectId}&updatedSince=${encodeURIComponent(watermark)}`,
      { headers: authHeaders(token) },
    );

    expect(res.status).toBe(200);
    const rows = (await res.json()) as Task[];

    // Every returned row is strictly newer than the watermark.
    expect(rows.every((t) => new Date(t.updatedAt).getTime() > new Date(watermark).getTime())).toBe(true);

    // Our just-touched task is present.
    expect(rows.some((t) => t.id === taskId)).toBe(true);

    // Ordering is non-decreasing by updatedAt.
    for (let i = 1; i < rows.length; i += 1) {
      expect(new Date(rows[i].updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(rows[i - 1].updatedAt).getTime(),
      );
    }
  });


  it('paginated updatedSince follows nextCursor to completion without overlap', async () => {

    // Seed a few more tasks so pagination crosses at least one page boundary.
    for (let i = 0; i < 3; i += 1) {
      const res = await fetch(`${CORE_URL}/tasks`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({
          id: `${taskId}-p${i}`,
          projectId,
          phaseId,
          title: `Sync pagination task ${i}`,
        }),
      });
      expect(res.status).toBe(201);
    }

    // Use the project epoch as the watermark so all project tasks are in scope.
    const epoch = '1970-01-01T00:00:00.000Z';
    const limit = 2;

    const seen: string[] = [];
    let cursor: string | null = null;
    let guard = 0;

    do {
      const url =
        `${CORE_URL}/tasks?projectId=${projectId}&updatedSince=${encodeURIComponent(epoch)}` +
        `&limit=${limit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;

      const res = await fetch(url, { headers: authHeaders(token) });
      expect(res.status).toBe(200);

      const page = (await res.json()) as PaginatedTasks;
      expect(Array.isArray(page.items)).toBe(true);
      expect(page.items.length).toBeLessThanOrEqual(limit);

      for (const t of page.items) seen.push(t.id);

      cursor = page.nextCursor;
      guard += 1;
    } while (cursor && guard < 100);

    expect(cursor).toBeNull();

    // No id appears twice across pages.
    expect(new Set(seen).size).toBe(seen.length);

    // The task we created is somewhere in the paged result.
    expect(seen).toContain(taskId);
  });
});
