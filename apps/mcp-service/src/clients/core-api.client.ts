import { optionalEnv } from "@roadboard/config";


const CORE_API_PORT = optionalEnv("CORE_API_PORT", "4001");
const BASE_URL = `http://localhost:${CORE_API_PORT}`;


export class CoreApiClient {

  private readonly token: string;


  constructor(token: string) {

    this.token = token;
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


  private headers(): Record<string, string> {

    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.token}`,
    };
  }
}
