import { describe, it, expect, beforeAll } from 'vitest';

const AUTH_URL = 'http://localhost:3002';
const CORE_URL = 'http://localhost:3001';


interface LoginResponse {
  token: string;
  userId: string;
}


interface CodeRepository {
  id: string;
  projectId: string;
  name: string;
  repoUrl: string | null;
  provider: string;
  defaultBranch: string;
}


function authHeaders(token: string): Record<string, string> {

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}


describe('Project Repositories Integration', () => {

  let token: string;
  let projectId: string;
  let repoId: string;


  beforeAll(async () => {

    const healthChecks = await Promise.all([
      fetch(`${AUTH_URL}/health`).catch(() => null),
      fetch(`${CORE_URL}/health`).catch(() => null),
    ]);

    if (!healthChecks[0]?.ok || !healthChecks[1]?.ok) {
      throw new Error(
        'Services not running. Start auth-access (:3002) and core-api (:3001) before running integration tests.',
      );
    }

    const loginRes = await fetch(`${AUTH_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'alessio', password: 'roadboard2025' }),
    });

    if (!loginRes.ok) {
      throw new Error('Login failed — seed user not present');
    }

    const loginData = (await loginRes.json()) as LoginResponse;
    token = loginData.token;

    // Create a temporary project for the test
    const teamRes = await fetch(`${CORE_URL}/teams`, {
      headers: authHeaders(token),
    });

    const teams = (await teamRes.json()) as Array<{ id: string }>;
    const ownerTeamId = teams[0]?.id;

    if (!ownerTeamId) {
      throw new Error('No team available for test');
    }

    const projRes = await fetch(`${CORE_URL}/projects`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        name: 'Repo Test Project',
        slug: `repo-test-${Date.now()}`,
        ownerTeamId,
        status: 'draft',
      }),
    });

    const project = (await projRes.json()) as { id: string };
    projectId = project.id;
  });


  it('POST /projects/:id/repositories creates a repository', async () => {

    const res = await fetch(`${CORE_URL}/projects/${projectId}/repositories`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        provider: 'github',
        repoUrl: 'https://github.com/acme/test-repo',
      }),
    });

    expect(res.status).toBe(201);

    const repo = (await res.json()) as CodeRepository;

    expect(repo.id).toBeDefined();
    expect(repo.projectId).toBe(projectId);
    expect(repo.name).toBe('test-repo');
    expect(repo.provider).toBe('github');
    expect(repo.defaultBranch).toBe('main');

    repoId = repo.id;
  });


  it('GET /projects/:id/repositories lists repositories', async () => {

    const res = await fetch(`${CORE_URL}/projects/${projectId}/repositories`, {
      headers: authHeaders(token),
    });

    expect(res.status).toBe(200);

    const repos = (await res.json()) as CodeRepository[];

    expect(Array.isArray(repos)).toBe(true);
    expect(repos.some((r) => r.id === repoId)).toBe(true);
  });


  it('POST /projects/:id/repositories returns 400 for invalid URL', async () => {

    const res = await fetch(`${CORE_URL}/projects/${projectId}/repositories`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        provider: 'github',
        repoUrl: 'not-a-url',
      }),
    });

    expect(res.status).toBe(400);
  });


  it('POST /projects/:id/repositories returns 400 for invalid provider', async () => {

    const res = await fetch(`${CORE_URL}/projects/${projectId}/repositories`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        provider: 'unknown-provider',
        repoUrl: 'https://github.com/acme/repo',
      }),
    });

    expect(res.status).toBe(400);
  });
});
