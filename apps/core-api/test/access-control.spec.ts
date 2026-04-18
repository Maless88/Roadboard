/**
 * Access Control Integration Suite
 *
 * Tests the full ownership and grant model end-to-end via HTTP:
 *   1. Unauthenticated requests are rejected
 *   2. Project creation → owner receives user-level project.admin grant
 *   3. Non-member (no team, no grant) cannot create phases or tasks
 *   4. Developer (project.write + task.write) CAN create phases and tasks
 *   5. Developer CANNOT delete the project (needs project.admin)
 *   6. Team member with project.admin via team CANNOT delete (service-level owner check)
 *   7. Owner CAN delete
 *   8. Phase status auto-computes from task statuses
 *   9. Project status auto-computes from phase statuses
 *  10. findAll() returns only projects the user has access to
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const AUTH_URL = 'http://localhost:3002';
const CORE_URL = 'http://localhost:3001';

const RUN_ID = Date.now();
const TEST_SLUG = `test-ac-${RUN_ID}`;
const OUTSIDER_USERNAME = `outsider_${RUN_ID}`;


interface AuthResponse {
  token: string;
  userId: string;
}

interface Grant {
  id: string;
  projectId: string;
  subjectType: string;
  subjectId: string;
  grantType: string;
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
}

interface Project {
  id: string;
  name: string;
  slug: string;
  status: string;
  ownerUserId: string | null;
}

interface User {
  id: string;
  username: string;
}


function auth(token: string): Record<string, string> {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

function authDelete(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}


describe('Access Control Integration', () => {

  let ownerToken: string;
  let ownerUserId: string;
  let dev3Token: string;
  let dev3Id: string;
  let outsiderToken: string;
  let outsiderId: string;
  let teamId: string;
  let projectId: string;
  let ownerPhaseId: string;
  let ownerTaskId: string;


  beforeAll(async () => {

    const [core, authSvc] = await Promise.all([
      fetch(`${CORE_URL}/health`).catch(() => null),
      fetch(`${AUTH_URL}/health`).catch(() => null),
    ]);

    if (!core?.ok || !authSvc?.ok) {
      throw new Error('Services not running. Start core-api (:3001) and auth-access (:3002) first.');
    }
  });


  afterAll(async () => {

    if (projectId && ownerToken) {
      await fetch(`${CORE_URL}/projects/${projectId}`, {
        method: 'DELETE',
        headers: authDelete(ownerToken),
      }).catch(() => null);
    }

    if (outsiderId && ownerToken) {
      await fetch(`${AUTH_URL}/users/${outsiderId}`, {
        method: 'DELETE',
        headers: authDelete(ownerToken),
      }).catch(() => null);
    }
  });


  // ── 1. Prerequisites ──────────────────────────────────────────────────────

  describe('1. Prerequisite — service health and login', () => {

    it('core-api is healthy', async () => {

      const res = await fetch(`${CORE_URL}/health`);
      expect(res.status).toBe(200);
      const data = await res.json() as { status: string };
      expect(data.status).toBe('ok');
    });


    it('owner (alessio) can log in', async () => {

      const res = await fetch(`${AUTH_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'alessio', password: '***REDACTED***' }),
      });

      expect(res.status).toBe(201);
      const data = await res.json() as AuthResponse;
      ownerToken = data.token;
      ownerUserId = data.userId;
      expect(ownerToken).toBeDefined();
    });


    it('dev3 can log in', async () => {

      const res = await fetch(`${AUTH_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'dev3', password: '***REDACTED***' }),
      });

      expect(res.status).toBe(201);
      const data = await res.json() as AuthResponse;
      dev3Token = data.token;
      dev3Id = data.userId;
    });


    it('admin can fetch team list', async () => {

      const res = await fetch(`${AUTH_URL}/teams`, { headers: auth(ownerToken) });
      expect(res.status).toBe(200);
      const teams = await res.json() as Array<{ id: string; slug: string }>;
      const coreTeam = teams.find((t) => t.slug === 'core-team');
      expect(coreTeam).toBeDefined();
      teamId = coreTeam!.id;
    });


    it('admin can create outsider user (no team membership)', async () => {

      const res = await fetch(`${AUTH_URL}/users`, {
        method: 'POST',
        headers: auth(ownerToken),
        body: JSON.stringify({
          username: OUTSIDER_USERNAME,
          displayName: 'Outsider Test',
          email: `${OUTSIDER_USERNAME}@test.local`,
          password: 'testpass2025',
        }),
      });

      expect(res.status).toBe(201);
      const user = await res.json() as User;
      outsiderId = user.id;
    });


    it('outsider can log in', async () => {

      const res = await fetch(`${AUTH_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: OUTSIDER_USERNAME, password: 'testpass2025' }),
      });

      expect(res.status).toBe(201);
      const data = await res.json() as AuthResponse;
      outsiderToken = data.token;
    });
  });


  // ── 2. Unauthenticated rejection ─────────────────────────────────────────

  describe('2. Unauthenticated requests are rejected', () => {

    it('GET /projects without token → 401', async () => {

      const res = await fetch(`${CORE_URL}/projects`);
      expect(res.status).toBe(401);
    });


    it('POST /tasks without token → 401', async () => {

      const res = await fetch(`${CORE_URL}/tasks`, { method: 'POST' });
      expect(res.status).toBe(401);
    });


    it('DELETE /projects/:id without token → 401', async () => {

      const res = await fetch(`${CORE_URL}/projects/any-id`, { method: 'DELETE' });
      expect(res.status).toBe(401);
    });
  });


  // ── 3. Project creation and ownership ────────────────────────────────────

  describe('3. Project creation — owner receives user-level admin grant', () => {

    it('owner creates a test project', async () => {

      const res = await fetch(`${CORE_URL}/projects`, {
        method: 'POST',
        headers: auth(ownerToken),
        body: JSON.stringify({
          name: `AC Test ${RUN_ID}`,
          slug: TEST_SLUG,
          description: 'Access control integration test project',
          ownerTeamId: teamId,
          status: 'active',
        }),
      });

      expect(res.status).toBe(201);
      const project = await res.json() as Project;
      projectId = project.id;
      expect(project.ownerUserId).toBe(ownerUserId);
    });


    it('project has a team-level project.admin grant', async () => {

      const res = await fetch(`${AUTH_URL}/grants?projectId=${projectId}`, { headers: auth(ownerToken) });
      expect(res.status).toBe(200);
      const grants = await res.json() as Grant[];
      const teamGrant = grants.find((g) => g.subjectType === 'team' && g.grantType === 'project.admin');
      expect(teamGrant).toBeDefined();
    });


    it('project has a user-level project.admin grant for the owner', async () => {

      const res = await fetch(`${AUTH_URL}/grants?projectId=${projectId}`, { headers: auth(ownerToken) });
      const grants = await res.json() as Grant[];
      const userGrant = grants.find(
        (g) => g.subjectType === 'user' && g.subjectId === ownerUserId && g.grantType === 'project.admin',
      );
      expect(userGrant).toBeDefined();
    });


    it('owner can create a phase in the project', async () => {

      const res = await fetch(`${CORE_URL}/phases`, {
        method: 'POST',
        headers: auth(ownerToken),
        body: JSON.stringify({
          projectId,
          title: 'Sprint 1',
          description: 'First test phase',
          orderIndex: 0,
        }),
      });

      expect(res.status).toBe(201);
      const phase = await res.json() as Phase;
      ownerPhaseId = phase.id;
      expect(phase.status).toBe('planned');
    });


    it('owner can create a task in the phase', async () => {

      const res = await fetch(`${CORE_URL}/tasks`, {
        method: 'POST',
        headers: auth(ownerToken),
        body: JSON.stringify({
          projectId,
          phaseId: ownerPhaseId,
          title: 'Owner task',
          priority: 'high',
        }),
      });

      expect(res.status).toBe(201);
      const task = await res.json() as Task;
      ownerTaskId = task.id;
      expect(task.phaseId).toBe(ownerPhaseId);
    });
  });


  // ── 4. Outsider (no grants) cannot manage the project ────────────────────

  describe('4. Outsider (no grants) — all write operations forbidden', () => {

    it('outsider cannot create a phase → 403', async () => {

      const res = await fetch(`${CORE_URL}/phases`, {
        method: 'POST',
        headers: auth(outsiderToken),
        body: JSON.stringify({ projectId, title: 'Hacked Phase' }),
      });

      expect(res.status).toBe(403);
    });


    it('outsider cannot create a task → 403', async () => {

      const res = await fetch(`${CORE_URL}/tasks`, {
        method: 'POST',
        headers: auth(outsiderToken),
        body: JSON.stringify({
          projectId,
          phaseId: ownerPhaseId,
          title: 'Hacked Task',
          priority: 'low',
        }),
      });

      expect(res.status).toBe(403);
    });


    it('outsider cannot delete the project → 403', async () => {

      const res = await fetch(`${CORE_URL}/projects/${projectId}`, {
        method: 'DELETE',
        headers: authDelete(outsiderToken),
      });

      expect(res.status).toBe(403);
    });


    it('outsider cannot update a task status → 403', async () => {

      const res = await fetch(`${CORE_URL}/tasks/${ownerTaskId}`, {
        method: 'PATCH',
        headers: auth(outsiderToken),
        body: JSON.stringify({ status: 'done' }),
      });

      expect(res.status).toBe(403);
    });
  });


  // ── 5. Add outsider as developer ─────────────────────────────────────────

  describe('5. Owner grants developer access to outsider', () => {

    it('owner grants project.write to outsider', async () => {

      const res = await fetch(`${AUTH_URL}/grants`, {
        method: 'POST',
        headers: auth(ownerToken),
        body: JSON.stringify({
          projectId,
          subjectType: 'user',
          subjectId: outsiderId,
          grantType: 'project.write',
          grantedByUserId: ownerUserId,
        }),
      });

      expect(res.status).toBe(201);
    });


    it('owner grants task.write to outsider', async () => {

      const res = await fetch(`${AUTH_URL}/grants`, {
        method: 'POST',
        headers: auth(ownerToken),
        body: JSON.stringify({
          projectId,
          subjectType: 'user',
          subjectId: outsiderId,
          grantType: 'task.write',
          grantedByUserId: ownerUserId,
        }),
      });

      expect(res.status).toBe(201);
    });


    it('project now has 4 grants total (team-admin, user-admin, user-write, task-write)', async () => {

      const res = await fetch(`${AUTH_URL}/grants?projectId=${projectId}`, { headers: auth(ownerToken) });
      const grants = await res.json() as Grant[];
      expect(grants.length).toBe(4);
    });
  });


  // ── 6. Developer (project.write + task.write) access ─────────────────────

  describe('6. Developer access — can create, cannot delete project', () => {

    let devPhaseId: string;
    let devTaskId: string;

    it('developer can create a phase (project.write)', async () => {

      const res = await fetch(`${CORE_URL}/phases`, {
        method: 'POST',
        headers: auth(outsiderToken),
        body: JSON.stringify({
          projectId,
          title: 'Dev Phase',
          orderIndex: 1,
        }),
      });

      expect(res.status).toBe(201);
      const phase = await res.json() as Phase;
      devPhaseId = phase.id;
    });


    it('developer can create a task (task.write)', async () => {

      const res = await fetch(`${CORE_URL}/tasks`, {
        method: 'POST',
        headers: auth(outsiderToken),
        body: JSON.stringify({
          projectId,
          phaseId: devPhaseId,
          title: 'Dev Task',
          priority: 'medium',
        }),
      });

      expect(res.status).toBe(201);
      const task = await res.json() as Task;
      devTaskId = task.id;
      expect(task.phaseId).toBe(devPhaseId);
    });


    it('developer can update their own task status', async () => {

      const res = await fetch(`${CORE_URL}/tasks/${devTaskId}`, {
        method: 'PATCH',
        headers: auth(outsiderToken),
        body: JSON.stringify({ status: 'in_progress' }),
      });

      expect(res.status).toBe(200);
      const task = await res.json() as Task;
      expect(task.status).toBe('in_progress');
    });


    it('developer cannot delete the project — lacks project.admin (403 at grant check)', async () => {

      const res = await fetch(`${CORE_URL}/projects/${projectId}`, {
        method: 'DELETE',
        headers: authDelete(outsiderToken),
      });

      expect(res.status).toBe(403);
    });
  });


  // ── 7. Team member (project.admin via team) cannot delete — service check ─

  describe('7. Team member with project.admin via team — service-level owner check blocks delete', () => {

    it('dev3 has project.admin via core-team (grant check passes)', async () => {

      const res = await fetch(`${AUTH_URL}/grants/check?projectId=${projectId}&subjectType=user&subjectId=${dev3Id}&grantType=project.admin`, {
        headers: auth(dev3Token),
      });

      expect(res.status).toBe(200);
      const data = await res.json() as { allowed: boolean };
      expect(data.allowed).toBe(true);
    });


    it('dev3 cannot delete the project — is not the owner (403 from service)', async () => {

      const res = await fetch(`${CORE_URL}/projects/${projectId}`, {
        method: 'DELETE',
        headers: authDelete(dev3Token),
      });

      expect(res.status).toBe(403);
    });
  });


  // ── 8. Phase/project auto-status ─────────────────────────────────────────

  describe('8. Auto-status computation', () => {

    it('marking the only task in a phase as done → phase becomes completed', async () => {

      // ownerPhaseId has only ownerTaskId
      const patchRes = await fetch(`${CORE_URL}/tasks/${ownerTaskId}`, {
        method: 'PATCH',
        headers: auth(ownerToken),
        body: JSON.stringify({ status: 'done' }),
      });

      expect(patchRes.status).toBe(200);

      const phaseRes = await fetch(`${CORE_URL}/phases/${ownerPhaseId}`, { headers: auth(ownerToken) });
      const phase = await phaseRes.json() as Phase;
      expect(phase.status).toBe('completed');
    });


    it('phase with in_progress task → phase stays in_progress', async () => {

      // Dev phase has a task in_progress
      const phaseRes = await fetch(`${CORE_URL}/phases?projectId=${projectId}`, { headers: auth(ownerToken) });
      const phases = await phaseRes.json() as Phase[];
      const devPhase = phases.find((p) => p.title === 'Dev Phase');
      expect(devPhase?.status).toBe('in_progress');
    });
  });


  // ── 9. Project visibility — findAll filters by user grants ────────────────

  describe('9. Project listing — filtered by user access', () => {

    it('owner sees the test project in their list', async () => {

      const res = await fetch(`${CORE_URL}/projects`, { headers: auth(ownerToken) });
      expect(res.status).toBe(200);
      const projects = await res.json() as Project[];
      const found = projects.find((p) => p.id === projectId);
      expect(found).toBeDefined();
    });


    it('outsider (developer on test project) sees only projects they have access to', async () => {

      const res = await fetch(`${CORE_URL}/projects`, { headers: auth(outsiderToken) });
      expect(res.status).toBe(200);
      const projects = await res.json() as Project[];
      const found = projects.find((p) => p.id === projectId);
      expect(found).toBeDefined();

      // Outsider is NOT in core-team → should NOT see Roadboard 2.0 or GuardianAngel
      const roadboard = projects.find((p) => p.slug === 'roadboard-2');
      expect(roadboard).toBeUndefined();
    });


    it('dev3 (core-team member) sees all projects the team has access to', async () => {

      const res = await fetch(`${CORE_URL}/projects`, { headers: auth(dev3Token) });
      expect(res.status).toBe(200);
      const projects = await res.json() as Project[];
      const roadboard = projects.find((p) => p.slug === 'roadboard-2');
      expect(roadboard).toBeDefined();
    });
  });


  // ── 10. Owner deletes the project ─────────────────────────────────────────

  describe('10. Owner can delete the project', () => {

    it('owner deletes the test project → 200', async () => {

      const res = await fetch(`${CORE_URL}/projects/${projectId}`, {
        method: 'DELETE',
        headers: authDelete(ownerToken),
      });

      expect(res.status).toBe(200);
    });


    it('deleted project is no longer accessible', async () => {

      const res = await fetch(`${CORE_URL}/projects/${projectId}`, { headers: auth(ownerToken) });
      expect(res.status).toBe(404);
    });


    it('projectId cleared to skip afterAll double-delete', () => {

      projectId = '';
    });
  });
});
