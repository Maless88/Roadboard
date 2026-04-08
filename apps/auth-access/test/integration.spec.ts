import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const AUTH_URL = 'http://localhost:3002';
const CORE_API_URL = 'http://localhost:3001';


interface LoginResponse {
  token: string;
  userId: string;
  expiresAt: string;
}


interface Team {
  id: string;
  name: string;
  slug: string;
}


interface Membership {
  id: string;
  teamId: string;
  userId: string;
  role: string;
  status: string;
}


interface Grant {
  id: string;
  projectId: string;
  subjectType: string;
  subjectId: string;
  grantType: string;
}


interface McpToken {
  id: string;
  userId: string;
  name: string;
  token: string;
  scope: string;
  status: string;
}


interface ValidateSessionResponse {
  sessionId: string;
  userId: string;
  username: string;
  displayName: string;
  expiresAt: string;
}


interface ValidateTokenResponse {
  userId: string;
  scope: string;
}


interface Project {
  id: string;
  slug: string;
  name: string;
}


function authHeaders(token: string): Record<string, string> {

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}


function bearerHeader(token: string): Record<string, string> {

  return { Authorization: `Bearer ${token}` };
}


describe('auth-access Integration', () => {
  let token: string;
  let userId: string;
  let teamId: string;
  let membershipId: string;
  let grantId: string;
  let mcpTokenId: string;
  let mcpTokenRaw: string;
  let testProjectId: string;

  const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;


  afterAll(async () => {

    if (!token) return;

    if (grantId) {
      await fetch(`${AUTH_URL}/grants/${grantId}`, { method: 'DELETE', headers: bearerHeader(token) }).catch(() => null);
    }

    if (membershipId) {
      await fetch(`${AUTH_URL}/memberships/${membershipId}`, { method: 'DELETE', headers: bearerHeader(token) }).catch(() => null);
    }

    if (teamId) {
      await fetch(`${AUTH_URL}/teams/${teamId}`, { method: 'DELETE', headers: bearerHeader(token) }).catch(() => null);
    }
  });


  beforeAll(async () => {

    const health = await fetch(`${AUTH_URL}/health`).catch(() => null);

    if (!health?.ok) {
      throw new Error('auth-access not running. Start it on :3002 before running integration tests.');
    }

    const loginRes = await fetch(`${AUTH_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'alessio', password: 'roadboard2025' }),
    });

    const data = (await loginRes.json()) as LoginResponse;
    token = data.token;
    userId = data.userId;

    const projectsRes = await fetch(`${CORE_API_URL}/projects`, {
      headers: bearerHeader(token),
    }).catch(() => null);

    if (projectsRes?.ok) {
      const projects = (await projectsRes.json()) as Project[];

      if (projects.length > 0) {
        testProjectId = projects[0].id;
      }
    }
  });


  describe('Auth', () => {

    it('should reject login with wrong password', async () => {

      const res = await fetch(`${AUTH_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'alessio', password: 'wrongpassword' }),
      });

      expect(res.status).toBe(401);
    });


    it('should login with valid credentials', async () => {

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
  });


  describe('Sessions', () => {

    it('should validate a valid session token', async () => {

      const res = await fetch(`${AUTH_URL}/sessions/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      expect(res.status).toBe(201);

      const data = (await res.json()) as ValidateSessionResponse;

      expect(data.userId).toBe(userId);
      expect(data.username).toBe('alessio');
      expect(data.sessionId).toBeDefined();
    });


    it('should reject an invalid session token', async () => {

      const res = await fetch(`${AUTH_URL}/sessions/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'invalid-token-xyz' }),
      });

      expect(res.status).toBe(401);
    });


    it('should list active sessions for the user', async () => {

      const res = await fetch(`${AUTH_URL}/sessions?userId=${userId}`, {
        headers: authHeaders(token),
      });

      expect(res.status).toBe(200);

      const data = (await res.json()) as unknown[];

      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });
  });


  describe('Teams', () => {

    it('should create a team', async () => {

      const res = await fetch(`${AUTH_URL}/teams`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ name: `Test Team ${RUN_ID}`, slug: `test-team-${RUN_ID}` }),
      });

      expect(res.status).toBe(201);

      const data = (await res.json()) as Team;

      expect(data.id).toBeDefined();
      expect(data.name).toBe(`Test Team ${RUN_ID}`);

      teamId = data.id;
    });


    it('should list teams', async () => {

      const res = await fetch(`${AUTH_URL}/teams`, {
        headers: authHeaders(token),
      });

      expect(res.status).toBe(200);

      const data = (await res.json()) as Team[];

      expect(Array.isArray(data)).toBe(true);
      expect(data.some((t) => t.id === teamId)).toBe(true);
    });
  });


  describe('Memberships', () => {

    it('should add a membership to the team', async () => {

      const res = await fetch(`${AUTH_URL}/memberships`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ teamId, userId, role: 'admin' }),
      });

      expect(res.status).toBe(201);

      const data = (await res.json()) as Membership;

      expect(data.id).toBeDefined();
      expect(data.teamId).toBe(teamId);
      expect(data.userId).toBe(userId);
      expect(data.role).toBe('admin');

      membershipId = data.id;
    });


    it('should list memberships for the team', async () => {

      const res = await fetch(`${AUTH_URL}/memberships?teamId=${teamId}`, {
        headers: authHeaders(token),
      });

      expect(res.status).toBe(200);

      const data = (await res.json()) as Membership[];

      expect(Array.isArray(data)).toBe(true);
      expect(data.some((m) => m.id === membershipId)).toBe(true);
    });
  });


  describe('Grants', () => {

    it('should create a project grant', async () => {

      if (!testProjectId) {
        console.warn('Skipping grants tests: no project found in core-api');
        return;
      }

      const res = await fetch(`${AUTH_URL}/grants`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({
          projectId: testProjectId,
          subjectType: 'team',
          subjectId: teamId,
          grantType: 'project:admin',
          grantedByUserId: userId,
        }),
      });

      expect(res.status).toBe(201);

      const data = (await res.json()) as Grant;

      expect(data.id).toBeDefined();
      expect(data.projectId).toBe(testProjectId);
      expect(data.subjectId).toBe(teamId);

      grantId = data.id;
    });


    it('should list grants for a project', async () => {

      if (!testProjectId) return;

      const res = await fetch(`${AUTH_URL}/grants?projectId=${testProjectId}`, {
        headers: authHeaders(token),
      });

      expect(res.status).toBe(200);

      const data = (await res.json()) as Grant[];

      expect(Array.isArray(data)).toBe(true);
      expect(data.some((g) => g.id === grantId)).toBe(true);
    });


    it('should confirm permission via grant check', async () => {

      if (!testProjectId) return;

      const params = new URLSearchParams({
        projectId: testProjectId,
        subjectType: 'team',
        subjectId: teamId,
        grantType: 'project:admin',
      });

      const res = await fetch(`${AUTH_URL}/grants/check?${params}`, {
        headers: authHeaders(token),
      });

      expect(res.status).toBe(200);

      const data = (await res.json()) as { allowed: boolean };

      expect(data.allowed).toBe(true);
    });
  });


  describe('MCP Tokens', () => {

    it('should issue an MCP token', async () => {

      const res = await fetch(`${AUTH_URL}/tokens`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({
          userId,
          name: 'integration-test-token',
          scope: 'read write',
        }),
      });

      expect(res.status).toBe(201);

      const data = (await res.json()) as McpToken;

      expect(data.id).toBeDefined();
      expect(data.token).toBeDefined();
      expect(data.name).toBe('integration-test-token');
      expect(data.scope).toBe('read write');

      mcpTokenId = data.id;
      mcpTokenRaw = data.token;
    });


    it('should list MCP tokens for user', async () => {

      const res = await fetch(`${AUTH_URL}/tokens?userId=${userId}`, {
        headers: authHeaders(token),
      });

      expect(res.status).toBe(200);

      const data = (await res.json()) as McpToken[];

      expect(Array.isArray(data)).toBe(true);
      expect(data.some((t) => t.id === mcpTokenId)).toBe(true);
    });


    it('should validate a valid MCP token', async () => {

      const res = await fetch(`${AUTH_URL}/tokens/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: mcpTokenRaw }),
      });

      expect(res.status).toBe(201);

      const data = (await res.json()) as ValidateTokenResponse;

      expect(data.userId).toBe(userId);
      expect(data.scope).toBe('read write');
    });


    it('should reject an invalid MCP token', async () => {

      const res = await fetch(`${AUTH_URL}/tokens/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'invalid-mcp-token-xyz' }),
      });

      expect(res.status).toBe(401);
    });


    it('should revoke an MCP token', async () => {

      const res = await fetch(`${AUTH_URL}/tokens/${mcpTokenId}`, {
        method: 'DELETE',
        headers: bearerHeader(token),
      });

      expect(res.status).toBe(200);
    });


    it('should reject the revoked MCP token', async () => {

      const res = await fetch(`${AUTH_URL}/tokens/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: mcpTokenRaw }),
      });

      expect(res.status).toBe(401);
    });
  });


  describe('Logout', () => {

    it('should logout and invalidate the session', async () => {

      const res = await fetch(`${AUTH_URL}/auth/logout`, {
        method: 'POST',
        headers: bearerHeader(token),
      });

      expect(res.status).toBe(201);

      const data = (await res.json()) as { success: boolean };

      expect(data.success).toBe(true);
    });


    it('should reject session validation after logout', async () => {

      const res = await fetch(`${AUTH_URL}/sessions/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      expect(res.status).toBe(401);
    });
  });
});
