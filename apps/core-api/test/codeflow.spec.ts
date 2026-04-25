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


interface Repository {
  id: string;
  name: string;
}


interface ArchitectureNode {
  id: string;
  projectId: string;
  type: string;
  name: string;
  path: string | null;
  isManual: boolean;
}


interface ArchitectureEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  edgeType: string;
  isManual: boolean;
}


interface ArchitectureLink {
  id: string;
  nodeId: string;
  entityType: string;
  entityId: string;
  linkType: string;
}


interface GraphResponse {
  snapshotId: string | null;
  nodes: Array<{
    id: string;
    type: string;
    name: string;
    path: string | null;
    openTaskCount: number;
    decisionCount: number;
    annotationCount: number;
  }>;
  edges: Array<{
    id: string;
    fromNodeId: string;
    toNodeId: string;
    edgeType: string;
  }>;
}


interface NodeDetail extends ArchitectureNode {
  annotations: unknown[];
  links: ArchitectureLink[];
}


interface ImpactResponse {
  triggerNode: { id: string; name: string };
  direct: Array<{ id: string; name: string }>;
  indirect: Array<{ id: string; name: string }>;
  remote: Array<{ id: string; name: string }>;
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


describe('CodeFlow Graph Integration', () => {

  let token: string;
  let projectId: string;
  let repositoryId: string;
  let appNodeId: string;
  let packageNodeId: string;
  let edgeId: string;
  let linkId: string;

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
        name: `CF Integration Test ${Date.now()}`,
        slug: `cf-int-${Date.now()}`,
        description: 'Temporary project for CodeFlow integration tests',
        ownerTeamId: team.id,
      }),
    });

    if (!projectRes.ok) throw new Error(`create project failed: ${projectRes.status}`);

    const project = await projectRes.json() as TeamOrProject;
    projectId = project.id;
  });


  afterAll(async () => {

    if (projectId && token) {
      await fetch(`${CORE_URL}/projects/${projectId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => undefined);
    }
  });


  it('returns an empty graph before any repository/node is created', async () => {
    const res = await fetch(`${CORE_URL}/projects/${projectId}/codeflow/graph`, {
      headers: authHeaders(token),
    });

    expect(res.status).toBe(200);

    const graph = await res.json() as GraphResponse;
    expect(graph.nodes).toEqual([]);
    expect(graph.edges).toEqual([]);
    expect(graph.snapshotId).toBeNull();
  });


  it('creates a CodeRepository for the project', async () => {
    const res = await fetch(`${CORE_URL}/projects/${projectId}/codeflow/repositories`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        projectId,
        name: 'test-repo',
        provider: 'manual',
      }),
    });

    expect(res.status).toBe(201);

    const repo = await res.json() as Repository;
    expect(repo.id).toBeDefined();
    expect(repo.name).toBe('test-repo');
    repositoryId = repo.id;
  });


  it('creates an app node and a package node', async () => {
    const appRes = await fetch(`${CORE_URL}/projects/${projectId}/codeflow/graph/nodes`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        repositoryId,
        type: 'app',
        name: 'test-app',
        path: 'apps/test-app',
        isManual: true,
      }),
    });

    expect(appRes.status).toBe(201);
    const appNode = await appRes.json() as ArchitectureNode;
    expect(appNode.type).toBe('app');
    expect(appNode.isManual).toBe(true);
    appNodeId = appNode.id;

    const pkgRes = await fetch(`${CORE_URL}/projects/${projectId}/codeflow/graph/nodes`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        repositoryId,
        type: 'package',
        name: 'test-pkg',
        path: 'packages/test-pkg',
        isManual: true,
      }),
    });

    expect(pkgRes.status).toBe(201);
    const pkgNode = await pkgRes.json() as ArchitectureNode;
    packageNodeId = pkgNode.id;
  });


  it('creates a depends_on edge: app -> package', async () => {
    const res = await fetch(`${CORE_URL}/projects/${projectId}/codeflow/graph/edges`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        fromNodeId: appNodeId,
        toNodeId: packageNodeId,
        edgeType: 'depends_on',
        isManual: true,
      }),
    });

    expect(res.status).toBe(201);
    const edge = await res.json() as ArchitectureEdge;
    expect(edge.fromNodeId).toBe(appNodeId);
    expect(edge.toNodeId).toBe(packageNodeId);
    expect(edge.edgeType).toBe('depends_on');
    edgeId = edge.id;
  });


  it('GET /codeflow/graph returns the two nodes and one edge', async () => {
    const res = await fetch(`${CORE_URL}/projects/${projectId}/codeflow/graph`, {
      headers: authHeaders(token),
    });

    expect(res.status).toBe(200);
    const graph = await res.json() as GraphResponse;
    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(1);

    const nodeIds = graph.nodes.map((n) => n.id).sort();
    expect(nodeIds).toEqual([appNodeId, packageNodeId].sort());

    const edge = graph.edges[0];
    expect(edge.fromNodeId).toBe(appNodeId);
    expect(edge.toNodeId).toBe(packageNodeId);
  });


  it('GET a single node returns annotations and links arrays', async () => {
    const res = await fetch(
      `${CORE_URL}/projects/${projectId}/codeflow/graph/nodes/${appNodeId}`,
      { headers: authHeaders(token) },
    );

    expect(res.status).toBe(200);
    const node = await res.json() as NodeDetail;
    expect(node.id).toBe(appNodeId);
    expect(Array.isArray(node.annotations)).toBe(true);
    expect(Array.isArray(node.links)).toBe(true);
  });


  it('creates and lists a link from node to a dummy decision CUID', async () => {
    const fakeDecisionId = 'c'.padEnd(25, 'a');

    const createRes = await fetch(
      `${CORE_URL}/projects/${projectId}/codeflow/graph/nodes/${appNodeId}/links`,
      {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({
          entityType: 'decision',
          entityId: fakeDecisionId,
          linkType: 'implements',
          note: 'test link',
        }),
      },
    );

    expect(createRes.status).toBe(201);
    const link = await createRes.json() as ArchitectureLink;
    expect(link.entityType).toBe('decision');
    expect(link.linkType).toBe('implements');
    linkId = link.id;

    const listRes = await fetch(
      `${CORE_URL}/projects/${projectId}/codeflow/graph/nodes/${appNodeId}/links`,
      { headers: authHeaders(token) },
    );

    expect(listRes.status).toBe(200);
    const links = await listRes.json() as ArchitectureLink[];
    expect(links.length).toBeGreaterThanOrEqual(1);
    expect(links.some((l) => l.id === linkId)).toBe(true);
  });


  it('GET impact(packageNode) classifies the app as a direct dependant', async () => {
    const res = await fetch(
      `${CORE_URL}/projects/${projectId}/codeflow/graph/nodes/${packageNodeId}/impact`,
      { headers: authHeaders(token) },
    );

    expect(res.status).toBe(200);
    const impact = await res.json() as ImpactResponse;
    expect(impact.triggerNode.id).toBe(packageNodeId);
    expect(impact.direct.map((n) => n.id)).toEqual([appNodeId]);
    expect(impact.indirect).toEqual([]);
    expect(impact.remote).toEqual([]);
  });


  it('rejects node creation with invalid type enum', async () => {
    const res = await fetch(`${CORE_URL}/projects/${projectId}/codeflow/graph/nodes`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({
        repositoryId,
        type: 'not-a-valid-type',
        name: 'nope',
        isManual: true,
      }),
    });

    expect(res.status).toBe(400);
  });


  it('deletes the link via DELETE /links/:id', async () => {
    const res = await fetch(
      `${CORE_URL}/projects/${projectId}/codeflow/graph/links/${linkId}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
    );

    expect([200, 204]).toContain(res.status);

    const listRes = await fetch(
      `${CORE_URL}/projects/${projectId}/codeflow/graph/nodes/${appNodeId}/links`,
      { headers: authHeaders(token) },
    );

    const links = await listRes.json() as ArchitectureLink[];
    expect(links.some((l) => l.id === linkId)).toBe(false);
  });


  it('deletes the manual edge via DELETE /edges/:id', async () => {
    const res = await fetch(
      `${CORE_URL}/projects/${projectId}/codeflow/graph/edges/${edgeId}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
    );

    expect([200, 204]).toContain(res.status);

    const graphRes = await fetch(`${CORE_URL}/projects/${projectId}/codeflow/graph`, {
      headers: authHeaders(token),
    });
    const graph = await graphRes.json() as GraphResponse;
    expect(graph.edges).toEqual([]);
  });
});
