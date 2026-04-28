import { optionalEnv } from "@roadboard/config";


const CORE_API_HOST = optionalEnv("CORE_API_HOST", "localhost");
const CORE_API_PORT = optionalEnv("CORE_API_PORT", "4001");
const BASE_URL = `http://${CORE_API_HOST}:${CORE_API_PORT}`;

const AUTH_ACCESS_HOST = optionalEnv("AUTH_ACCESS_HOST", "localhost");
const AUTH_ACCESS_PORT = optionalEnv("AUTH_ACCESS_PORT", "4002");
const AUTH_URL = `http://${AUTH_ACCESS_HOST}:${AUTH_ACCESS_PORT}`;


export class CoreApiClient {

  private readonly token: string;


  constructor(token: string) {

    this.token = token;
  }


  async createProject(data: {
    name: string;
    slug: string;
    ownerTeamId?: string;
    ownerTeamSlug?: string;
    description?: string;
    status?: string;
  }): Promise<unknown> {

    const res = await fetch(`${BASE_URL}/projects`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      throw new Error(`core-api createProject failed: ${res.status}`);
    }

    return res.json() as Promise<unknown>;
  }


  async listProjects(status?: string): Promise<unknown[]> {

    const params = new URLSearchParams();

    if (status) {
      params.set("status", status);
    }

    const query = params.toString();
    const url = `${BASE_URL}/projects${query ? `?${query}` : ""}`;
    const res = await fetch(url, { headers: this.headers() });

    if (!res.ok) {
      throw new Error(`core-api listProjects failed: ${res.status}`);
    }

    return res.json() as Promise<unknown[]>;
  }


  async getProject(projectId: string): Promise<unknown> {

    const res = await fetch(`${BASE_URL}/projects/${projectId}`, {
      headers: this.headers(),
    });

    if (!res.ok) {
      throw new Error(`core-api getProject failed: ${res.status}`);
    }

    return res.json() as Promise<unknown>;
  }


  async listTasks(
    projectId: string,
    options: {
      status?: string;
      limit?: number;
      cursor?: string;
      compact?: boolean;
      fields?: string[];
    } = {},
  ): Promise<unknown> {

    const params = new URLSearchParams({ projectId });

    if (options.status) params.set("status", options.status);
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.cursor) params.set("cursor", options.cursor);
    if (options.compact) params.set("compact", "true");
    if (options.fields && options.fields.length > 0) {
      params.set("fields", options.fields.join(","));
    }

    const res = await fetch(`${BASE_URL}/tasks?${params.toString()}`, {
      headers: this.headers(),
    });

    if (!res.ok) {
      throw new Error(`core-api listTasks failed: ${res.status}`);
    }

