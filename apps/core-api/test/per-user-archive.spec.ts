/**
 * Per-User Archive Integration Suite
 *
 * Verifies that POST /projects/:projectId/archive and DELETE /projects/:projectId/archive
 * implement a user-scoped (not global) archive flag, and that GET /projects returns the
 * correct archivedForMe boolean per user.
 *
 *  1. Owner archives a shared project for themselves; teammate still sees it as not archived.
 *  2. Teammate archives the same project for themselves; owner is unaffected.
 *  3. Archive is idempotent (POST twice → still 2xx, single row).
 *  4. Unarchive is idempotent (DELETE twice → still 2xx).
 *  5. Project status remains 'active' through archive/unarchive cycles (no global mutation).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const AUTH_URL = 'http://localhost:3002';
const CORE_URL = 'http://localhost:3001';

const RUN_ID = Date.now();
const TEST_SLUG = `test-archive-${RUN_ID}`;


interface AuthResponse {
  token: string;
  userId: string;
}


interface Project {
  id: string;
  name: string;
  slug: string;
  status: string;
  ownerUserId: string | null;
  archivedForMe?: boolean;
}


function auth(token: string): Record<string, string> {

  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}


function authDelete(token: string): Record<string, string> {

  return { Authorization: `Bearer ${token}` };
}


describe('Per-User Archive Integration', () => {

  let ownerToken: string;
  let ownerUserId: string;
  let mateToken: string;
  let mateUserId: string;
  let teamId: string;
  let projectId: string;


  beforeAll(async () => {

    const [core, authSvc] = await Promise.all([
      fetch(`${CORE_URL}/health`).catch(() => null),
      fetch(`${AUTH_URL}/health`).catch(() => null),
    ]);

    if (!core?.ok || !authSvc?.ok) {
      throw new Error('Services not running. Start core-api (:3001) and auth-access (:3002) first.');
    }

    const ownerLogin = await fetch(`${AUTH_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'alessio', password: '***REDACTED***' }),
    });

    expect(ownerLogin.status).toBe(201);
    const ownerData = await ownerLogin.json() as AuthResponse;
    ownerToken = ownerData.token;
    ownerUserId = ownerData.userId;

    const mateLogin = await fetch(`${AUTH_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'dev3', password: '***REDACTED***' }),
    });

    expect(mateLogin.status).toBe(201);
    const mateData = await mateLogin.json() as AuthResponse;
    mateToken = mateData.token;
    mateUserId = mateData.userId;

    const teamsRes = await fetch(`${AUTH_URL}/teams`, { headers: auth(ownerToken) });
    expect(teamsRes.status).toBe(200);
    const teams = await teamsRes.json() as Array<{ id: string; slug: string }>;
    const coreTeam = teams.find((t) => t.slug === 'core-team');
    expect(coreTeam).toBeDefined();
    teamId = coreTeam!.id;

    const createRes = await fetch(`${CORE_URL}/projects`, {
      method: 'POST',
      headers: auth(ownerToken),
      body: JSON.stringify({
        name: `Archive Test ${RUN_ID}`,
        slug: TEST_SLUG,
        description: 'per-user archive isolation test project',
        ownerTeamId: teamId,
        status: 'active',
      }),
    });

    expect(createRes.status).toBe(201);
    const project = await createRes.json() as Project;
    projectId = project.id;
    expect(project.ownerUserId).toBe(ownerUserId);
  });


  afterAll(async () => {

    if (projectId && ownerToken) {
      await fetch(`${CORE_URL}/projects/${projectId}`, {
        method: 'DELETE',
        headers: authDelete(ownerToken),
      }).catch(() => null);
    }
  });


  it('initially archivedForMe is false for both users', async () => {

    const ownerList = await fetch(`${CORE_URL}/projects`, { headers: auth(ownerToken) }).then((r) => r.json()) as Project[];
    const mateList = await fetch(`${CORE_URL}/projects`, { headers: auth(mateToken) }).then((r) => r.json()) as Project[];

    const ownerView = ownerList.find((p) => p.id === projectId);
    const mateView = mateList.find((p) => p.id === projectId);

    expect(ownerView).toBeDefined();
    expect(mateView).toBeDefined();
    expect(ownerView!.archivedForMe).toBe(false);
    expect(mateView!.archivedForMe).toBe(false);
  });


  it('owner archives the project for themselves', async () => {

    const res = await fetch(`${CORE_URL}/projects/${projectId}/archive`, {
      method: 'POST',
      headers: auth(ownerToken),
    });

    expect([200, 201]).toContain(res.status);
  });


  it('owner sees archivedForMe=true; teammate still sees archivedForMe=false', async () => {

    const ownerList = await fetch(`${CORE_URL}/projects`, { headers: auth(ownerToken) }).then((r) => r.json()) as Project[];
    const mateList = await fetch(`${CORE_URL}/projects`, { headers: auth(mateToken) }).then((r) => r.json()) as Project[];

    const ownerView = ownerList.find((p) => p.id === projectId);
    const mateView = mateList.find((p) => p.id === projectId);

    expect(ownerView!.archivedForMe).toBe(true);
    expect(mateView!.archivedForMe).toBe(false);
    expect(ownerView!.status).toBe('active');
    expect(mateView!.status).toBe('active');
  });


  it('archive is idempotent (POST twice → still ok)', async () => {

    const res = await fetch(`${CORE_URL}/projects/${projectId}/archive`, {
      method: 'POST',
      headers: auth(ownerToken),
    });

    expect([200, 201]).toContain(res.status);

    const ownerList = await fetch(`${CORE_URL}/projects`, { headers: auth(ownerToken) }).then((r) => r.json()) as Project[];
    expect(ownerList.find((p) => p.id === projectId)!.archivedForMe).toBe(true);
  });


  it('teammate archives the project for themselves; owner state independent', async () => {

    const res = await fetch(`${CORE_URL}/projects/${projectId}/archive`, {
      method: 'POST',
      headers: auth(mateToken),
    });

    expect([200, 201]).toContain(res.status);

    const ownerList = await fetch(`${CORE_URL}/projects`, { headers: auth(ownerToken) }).then((r) => r.json()) as Project[];
    const mateList = await fetch(`${CORE_URL}/projects`, { headers: auth(mateToken) }).then((r) => r.json()) as Project[];

    expect(ownerList.find((p) => p.id === projectId)!.archivedForMe).toBe(true);
    expect(mateList.find((p) => p.id === projectId)!.archivedForMe).toBe(true);
  });


  it('owner unarchives only for themselves; teammate stays archived', async () => {

    const res = await fetch(`${CORE_URL}/projects/${projectId}/archive`, {
      method: 'DELETE',
      headers: authDelete(ownerToken),
    });

    expect(res.status).toBe(200);

    const ownerList = await fetch(`${CORE_URL}/projects`, { headers: auth(ownerToken) }).then((r) => r.json()) as Project[];
    const mateList = await fetch(`${CORE_URL}/projects`, { headers: auth(mateToken) }).then((r) => r.json()) as Project[];

    expect(ownerList.find((p) => p.id === projectId)!.archivedForMe).toBe(false);
    expect(mateList.find((p) => p.id === projectId)!.archivedForMe).toBe(true);
  });


  it('unarchive is idempotent (DELETE on non-existing row → 200)', async () => {

    const res = await fetch(`${CORE_URL}/projects/${projectId}/archive`, {
      method: 'DELETE',
      headers: authDelete(ownerToken),
    });

    expect(res.status).toBe(200);
  });


  it('project.status remains active throughout the archive lifecycle', async () => {

    const res = await fetch(`${CORE_URL}/projects/${projectId}`, { headers: auth(ownerToken) });
    expect(res.status).toBe(200);
    const project = await res.json() as Project;
    expect(project.status).toBe('active');
  });
});
