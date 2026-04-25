const CORE_API = process.env.CORE_API_URL ?? 'http://localhost:3001';
const AUTH_API = process.env.AUTH_URL ?? 'http://localhost:3002';


export interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  status: string;
  role: string;
  managerId: string | null;
  createdAt: string;
}


export interface McpTokenInfo {
  id: string;
  name: string;
  scopes: string[];
  status: string;
  createdAt: string;
  revokedAt: string | null;
}


export interface McpTokenCreated extends McpTokenInfo {
  token: string;
}


export interface Grant {
  id: string;
  projectId: string;
  subjectType: string;
  subjectId: string;
  grantType: string;
  grantedByUserId: string | null;
  createdAt: string;
}


export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  ownerTeamId: string;
  ownerUserId: string | null;
  createdAt: string;
  updatedAt: string;
}


export interface AuthorRef {
  id: string;
  username: string;
  displayName: string;
}


export interface Phase {
  id: string;
  projectId: string;
  decisionId: string | null;
  title: string;
  description: string | null;
  status: string;
  orderIndex: number;
  startDate: string | null;
  endDate: string | null;
  createdBy: AuthorRef | null;
  updatedBy: AuthorRef | null;
  updatedAt: string;
}


export interface Task {
  id: string;
  projectId: string;
  phaseId: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigneeId: string | null;
  dueDate: string | null;
  completionNotes: string | null;
  completedAt: string | null;
  createdBy: AuthorRef | null;
  updatedBy: AuthorRef | null;
  createdAt: string;
  updatedAt: string;
}


export interface MemoryEntry {
  id: string;
  projectId: string;
  type: string;
  title: string;
  body: string | null;
  createdBy: AuthorRef | null;
  updatedBy: AuthorRef | null;
  createdAt: string;
  updatedAt: string;
}


export interface ActivityEvent {
  id: string;
  projectId: string | null;
  actorType: string;
  actorId: string;
  actorUserId: string | null;
  source: string;
  eventType: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: AuthorRef | null;
}


export interface ActivityPage {
  events: ActivityEvent[];
  total: number;
  take: number;
  skip: number;
}


function authHeaders(token: string): HeadersInit {

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}


export interface SessionInfo {
  sessionId: string;
  userId: string;
  username: string;
  displayName: string;
  role: string;
  managerId: string | null;
  expiresAt: string;
}