    return res.json() as Promise<unknown>;
  }


  async listPhases(projectId: string): Promise<unknown[]> {

    const params = new URLSearchParams({ projectId });
    const res = await fetch(`${BASE_URL}/phases?${params.toString()}`, {
      headers: this.headers(),
    });

    if (!res.ok) {
      throw new Error(`core-api listPhases failed: ${res.status}`);
    }

    return res.json() as Promise<unknown[]>;
  }


  async createPhase(data: {
    projectId: string;
    title: string;
    description?: string;
    decisionId?: string;
    orderIndex?: number;
    status?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<unknown> {

    const res = await fetch(`${BASE_URL}/phases`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      throw new Error(`core-api createPhase failed: ${res.status}`);
    }

    return res.json() as Promise<unknown>;
  }


  async updatePhase(phaseId: string, data: {
    title?: string;
    description?: string;
    decisionId?: string;
    orderIndex?: number;
    status?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<unknown> {

    const res = await fetch(`${BASE_URL}/phases/${phaseId}`, {
      method: "PATCH",
      headers: this.headers(),
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      throw new Error(`core-api updatePhase failed: ${res.status}`);
    }

    return res.json() as Promise<unknown>;
  }


  async createTask(data: {
    projectId: string;
    phaseId: string;
    title: string;
    description?: string;
    priority?: string;
    assigneeId?: string;
    dueDate?: string;
  }): Promise<unknown> {

    const res = await fetch(`${BASE_URL}/tasks`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      throw new Error(`core-api createTask failed: ${res.status}`);
    }

    return res.json() as Promise<unknown>;
  }


  async updateTaskStatus(
    taskId: string,
    status: string,
    completionNotes?: string,
  ): Promise<unknown> {

    const body: Record<string, unknown> = { status };

    if (completionNotes !== undefined) {
      body.completionNotes = completionNotes;
    }

    const res = await fetch(`${BASE_URL}/tasks/${taskId}`, {
      method: "PATCH",
      headers: this.headers(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`core-api updateTaskStatus failed: ${res.status}`);
    }

    return res.json() as Promise<unknown>;
  }


  async updateTask(taskId: string, data: {
    title?: string;
    description?: string;
    phaseId?: string;
    priority?: string;
    assigneeId?: string;
    dueDate?: string;
  }): Promise<unknown> {

    const res = await fetch(`${BASE_URL}/tasks/${taskId}`, {
      method: "PATCH",
      headers: this.headers(),
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      throw new Error(`core-api updateTask failed: ${res.status}`);
    }

    return res.json() as Promise<unknown>;
  }


  async deleteTask(taskId: string): Promise<{ ok: true; taskId: string }> {

    const res = await fetch(`${BASE_URL}/tasks/${taskId}`, {
      method: "DELETE",
      headers: this.headers(),
    });

    if (!res.ok) {
      throw new Error(`core-api deleteTask failed: ${res.status}`);
    }

    return { ok: true, taskId };
  }


  async listMemory(projectId: string, type?: string): Promise<unknown[]> {

    const params = new URLSearchParams({ projectId });

    if (type) {
      params.set("type", type);
    }

    const res = await fetch(`${BASE_URL}/memory?${params.toString()}`, {
      headers: this.headers(),
    });

    if (!res.ok) {
      throw new Error(`core-api listMemory failed: ${res.status}`);
    }

    return res.json() as Promise<unknown[]>;
  }


  async createMemoryEntry(data: {
    projectId: string;
    type: string;
    title: string;
    body?: string;
  }): Promise<unknown> {

    const res = await fetch(`${BASE_URL}/memory`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`core-api createMemoryEntry failed: ${res.status} ${errBody}`);
    }

    return res.json() as Promise<unknown>;
  }


  async listDecisions(projectId: string, status?: string): Promise<unknown[]> {

    const params = new URLSearchParams({ projectId });

    if (status) {
      params.set("status", status);
    }

    const res = await fetch(`${BASE_URL}/decisions?${params.toString()}`, {
      headers: this.headers(),
    });

    if (!res.ok) {
      throw new Error(`core-api listDecisions failed: ${res.status}`);
    }

    return res.json() as Promise<unknown[]>;
  }


  async createDecision(data: {
    projectId: string;
    title: string;
    summary: string;
    rationale?: string;
    impactLevel?: string;
  }): Promise<unknown> {

    const res = await fetch(`${BASE_URL}/decisions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      throw new Error(`core-api createDecision failed: ${res.status}`);
    }

    return res.json() as Promise<unknown>;
  }


  async updateDecision(decisionId: string, data: {
    title?: string;
    summary?: string;
    rationale?: string;
    outcome?: string;
    status?: string;
    impactLevel?: string;
    resolvedAt?: string;
  }): Promise<unknown> {

    const res = await fetch(`${BASE_URL}/decisions/${decisionId}`, {
      method: "PATCH",
      headers: this.headers(),
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      throw new Error(`core-api updateDecision failed: ${res.status}`);
    }

    return res.json() as Promise<unknown>;
  }


  async getDashboard(projectId: string): Promise<unknown> {

    const res = await fetch(`${BASE_URL}/projects/${projectId}/dashboard`, {
      headers: this.headers(),
    });

    if (!res.ok) {
      throw new Error(`core-api getDashboard failed: ${res.status}`);
    }

    return res.json() as Promise<unknown>;
  }


  async getAuditEvents(projectId: string, take = 20): Promise<unknown> {

    const params = new URLSearchParams({ take: String(take) });
    const res = await fetch(`${BASE_URL}/projects/${projectId}/audit?${params}`, {
      headers: this.headers(),
    });

    if (!res.ok) {
      throw new Error(`core-api getAuditEvents failed: ${res.status}`);
    }

    return res.json() as Promise<unknown>;
  }


  async searchMemory(projectId: string, q: string): Promise<unknown[]> {

    const params = new URLSearchParams({ projectId, q });
    const res = await fetch(`${BASE_URL}/memory?${params.toString()}`, {
      headers: this.headers(),
    });

    if (!res.ok) {
      throw new Error(`core-api searchMemory failed: ${res.status}`);
    }

    return res.json() as Promise<unknown[]>;
  }


  async getArchitectureMap(projectId: string): Promise<unknown> {

    const res = await fetch(`${BASE_URL}/projects/${projectId}/codeflow/graph`, {
      headers: this.headers(),
    });

    if (!res.ok) {
      throw new Error(`core-api getArchitectureMap failed: ${res.status}`);
    }

    return res.json();
  }


  async getNodeContext(projectId: string, nodeId: string): Promise<unknown> {

    const [nodeRes, impactRes] = await Promise.all([
      fetch(`${BASE_URL}/projects/${projectId}/codeflow/graph/nodes/${nodeId}`, {
        headers: this.headers(),
      }),
      fetch(`${BASE_URL}/projects/${projectId}/codeflow/graph/nodes/${nodeId}/impact`, {
        headers: this.headers(),
      }),
    ]);

    if (!nodeRes.ok) {
      throw new Error(`core-api getNodeContext failed: ${nodeRes.status}`);
    }

    const node = await nodeRes.json();
    const impact = impactRes.ok ? await impactRes.json() : null;

    return { node, impact };
  }


  async listEntityArchitectureLinks(projectId: string, entityType: string, entityId: string): Promise<unknown> {

    const params = new URLSearchParams({ entityType, entityId });
    const res = await fetch(`${BASE_URL}/projects/${projectId}/codeflow/graph/entity-links?${params}`, {
      headers: this.headers(),
    });

    if (!res.ok) {
      throw new Error(`core-api listEntityArchitectureLinks failed: ${res.status}`);
    }

    return res.json();
  }


  async resetArchitecture(projectId: string): Promise<unknown> {

    const res = await fetch(`${BASE_URL}/projects/${projectId}/codeflow/graph/reset`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${this.token}` },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`core-api resetArchitecture failed: ${res.status} ${body}`);
    }

    return res.json();
  }


  async createArchitectureRepository(projectId: string, data: {
    name: string;
    repoUrl?: string;
    provider?: string;
    defaultBranch?: string;
  }): Promise<unknown> {

    const res = await fetch(`${BASE_URL}/projects/${projectId}/codeflow/repositories`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ projectId, ...data }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`core-api createArchitectureRepository failed: ${res.status} ${body}`);
    }

    return res.json();
  }


  async createArchitectureNode(projectId: string, data: {
    repositoryId: string;
    type: string;
    name: string;
    path?: string;
    description?: string;
    domainGroup?: string;
  }): Promise<unknown> {

    const res = await fetch(`${BASE_URL}/projects/${projectId}/codeflow/graph/nodes`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ ...data, isManual: true }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`core-api createArchitectureNode failed: ${res.status} ${body}`);
    }

    return res.json();
  }


  async createArchitectureEdge(projectId: string, data: {
    fromNodeId: string;
    toNodeId: string;
    edgeType: string;
    weight?: number;
  }): Promise<unknown> {

    const res = await fetch(`${BASE_URL}/projects/${projectId}/codeflow/graph/edges`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ ...data, isManual: true }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`core-api createArchitectureEdge failed: ${res.status} ${body}`);
    }

    return res.json();
  }


  async createArchitectureLink(projectId: string, nodeId: string, data: {
    entityType: string;
    entityId: string;
    linkType: string;
    note?: string;
  }): Promise<unknown> {

    const res = await fetch(`${BASE_URL}/projects/${projectId}/codeflow/graph/nodes/${nodeId}/links`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`core-api createArchitectureLink failed: ${res.status} ${body}`);
    }

    return res.json();
  }


  async createArchitectureAnnotation(projectId: string, nodeId: string, content: string): Promise<unknown> {

    const res = await fetch(`${BASE_URL}/projects/${projectId}/codeflow/graph/nodes/${nodeId}/annotations`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ content }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`core-api createArchitectureAnnotation failed: ${res.status} ${body}`);
    }

    return res.json();
  }


  async listMyTeams(userId: string): Promise<unknown[]> {

    const res = await fetch(`${AUTH_URL}/memberships?userId=${encodeURIComponent(userId)}`, {
      headers: this.headers(),
    });

    if (!res.ok) {
      throw new Error(`auth-access listMyTeams failed: ${res.status}`);
    }

    const memberships = (await res.json()) as Array<{
      role: string;
      team: { id: string; name: string; slug: string; description: string | null };
    }>;

    return memberships.map((m) => ({ ...m.team, role: m.role }));
  }


  private headers(): Record<string, string> {

    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.token}`,
    };
  }
}
