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
  expiresAt: string | null;
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


export type ProjectStatusValue = 'draft' | 'active' | 'paused' | 'completed';


export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: ProjectStatusValue;
  ownerTeamId: string;
  ownerUserId: string | null;
  homeUrl?: string | null;
  thumbnailUrl?: string | null;
  thumbnailUpdatedAt?: string | null;
  thumbnailExpiresAt?: string | null;
  thumbnailManualUpload?: boolean;
  archivedForMe?: boolean;
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
  email: string;
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


export async function listTasks(token: string, projectId: string, opts: { take?: number } = {}): Promise<Task[]> {

  const params = new URLSearchParams({ projectId });

  if (opts.take) params.set('take', String(opts.take));

  const res = await fetch(`${CORE_API}/tasks?${params.toString()}`, { headers: authHeaders(token) });

  if (!res.ok) throw new Error('Failed to fetch tasks');

  return res.json() as Promise<Task[]>;
}


export async function countTasks(token: string, projectId: string): Promise<number> {

  const params = new URLSearchParams({ projectId });
  const res = await fetch(`${CORE_API}/tasks/count?${params.toString()}`, { headers: authHeaders(token) });

  if (!res.ok) return 0;

  const json = (await res.json()) as { count: number };
  return json.count;
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


export async function deleteTask(token: string, taskId: string): Promise<void> {

  const res = await fetch(`${CORE_API}/tasks/${taskId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? 'Failed to delete task');
  }
}


export async function listMemory(
  token: string,
  projectId: string,
  q?: string,
  opts: { take?: number } = {},
): Promise<MemoryEntry[]> {

  const params = new URLSearchParams({ projectId });

  if (q) params.set('q', q);
  if (opts.take) params.set('take', String(opts.take));

  const res = await fetch(`${CORE_API}/memory?${params}`, { headers: authHeaders(token) });

  if (!res.ok) throw new Error('Failed to fetch memory');

  return res.json() as Promise<MemoryEntry[]>;
}


export async function countMemory(token: string, projectId: string, q?: string): Promise<number> {

  const params = new URLSearchParams({ projectId });
  if (q) params.set('q', q);

  const res = await fetch(`${CORE_API}/memory/count?${params}`, { headers: authHeaders(token) });

  if (!res.ok) return 0;

  const json = (await res.json()) as { count: number };
  return json.count;
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


export type AuditEvent = ActivityEvent;


export interface AuditPage {
  events: AuditEvent[];
  total: number;
  take: number;
  skip: number;
}


export async function listAuditEvents(
  token: string,
  projectId: string,
  opts: {
    take?: number;
    skip?: number;
    eventType?: string;
    actorUserId?: string;
    targetType?: string;
    actorType?: 'user' | 'mcp_token' | 'system';
    dateFrom?: string;
    dateTo?: string;
  } = {},
): Promise<AuditPage> {

  const params = new URLSearchParams();

  if (opts.take !== undefined) params.set('take', String(opts.take));
  if (opts.skip !== undefined) params.set('skip', String(opts.skip));
  if (opts.eventType) params.set('eventType', opts.eventType);
  if (opts.actorUserId) params.set('actorUserId', opts.actorUserId);
  if (opts.targetType) params.set('targetType', opts.targetType);
  if (opts.actorType) params.set('actorType', opts.actorType);
  if (opts.dateFrom) params.set('dateFrom', opts.dateFrom);
  if (opts.dateTo) params.set('dateTo', opts.dateTo);

  const qs = params.toString();
  const url = `${CORE_API}/projects/${projectId}/audit${qs ? `?${qs}` : ''}`;
  const res = await fetch(url, { headers: authHeaders(token) });

  if (!res.ok) throw new Error('Failed to fetch audit events');

  return res.json() as Promise<AuditPage>;
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
  data: { name?: string; slug?: string; description?: string; ownerTeamId?: string; status?: string; homeUrl?: string },
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


export async function uploadProjectThumbnail(
  token: string,
  projectId: string,
  file: File | Blob,
): Promise<{ thumbnailUrl: string }> {

  const form = new FormData();
  form.append('file', file);

  const res = await fetch(`${CORE_API}/projects/${projectId}/thumbnail`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? 'Failed to upload thumbnail');
  }

  return res.json() as Promise<{ thumbnailUrl: string }>;
}


export async function archiveProjectForMe(token: string, projectId: string): Promise<void> {

  const res = await fetch(`${CORE_API}/projects/${projectId}/archive`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? 'Failed to archive project');
  }
}


export async function unarchiveProjectForMe(token: string, projectId: string): Promise<void> {

  const res = await fetch(`${CORE_API}/projects/${projectId}/archive`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? 'Failed to unarchive project');
  }
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


export type RepositoryProvider = 'github' | 'gitlab' | 'bitbucket' | 'local' | 'manual';


export interface ProjectRepository {
  id: string;
  projectId: string;
  name: string;
  repoUrl: string | null;
  provider: RepositoryProvider;
  defaultBranch: string;
  createdAt: string;
  updatedAt: string;
}


export async function listProjectRepositories(
  token: string,
  projectId: string,
): Promise<ProjectRepository[]> {

  const res = await fetch(`${CORE_API}/projects/${projectId}/repositories`, {
    headers: authHeaders(token),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? 'Failed to list repositories');
  }

  return res.json() as Promise<ProjectRepository[]>;
}


export async function createProjectRepository(
  token: string,
  projectId: string,
  data: { provider: RepositoryProvider; repoUrl: string; name?: string; defaultBranch?: string },
): Promise<ProjectRepository> {

  const res = await fetch(`${CORE_API}/projects/${projectId}/repositories`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? 'Failed to create repository');
  }

  return res.json() as Promise<ProjectRepository>;
}


export async function deleteProjectRepository(
  token: string,
  projectId: string,
  repoId: string,
): Promise<void> {

  const res = await fetch(`${CORE_API}/projects/${projectId}/repositories/${repoId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? 'Failed to delete repository');
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

  if (!res.ok) {
    const err = new Error('Failed to fetch dashboard') as Error & { status: number };
    err.status = res.status;
    throw err;
  }

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


export interface TeamInviteUserRef {
  id: string;
  username: string;
  displayName: string;
}


export interface TeamInvite {
  id: string;
  teamId: string;
  email: string;
  role: string;
  token: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  invitedByUserId: string;
  expiresAt: string;
  acceptedAt?: string | null;
  acceptedByUserId?: string | null;
  revokedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  invitedBy?: TeamInviteUserRef;
  acceptedBy?: TeamInviteUserRef | null;
}


export interface TeamInviteWithTeam extends TeamInvite {
  team: { id: string; name: string; slug: string; description?: string | null };
}


export async function listTeamInvites(token: string, teamId: string): Promise<TeamInvite[]> {

  const res = await fetch(`${AUTH_API}/teams/${teamId}/invites`, { headers: authHeaders(token) });

  if (!res.ok) throw new Error(`Failed to fetch invites: ${res.status}`);

  return res.json() as Promise<TeamInvite[]>;
}


export async function createTeamInvite(
  token: string,
  teamId: string,
  data: { email: string; role?: string; expiresInDays?: number },
): Promise<TeamInvite> {

  const res = await fetch(`${AUTH_API}/teams/${teamId}/invites`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? `Failed to create invite: ${res.status}`);
  }

  return res.json() as Promise<TeamInvite>;
}


export async function revokeTeamInvite(token: string, inviteId: string): Promise<void> {

  const res = await fetch(`${AUTH_API}/invites/${inviteId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });

  if (!res.ok) throw new Error(`Failed to revoke invite: ${res.status}`);
}


export async function getTeamInviteByToken(inviteToken: string): Promise<TeamInviteWithTeam> {

  const res = await fetch(`${AUTH_API}/invites/by-token/${inviteToken}`);

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? `Invite not found`);
  }

  return res.json() as Promise<TeamInviteWithTeam>;
}


export async function acceptTeamInvite(token: string, inviteToken: string): Promise<TeamInvite> {

  const res = await fetch(`${AUTH_API}/invites/by-token/${inviteToken}/accept`, {
    method: 'POST',
    headers: authHeaders(token),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? `Failed to accept invite: ${res.status}`);
  }

  return res.json() as Promise<TeamInvite>;
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


export interface DomainGroup {
  id: string;
  projectId: string;
  name: string;
  color: string | null;
  createdAt: string;
  updatedAt: string;
}


export async function listDomainGroups(token: string, projectId: string): Promise<DomainGroup[]> {

  const res = await fetch(`${CORE_API}/projects/${projectId}/domain-groups`, {
    headers: authHeaders(token),
  });

  if (!res.ok) throw new Error(`Failed to fetch domain groups: ${res.status}`);

  return res.json() as Promise<DomainGroup[]>;
}


export async function createDomainGroup(
  token: string,
  projectId: string,
  data: { name: string; color?: string },
): Promise<DomainGroup> {

  const res = await fetch(`${CORE_API}/projects/${projectId}/domain-groups`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? 'Failed to create domain group');
  }

  return res.json() as Promise<DomainGroup>;
}


export async function updateDomainGroup(
  token: string,
  projectId: string,
  groupId: string,
  data: { name?: string; color?: string },
): Promise<DomainGroup> {

  const res = await fetch(`${CORE_API}/projects/${projectId}/domain-groups/${groupId}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? 'Failed to update domain group');
  }

  return res.json() as Promise<DomainGroup>;
}


export async function deleteDomainGroup(
  token: string,
  projectId: string,
  groupId: string,
): Promise<void> {

  const res = await fetch(`${CORE_API}/projects/${projectId}/domain-groups/${groupId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });

  if (!res.ok) throw new Error(`Failed to delete domain group: ${res.status}`);
}


export type ChatbotProvider = 'openai' | 'anthropic' | 'ollama';


export interface ChatbotConfigView {
  id: string;
  provider: ChatbotProvider;
  modelName: string;
  ollamaBaseUrl: string | null;
  hasApiKey: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}


export interface ChatbotConfigInput {
  provider: ChatbotProvider;
  modelName: string;
  apiKey?: string;
  ollamaBaseUrl?: string;
  isActive?: boolean;
}


export async function getChatbotConfig(token: string): Promise<ChatbotConfigView | null> {

  const res = await fetch(`${CORE_API}/chatbot/config`, { headers: authHeaders(token) });

  if (!res.ok) throw new Error(`Failed to fetch chatbot config: ${res.status}`);

  return res.json() as Promise<ChatbotConfigView | null>;
}


export async function saveChatbotConfig(
  token: string,
  data: ChatbotConfigInput,
): Promise<ChatbotConfigView> {

  const res = await fetch(`${CORE_API}/chatbot/config`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? `Failed to save chatbot config: ${res.status}`);
  }

  return res.json() as Promise<ChatbotConfigView>;
}


export async function deleteChatbotConfig(token: string): Promise<void> {

  const res = await fetch(`${CORE_API}/chatbot/config`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });

  if (!res.ok && res.status !== 204) {
    throw new Error(`Failed to delete chatbot config: ${res.status}`);
  }
}


export async function testChatbotConfig(
  token: string,
): Promise<{ ok: true } | { ok: false; error: string }> {

  const res = await fetch(`${CORE_API}/chatbot/config/test`, {
    method: 'POST',
    headers: authHeaders(token),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    return { ok: false, error: err.message ?? `Test failed: ${res.status}` };
  }

  return res.json() as Promise<{ ok: true } | { ok: false; error: string }>;
}


export async function assignNodeToDomainGroup(
  token: string,
  projectId: string,
  nodeId: string,
  domainGroupId: string | null,
): Promise<ArchitectureNode> {

  const res = await fetch(
    `${CORE_API}/projects/${projectId}/codeflow/graph/nodes/${nodeId}`,
    {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify({ domainGroupId }),
    },
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? 'Failed to assign node to domain group');
  }

  return res.json() as Promise<ArchitectureNode>;
}


export interface ArchitectureSnapshot {
  projectId: string;
  generatedAt: string;
  nodeCount: number;
  edgeCount: number;
  summary: {
    nodesByType: Record<string, number>;
    edgesByType: Record<string, number>;
  };
  topImpactNodes: Array<{
    nodeId: string;
    name: string;
    type: string;
    directDependants: number;
  }>;
  recentAnnotations: Array<{
    nodeId: string;
    nodeName: string;
    content: string;
    createdAt: string;
  }>;
}


export async function getProjectArchitectureSnapshot(
  token: string,
  projectId: string,
): Promise<ArchitectureSnapshot> {

  const res = await fetch(
    `${CORE_API}/projects/${projectId}/codeflow/graph/snapshot/compact`,
    { headers: authHeaders(token) },
  );

  if (!res.ok) {
    const status = res.status;
    throw Object.assign(new Error('Failed to fetch architecture snapshot'), { status });
  }

  return res.json() as Promise<ArchitectureSnapshot>;
}
