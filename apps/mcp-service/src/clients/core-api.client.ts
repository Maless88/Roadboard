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

    const raw = await res.json() as unknown;

    return this.enrichTasksWithAssignee(raw);
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


  async getArchitectureSnapshot(projectId: string): Promise<unknown> {

    const res = await fetch(
      `${BASE_URL}/projects/${projectId}/codeflow/graph/snapshot/compact`,
      { headers: this.headers() },
    );

    if (!res.ok) {
      throw new Error(`core-api getArchitectureSnapshot failed: ${res.status}`);
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


  private async enrichTasksWithAssignee(raw: unknown): Promise<unknown> {

    // Handles both flat array and paginated { items, nextCursor } shapes
    const isPaginated =
      raw !== null &&
      typeof raw === "object" &&
      !Array.isArray(raw) &&
      "items" in (raw as object);

    const tasks: Array<Record<string, unknown>> = isPaginated
      ? ((raw as { items: Array<Record<string, unknown>> }).items)
      : (raw as Array<Record<string, unknown>>);

    if (!Array.isArray(tasks) || tasks.length === 0) {
      return raw;
    }

    // Collect unique non-null assigneeIds
    const ids = [...new Set(tasks.map((t) => t.assigneeId).filter((id): id is string => typeof id === "string" && id.length > 0))];

    if (ids.length === 0) {
      // Add assignee: null for all tasks
      const enriched = tasks.map((t) => ({ ...t, assignee: null }));
      return isPaginated ? { ...(raw as object), items: enriched } : enriched;
    }

    // Batch resolve (one request per unique assigneeId — typically ≤ 5)
    const userMap = new Map<string, { id: string; username: string; displayName: string; email: string } | null>();
    await Promise.all(
      ids.map(async (id) => {
        const user = await this.getUser(id).catch(() => null);
        userMap.set(id, user);
      }),
    );

    const enriched = tasks.map((t) => ({
      ...t,
      assignee: typeof t.assigneeId === "string" ? (userMap.get(t.assigneeId) ?? null) : null,
    }));

    return isPaginated ? { ...(raw as object), items: enriched } : enriched;
  }


  async getUser(userId: string): Promise<{ id: string; username: string; displayName: string; email: string } | null> {

    const res = await fetch(`${AUTH_URL}/users/${encodeURIComponent(userId)}`, {
      headers: this.headers(),
    });

    if (res.status === 404) {
      return null;
    }

    if (!res.ok) {
      throw new Error(`auth-access getUser failed: ${res.status}`);
    }

    const data = (await res.json()) as Record<string, unknown>;
    return {
      id: data.id as string,
      username: data.username as string,
      displayName: (data.displayName ?? data.username) as string,
      email: data.email as string,
    };
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


  async listSkills(slug?: string): Promise<unknown> {
    const url = slug
      ? `${BASE_URL}/agents/skills/agent/${encodeURIComponent(slug)}`
      : `${BASE_URL}/agents/skills/catalog`;
    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok) throw new Error(`core-api listSkills failed: ${res.status}`);
    return res.json() as Promise<unknown>;
  }

  async attachSkill(slug: string, name: string): Promise<unknown> {
    const res = await fetch(`${BASE_URL}/agents/skills/agent/${encodeURIComponent(slug)}/attach`, {
      method: "POST", headers: this.headers(), body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error(`core-api attachSkill failed: ${res.status}`);
    return res.json() as Promise<unknown>;
  }

  async detachSkill(slug: string, name: string): Promise<unknown> {
    const res = await fetch(`${BASE_URL}/agents/skills/agent/${encodeURIComponent(slug)}/detach`, {
      method: "POST", headers: this.headers(), body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error(`core-api detachSkill failed: ${res.status}`);
    return res.json() as Promise<unknown>;
  }

  async syncSkillsCatalog(skills: { name: string; description?: string }[]): Promise<unknown> {
    const res = await fetch(`${BASE_URL}/agents/skills/sync`, {
      method: "POST", headers: this.headers(), body: JSON.stringify({ skills }),
    });
    if (!res.ok) throw new Error(`core-api syncSkillsCatalog failed: ${res.status}`);
    return res.json() as Promise<unknown>;
  }


  async createScheduledActivity(data: {
    title: string; agentSlug: string; promptTemplate: string;
    kind: "cron" | "once" | "interval";
    cronExpr?: string; everyMs?: number; runAt?: string; tz?: string;
    projectId?: string; deliveryRoomId?: string; notify?: boolean; expiresAt?: string;
  }): Promise<unknown> {
    const res = await fetch(`${BASE_URL}/scheduling`, {
      method: "POST", headers: this.headers(), body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`core-api createScheduledActivity failed: ${res.status} ${await res.text()}`);
    return res.json() as Promise<unknown>;
  }

  async listScheduledActivities(projectId?: string): Promise<unknown> {
    const url = projectId ? `${BASE_URL}/scheduling?projectId=${encodeURIComponent(projectId)}` : `${BASE_URL}/scheduling`;
    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok) throw new Error(`core-api listScheduledActivities failed: ${res.status}`);
    return res.json() as Promise<unknown>;
  }

  async pauseScheduledActivity(id: string): Promise<unknown> {
    // no body → omit Content-Type so the JSON body parser doesn't 400 on empty input
    const res = await fetch(`${BASE_URL}/scheduling/${encodeURIComponent(id)}/pause`, { method: "POST", headers: { Authorization: `Bearer ${this.token}` } });
    if (!res.ok) throw new Error(`core-api pauseScheduledActivity failed: ${res.status}`);
    return res.json() as Promise<unknown>;
  }

  async deleteScheduledActivity(id: string): Promise<unknown> {
    const res = await fetch(`${BASE_URL}/scheduling/${encodeURIComponent(id)}`, { method: "DELETE", headers: { Authorization: `Bearer ${this.token}` } });
    if (!res.ok) throw new Error(`core-api deleteScheduledActivity failed: ${res.status}`);
    return res.json() as Promise<unknown>;
  }


  private headers(): Record<string, string> {

    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.token}`,
    };
  }
}
