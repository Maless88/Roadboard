import { optionalEnv } from "@roadboard/config";


const CORE_API_HOST = optionalEnv("CORE_API_HOST", "localhost");
const CORE_API_PORT = optionalEnv("CORE_API_PORT", "4001");
const BASE_URL = `http://${CORE_API_HOST}:${CORE_API_PORT}`;


export class CoreApiClient {

  private readonly token: string;


  constructor(token: string) {

    this.token = token;
  }


  async createProject(data: {
    name: string;
    slug: string;
    ownerTeamId: string;
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


  async listTasks(projectId: string, status?: string): Promise<unknown[]> {

    const params = new URLSearchParams({ projectId });

    if (status) {
      params.set("status", status);
    }

    const res = await fetch(`${BASE_URL}/tasks?${params.toString()}`, {
      headers: this.headers(),
    });

    if (!res.ok) {
      throw new Error(`core-api listTasks failed: ${res.status}`);
    }

    return res.json() as Promise<unknown[]>;
  }


  async createTask(data: {
    projectId: string;
    title: string;
    priority?: string;
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


  async updateTaskStatus(taskId: string, status: string): Promise<unknown> {

    const res = await fetch(`${BASE_URL}/tasks/${taskId}`, {
      method: "PATCH",
      headers: this.headers(),
      body: JSON.stringify({ status }),
    });

    if (!res.ok) {
      throw new Error(`core-api updateTaskStatus failed: ${res.status}`);
    }

    return res.json() as Promise<unknown>;
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
      throw new Error(`core-api createMemoryEntry failed: ${res.status}`);
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


  private headers(): Record<string, string> {

    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.token}`,
    };
  }
}