export async function validateSession(token: string): Promise<SessionInfo | null> {

  const res = await fetch(`${AUTH_API}/sessions/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  }).catch(() => null);

  if (!res?.ok) return null;

  return res.json() as Promise<SessionInfo>;
}


export async function login(username: string, password: string): Promise<{ token: string; userId: string }> {

  const res = await fetch(`${AUTH_API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    throw new Error('Invalid credentials');
  }

  return res.json() as Promise<{ token: string; userId: string }>;
}


export async function register(data: {
  username: string;
  displayName: string;
  email: string;
  password: string;
  seedDemoProject?: boolean;
  demoLocale?: 'it' | 'en';
}): Promise<{ token: string; userId: string }> {

  const res = await fetch(`${AUTH_API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? 'Registration failed');
  }

  return res.json() as Promise<{ token: string; userId: string }>;
}


export async function logout(token: string): Promise<void> {

  await fetch(`${AUTH_API}/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}


export async function listProjects(token: string): Promise<Project[]> {

  const res = await fetch(`${CORE_API}/projects`, { headers: authHeaders(token) });

  if (!res.ok) throw new Error('Failed to fetch projects');

  return res.json() as Promise<Project[]>;
}


export async function getProject(token: string, id: string): Promise<Project> {

  const res = await fetch(`${CORE_API}/projects/${id}`, { headers: authHeaders(token) });

  if (!res.ok) throw new Error('Failed to fetch project');

  return res.json() as Promise<Project>;
}


export async function listPhases(token: string, projectId: string): Promise<Phase[]> {

  const res = await fetch(`${CORE_API}/phases?projectId=${projectId}`, { headers: authHeaders(token) });

  if (!res.ok) throw new Error('Failed to fetch phases');

  return res.json() as Promise<Phase[]>;
}


export async function listTasks(token: string, projectId: string): Promise<Task[]> {

  const res = await fetch(`${CORE_API}/tasks?projectId=${projectId}`, { headers: authHeaders(token) });

  if (!res.ok) throw new Error('Failed to fetch tasks');

  return res.json() as Promise<Task[]>;
}


export async function updateTaskStatus(token: string, taskId: string, status: string): Promise<Task> {

  const res = await fetch(`${CORE_API}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ status }),
  });

  if (!res.ok) throw new Error('Failed to update task');

  return res.json() as Promise<Task>;
}


export async function listMemory(token: string, projectId: string, q?: string): Promise<MemoryEntry[]> {

  const params = new URLSearchParams({ projectId });

  if (q) {
    params.set('q', q);
  }

  const res = await fetch(`${CORE_API}/memory?${params}`, { headers: authHeaders(token) });

  if (!res.ok) throw new Error('Failed to fetch memory');

  return res.json() as Promise<MemoryEntry[]>;
}


export async function changePassword(
  token: string,
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ success: boolean }> {

  const res = await fetch(`${AUTH_API}/users/${userId}/password`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ currentPassword, newPassword }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? 'Failed to change password');
  }

  return res.json() as Promise<{ success: boolean }>;
}


export async function listUsers(token: string): Promise<User[]> {

  const res = await fetch(`${AUTH_API}/users`, { headers: authHeaders(token) });

  if (!res.ok) throw new Error('Failed to fetch users');

  return res.json() as Promise<User[]>;
}


export async function resetUserPassword(
  token: string,
  userId: string,
  newPassword: string,
): Promise<{ success: boolean }> {

  const res = await fetch(`${AUTH_API}/users/${userId}/password/reset`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ newPassword }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? 'Failed to reset password');
  }

  return res.json() as Promise<{ success: boolean }>;
}


export async function createUser(
  token: string,
  data: { username: string; displayName: string; email: string; password: string; role?: string; managerId?: string },
): Promise<User> {

  const res = await fetch(`${AUTH_API}/users`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? 'Failed to create user');
  }

  return res.json() as Promise<User>;
}


export async function deleteUser(token: string, userId: string): Promise<void> {

  await fetch(`${AUTH_API}/users/${userId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}


export async function listTokens(token: string, userId: string): Promise<McpTokenInfo[]> {

  const res = await fetch(`${AUTH_API}/tokens?userId=${userId}`, { headers: authHeaders(token) });

  if (!res.ok) throw new Error('Failed to fetch tokens');

  return res.json() as Promise<McpTokenInfo[]>;
}


export async function createToken(
  token: string,
  data: { userId: string; name: string; scopes: string[] },
): Promise<McpTokenCreated> {

  const res = await fetch(`${AUTH_API}/tokens`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to create token: ${res.status} ${body}`);
  }

  return res.json() as Promise<McpTokenCreated>;
}


export async function revokeToken(token: string, tokenId: string): Promise<void> {

  await fetch(`${AUTH_API}/tokens/${tokenId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}


export async function listGrants(token: string, projectId?: string): Promise<Grant[]> {

  const url = projectId
    ? `${AUTH_API}/grants?projectId=${projectId}`
    : `${AUTH_API}/grants`;
  const res = await fetch(url, { headers: authHeaders(token) });

  if (!res.ok) throw new Error('Failed to fetch grants');

  return res.json() as Promise<Grant[]>;
}


export async function createGrant(
  token: string,
  data: { projectId: string; subjectType: string; subjectId: string; grantType: string; grantedByUserId: string },
): Promise<Grant> {

  const res = await fetch(`${AUTH_API}/grants`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? 'Failed to create grant');
  }

  return res.json() as Promise<Grant>;
}


export async function deleteGrant(token: string, grantId: string): Promise<void> {

  await fetch(`${AUTH_API}/grants/${grantId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}


export async function createMemoryEntry(
  token: string,
  data: { projectId: string; type: string; title: string; body?: string },
): Promise<MemoryEntry> {

  const res = await fetch(`${CORE_API}/memory`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });

  if (!res.ok) throw new Error('Failed to create memory entry');

  return res.json() as Promise<MemoryEntry>;
}


export interface Decision {
  id: string;
  projectId: string;
  title: string;
  summary: string;
  rationale: string | null;
  outcome: string | null;
  status: string;
  impactLevel: string | null;
  resolvedAt: string | null;
  createdByUserId: string | null;
  createdBy: AuthorRef | null;
  updatedBy: AuthorRef | null;
  createdAt: string;
  updatedAt: string;
}


export async function listActivity(
  token: string,
  projectId: string,
  opts: { take?: number; skip?: number; eventType?: string; actorUserId?: string; targetType?: string } = {},
): Promise<ActivityPage> {

  const params = new URLSearchParams();

  if (opts.take !== undefined) params.set('take', String(opts.take));
  if (opts.skip !== undefined) params.set('skip', String(opts.skip));
  if (opts.eventType) params.set('eventType', opts.eventType);
  if (opts.actorUserId) params.set('actorUserId', opts.actorUserId);
  if (opts.targetType) params.set('targetType', opts.targetType);

  const qs = params.toString();
  const url = `${CORE_API}/projects/${projectId}/activity${qs ? `?${qs}` : ''}`;
  const res = await fetch(url, { headers: authHeaders(token) });

  if (!res.ok) throw new Error('Failed to fetch activity');

  return res.json() as Promise<ActivityPage>;
}


export type ContributorEventType = 'contributor.added' | 'contributor.removed' | 'contributor.left';


export async function recordContributorEvent(
  token: string,
  projectId: string,
  body: {
    eventType: ContributorEventType;
    targetUserId: string;
    targetUsername?: string;
    targetDisplayName?: string;
  },
): Promise<void> {

  const res = await fetch(`${CORE_API}/projects/${projectId}/contributor-events`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`contributor-events failed: ${res.status} ${text}`);
  }
}


export interface DashboardSnapshot {
  projectId: string;
  tasks: Record<string, number>;
  activePhases: Array<{ id: string; title: string; status: string; orderIndex: number }>;
  recentMemory: Array<{ id: string; type: string; title: string; createdAt: string }>;
  recentDecisions: Array<{ id: string; title: string; status: string; impactLevel: string | null; createdAt: string }>;
  urgentTasks: Array<{ id: string; title: string; status: string; priority: string }>;
}


export interface Team {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
}


export interface TeamMembership {
  id: string;
  teamId: string;
  userId: string;
  role: string;
  status: string;
  createdAt: string;
  user?: {
    id: string;
    username: string;
    displayName: string;
    email: string;
  };
}


export async function createProject(
  token: string,
  data: { name: string; slug: string; description?: string; ownerTeamId: string; status?: string },
): Promise<Project> {

  const res = await fetch(`${CORE_API}/projects`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? 'Failed to create project');
  }

  return res.json() as Promise<Project>;
}


export async function updateProject(
  token: string,
  projectId: string,
  data: { name?: string; slug?: string; description?: string; ownerTeamId?: string; status?: string },
): Promise<Project> {

  const res = await fetch(`${CORE_API}/projects/${projectId}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? 'Failed to update project');
  }

  return res.json() as Promise<Project>;
}


export async function deleteProject(token: string, projectId: string): Promise<void> {

  const res = await fetch(`${CORE_API}/projects/${projectId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? 'Failed to delete project');
  }
}


export async function createTask(
  token: string,
  data: { projectId: string; phaseId: string; title: string; description?: string; priority?: string; status?: string },
): Promise<Task> {

  const res = await fetch(`${CORE_API}/tasks`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? 'Failed to create task');
  }

  return res.json() as Promise<Task>;
}


export async function createPhase(
  token: string,
  data: { projectId: string; title: string; description?: string; orderIndex?: number; status?: string },
): Promise<Phase> {

  const res = await fetch(`${CORE_API}/phases`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? 'Failed to create phase');
  }

  return res.json() as Promise<Phase>;
}


export async function listDecisions(token: string, projectId: string): Promise<Decision[]> {

  const res = await fetch(`${CORE_API}/decisions?projectId=${projectId}`, { headers: authHeaders(token) });

  if (!res.ok) throw new Error('Failed to fetch decisions');

  return res.json() as Promise<Decision[]>;
}


export async function createDecision(
  token: string,
  data: { projectId: string; title: string; summary: string; rationale?: string; outcome?: string; status?: string; impactLevel?: string },
): Promise<Decision> {

  const res = await fetch(`${CORE_API}/decisions`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? 'Failed to create decision');
  }

  return res.json() as Promise<Decision>;
}


export async function getDashboardSnapshot(token: string, projectId: string): Promise<DashboardSnapshot> {

  const res = await fetch(`${CORE_API}/projects/${projectId}/dashboard`, { headers: authHeaders(token) });

  if (!res.ok) throw new Error('Failed to fetch dashboard');

  return res.json() as Promise<DashboardSnapshot>;
}


export async function listTeams(token: string): Promise<Team[]> {

  const res = await fetch(`${AUTH_API}/teams`, { headers: authHeaders(token) });

  if (!res.ok) throw new Error('Failed to fetch teams');

  return res.json() as Promise<Team[]>;
}


export async function getTeam(token: string, idOrSlug: string): Promise<Team> {

  const res = await fetch(`${AUTH_API}/teams/${idOrSlug}`, { headers: authHeaders(token) });

  if (!res.ok) throw new Error(`Failed to fetch team: ${res.status}`);

  return res.json() as Promise<Team>;
}


export async function createTeam(
  token: string,
  data: { name: string; slug: string; description?: string },
): Promise<Team> {

  const res = await fetch(`${AUTH_API}/teams`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to create team: ${res.status} ${body}`);
  }

  return res.json() as Promise<Team>;
}


export async function deleteTeam(token: string, idOrSlug: string): Promise<void> {

  const res = await fetch(`${AUTH_API}/teams/${idOrSlug}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });

  if (!res.ok) throw new Error(`Failed to delete team: ${res.status}`);
}


export async function listMemberships(token: string, teamId: string): Promise<TeamMembership[]> {

  const res = await fetch(`${AUTH_API}/memberships?teamId=${teamId}`, { headers: authHeaders(token) });

  if (!res.ok) throw new Error('Failed to fetch memberships');

  return res.json() as Promise<TeamMembership[]>;
}


export async function listMyMemberships(
  token: string,
  userId: string,
): Promise<(TeamMembership & { team: Team })[]> {

  const res = await fetch(`${AUTH_API}/memberships?userId=${userId}`, { headers: authHeaders(token) });

  if (!res.ok) throw new Error('Failed to fetch memberships');

  return res.json() as Promise<(TeamMembership & { team: Team })[]>;
}


export async function createMembership(
  token: string,
  data: { teamId: string; userId: string; role?: string },
): Promise<TeamMembership> {

  const res = await fetch(`${AUTH_API}/memberships`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to create membership: ${res.status} ${body}`);
  }

  return res.json() as Promise<TeamMembership>;
}


export async function deleteMembership(token: string, id: string): Promise<void> {

  const res = await fetch(`${AUTH_API}/memberships/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });

  if (!res.ok) throw new Error(`Failed to delete membership: ${res.status}`);
}


export interface ArchitectureNode {
  id: string;
  type: string;
  name: string;
  path: string | null;
  domainGroup: string | null;
  isManual: boolean;
  ownerUserId: string | null;
  ownerTeamId: string | null;
  openTaskCount: number;
  decisionCount: number;
  annotationCount: number;
  metadata: Record<string, unknown> | null;
}


export interface ArchitectureEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  edgeType: string;
  weight: number;
  isManual: boolean;
}


export interface ArchitectureGraph {
  snapshotId: string | null;
  snapshotStatus: string | null;
  lastScannedAt: string | null;
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
}


export async function getArchitectureGraph(
  token: string,
  projectId: string,
): Promise<ArchitectureGraph> {

  const res = await fetch(`${CORE_API}/projects/${projectId}/codeflow/graph`, {
    headers: authHeaders(token),
  });

  if (!res.ok) throw new Error('Failed to fetch architecture graph');

  return res.json() as Promise<ArchitectureGraph>;
}


export interface ArchitectureAnnotation {
  id: string;
  nodeId: string;
  content: string;
  createdByUserId: string | null;
  createdAt: string;
}


export interface ArchitectureLink {
  id: string;
  nodeId: string;
  projectId: string;
  entityType: string;
  entityId: string;
  linkType: string;
  note: string | null;
  createdByUserId: string | null;
  createdAt: string;
}


export interface ArchitectureNodeDetail extends ArchitectureNode {
  description: string | null;
  repositoryId: string | null;
  annotations: ArchitectureAnnotation[];
  links: ArchitectureLink[];
}


export async function getArchitectureNode(
  token: string,
  projectId: string,
  nodeId: string,
): Promise<ArchitectureNodeDetail> {

  const res = await fetch(
    `${CORE_API}/projects/${projectId}/codeflow/graph/nodes/${nodeId}`,
    { headers: authHeaders(token) },
  );

  if (!res.ok) throw new Error(`Failed to fetch node: ${res.status}`);

  return res.json() as Promise<ArchitectureNodeDetail>;
}


export async function createArchitectureLink(
  token: string,
  projectId: string,
  nodeId: string,
  data: { entityType: string; entityId: string; linkType: string; note?: string },
): Promise<ArchitectureLink> {

  const res = await fetch(
    `${CORE_API}/projects/${projectId}/codeflow/graph/nodes/${nodeId}/links`,
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    },
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? 'Failed to create link');
  }

  return res.json() as Promise<ArchitectureLink>;
}


export async function deleteArchitectureLink(
  token: string,
  projectId: string,
  linkId: string,
): Promise<void> {

  const res = await fetch(
    `${CORE_API}/projects/${projectId}/codeflow/graph/links/${linkId}`,
    {
      method: 'DELETE',
      headers: authHeaders(token),
    },
  );

  if (!res.ok) throw new Error(`Failed to delete link: ${res.status}`);
}
