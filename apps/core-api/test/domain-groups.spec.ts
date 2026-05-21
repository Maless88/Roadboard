import { describe, it, expect, beforeAll, afterAll } from 'vitest';


const AUTH_URL = 'http://localhost:3002';
const CORE_URL = 'http://localhost:3001';


interface LoginResponse {
  token: string;
  userId: string;
}


interface TeamOrProject {
  id: string;
  slug: string;
  name: string;
}


interface DomainGroup {
  id: string;
  projectId: string;
  name: string;
  color: string | null;
}


interface Repository {
  id: string;
  name: string;
}


interface ArchitectureNode {
  id: string;
  projectId: string;
  type: string;
  name: string;
  domainGroupId: string | null;
}


function authHeaders(token: string): Record<string, string> {

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}


async function login(username: string, password: string): Promise<LoginResponse> {

  const res = await fetch(`${AUTH_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) throw new Error(`login failed: ${res.status}`);

  return res.json() as Promise<LoginResponse>;
}


describe('Domain Groups Integration', () => {

  let token: string;
  let projectId: string;
  let repositoryId: string;
  let groupId: string;
  let nodeId: string;

  beforeAll(async () => {

    const loginRes = await login('alessio', 'roadboard2025');
    token = loginRes.token;

    const teamsRes = await fetch(`${AUTH_URL}/teams`, { headers: authHeaders(token) });
    const teams = await teamsRes.json() as TeamOrProject[];
    const team = teams[0];

    if (!team) throw new Error('no team available for test fixture');

    const projectRes = await fetch(`${CORE_URL}/projects`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        name: `DomainGroup Test ${Date.now()}`,
        slug: `dg-test-${Date.now()}`,
        ownerTeamId: team.id,
      }),
    });

    if (!projectRes.ok) throw new Error(`create project failed: ${projectRes.status}`);

    const project = await projectRes.json() as TeamOrProject;
    projectId = project.id;

    // Create a repository and node for assignment tests
    const repoRes = await fetch(`${CORE_URL}/projects/${projectId}/codeflow/repositories`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ projectId, name: 'test-repo', provider: 'manual' }),
    });

    if (!repoRes.ok) throw new Error(`create repo failed: ${repoRes.status}`);

    const repo = await repoRes.json() as Repository;
    repositoryId = repo.id;

    const nodeRes = await fetch(`${CORE_URL}/projects/${projectId}/codeflow/graph/nodes`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ repositoryId, type: 'app', name: 'auth-service', isManual: true }),
    });

    if (!nodeRes.ok) throw new Error(`create node failed: ${nodeRes.status}`);

    const node = await nodeRes.json() as ArchitectureNode;
    nodeId = node.id;
  });


  afterAll(async () => {

    if (projectId && token) {
      await fetch(`${CORE_URL}/projects/${projectId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => undefined);
    }
  });


  it('creates a domain group', async () => {

    const res = await fetch(`${CORE_URL}/projects/${projectId}/domain-groups`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ name: 'Auth', color: '#6366f1' }),
    });

    expect(res.status).toBe(201);

    const group = await res.json() as DomainGroup;
    expect(group.name).toBe('Auth');
    expect(group.color).toBe('#6366f1');
    expect(group.projectId).toBe(projectId);

    groupId = group.id;
  });


  it('lists domain groups', async () => {

    const res = await fetch(`${CORE_URL}/projects/${projectId}/domain-groups`, {
      headers: authHeaders(token),
    });

    expect(res.status).toBe(200);

    const groups = await res.json() as DomainGroup[];
    expect(groups.length).toBeGreaterThan(0);
    expect(groups.some((g) => g.id === groupId)).toBe(true);
  });


  it('renames a domain group', async () => {

    const res = await fetch(`${CORE_URL}/projects/${projectId}/domain-groups/${groupId}`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({ name: 'Identity' }),
    });

    expect(res.status).toBe(200);

    const group = await res.json() as DomainGroup;
    expect(group.name).toBe('Identity');
  });


  it('assigns a node to a domain group via PATCH /nodes/:id', async () => {

    const res = await fetch(
      `${CORE_URL}/projects/${projectId}/codeflow/graph/nodes/${nodeId}`,
      {
        method: 'PATCH',
        headers: authHeaders(token),
        body: JSON.stringify({ domainGroupId: groupId }),
      },
    );

    expect(res.status).toBe(200);

    const node = await res.json() as ArchitectureNode;
    expect(node.domainGroupId).toBe(groupId);
  });


  it('unassigns a node from a domain group', async () => {

    const res = await fetch(
      `${CORE_URL}/projects/${projectId}/codeflow/graph/nodes/${nodeId}`,
      {
        method: 'PATCH',
        headers: authHeaders(token),
        body: JSON.stringify({ domainGroupId: null }),
      },
    );

    expect(res.status).toBe(200);

    const node = await res.json() as ArchitectureNode;
    expect(node.domainGroupId).toBeNull();
  });


  it('deletes a domain group', async () => {

    const res = await fetch(
      `${CORE_URL}/projects/${projectId}/domain-groups/${groupId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    const body = await res.json().catch(() => null);
    expect(res.status, `DELETE failed: ${JSON.stringify(body)}`).toBe(200);

    // Verify it's gone
    const listRes = await fetch(
      `${CORE_URL}/projects/${projectId}/domain-groups`,
      { headers: authHeaders(token) },
    );

    const groups = await listRes.json() as DomainGroup[];
    expect(groups.some((g) => g.id === groupId)).toBe(false);
  });
});
