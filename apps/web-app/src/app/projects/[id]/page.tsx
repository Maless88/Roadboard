import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getToken } from '@/lib/auth';
import { getDict } from '@/lib/i18n';
import {
  getProject,
  listProjects,
  listTasks,
  countTasks,
  listMemory,
  countMemory,
  listPhases,
  listDecisions,
  listUsers,
  listGrants,
  listMyMemberships,
  getDashboardSnapshot,
  validateSession,
  listProjectRepositories,
} from '@/lib/api';
import type { Dictionary } from '@/lib/i18n';
import { AppShell } from '@/components/app-shell';
import { AutoRefresh } from '@/components/auto-refresh';
import { ProgressRing } from '@/components/progress-ring';
import { TabNav } from './tab-nav';
import { TaskStatusSelect } from './task-status';
import { CreateTaskForm } from './create-task-form';
import { CreatePhaseForm } from './create-phase-form';
import { CreateDecisionForm } from './create-decision-form';
import { CreateMemoryForm } from './create-memory-form';
import { MemorySearch } from './memory-search';
import { DeleteProjectButton } from './delete-project-button';
import { EditThumbnailForm } from './edit-thumbnail-form';
import { PhaseAccordion } from './phase-accordion';
import { DecisionAccordion } from './decision-accordion';
import { TaskRow } from './task-row';
import { ActivityTimeline } from './activity-timeline';
import { AttributionLine } from './attribution-line';
import { Markdown } from '@/components/markdown';
import { ContributorsTab } from './contributors-tab';
import { CodeflowSubNav } from './codeflow/sub-nav';
import { ArchitectureMapView } from './codeflow/architecture-map-view';
import { ChangeImpactView, DecisionGraphView } from './codeflow/placeholder-views';
import { AgentContextView } from './codeflow/agent-context-view';
import type { Task, Phase } from '@/lib/api';


const STATUS_COLOR: Record<string, string> = {
  active: 'bg-green-500/10 text-green-400',
  draft: 'bg-gray-500/10 text-gray-400',
  paused: 'bg-yellow-500/10 text-yellow-400',
  completed: 'bg-blue-500/10 text-blue-400',
  in_progress: 'bg-indigo-500/10 text-indigo-400',
  archived: 'bg-gray-500/[0.07] text-gray-500',
};

const TASK_PRIORITY_COLOR: Record<string, string> = {
  critical: 'text-red-400',
  high: 'text-orange-400',
  medium: 'text-yellow-400',
  low: 'text-gray-400',
};

const TASK_STATUS_COLOR: Record<string, string> = {
  todo: 'bg-gray-500/10 text-gray-400',
  in_progress: 'bg-indigo-500/10 text-indigo-400',
  done: 'bg-green-500/10 text-green-400',
  blocked: 'bg-red-500/10 text-red-400',
};

const MEMORY_TYPE_COLOR: Record<string, string> = {
  done: 'bg-green-500/10 text-green-400',
  next: 'bg-indigo-500/10 text-indigo-400',
  decision: 'bg-yellow-500/10 text-yellow-400',
  handoff: 'bg-purple-500/10 text-purple-400',
  architecture: 'bg-blue-500/10 text-blue-400',
  issue: 'bg-red-500/10 text-red-400',
  learning: 'bg-teal-500/10 text-teal-400',
  operational_note: 'bg-gray-500/10 text-gray-400',
  open_question: 'bg-orange-500/10 text-orange-400',
};

const DECISION_IMPACT_COLOR: Record<string, string> = {
  high: 'text-red-400',
  medium: 'text-yellow-400',
  low: 'text-gray-400',
};


function RepositoryProviderIcon({ provider }: { provider: string }) {

  if (provider === 'github') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
      </svg>
    );
  }

  if (provider === 'gitlab') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51a.42.42 0 0 1 .11-.18.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z" />
      </svg>
    );
  }

  if (provider === 'bitbucket') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M.778 1.213a.768.768 0 0 0-.768.892l3.263 19.81c.084.5.515.868 1.022.873H19.95a.772.772 0 0 0 .77-.646l3.27-20.03a.768.768 0 0 0-.768-.891zM14.52 15.53H9.522L8.17 8.466h7.677z" />
      </svg>
    );
  }

  // generic icon for local / manual / unknown
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}


interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    tab?: string;
    q?: string;
    cf?: string;
    eventType?: string;
    actorType?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: string;
  }>;
}


export default async function ProjectDetailPage({ params, searchParams }: Props) {

  const { id } = await params;
  const sp = await searchParams;
  const { tab = 'tasks', q, cf = 'map' } = sp;
  const token = await getToken();

  if (!token) {
    redirect('/login');
  }

  let project;

  try {
    project = await getProject(token, id);
  } catch {
    notFound();
  }

  const [session, snap, userProjects, dict, repositories] = await Promise.all([
    validateSession(token),
    getDashboardSnapshot(token, id).catch(() => null),
    listProjects(token).catch(() => []),
    getDict(),
    listProjectRepositories(token, id).catch(() => []),
  ]);

  if (!session) redirect('/login');

  const taskDone = snap?.tasks['done'] ?? 0;
  const taskTotal = snap ? Object.values(snap.tasks).reduce((a, b) => a + b, 0) : 0;

  const activeTask = snap?.urgentTasks.find((t) => t.status === 'in_progress');

  return (
    <AppShell
      username={session.username}
      displayName={session.displayName}
      activeProject={{ id, name: project.name, taskDone, taskTotal }}
      userProjects={[...userProjects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((p) => ({ id: p.id, name: p.name, status: p.status }))}
    >
      <AutoRefresh />
      {/* Project header with glass health bar */}
      <div
        className="px-8 py-5"
        style={{
          background: 'var(--surface-strong)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border-soft)',
        }}
      >
        <div className="max-w-5xl mx-auto">
          <div className="flex items-start gap-6">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <Link href="/projects" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
                  {dict.project.backLink}
                </Link>
                <DeleteProjectButton projectId={id} projectName={project.name} />
              </div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-lg font-semibold text-white">{project.name}</h1>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_COLOR[project.status] ?? 'bg-gray-700 text-gray-300'}`}>
                  {project.status}
                </span>
              </div>
              {project.description && (
                <p className="text-xs text-gray-500 mb-2">{project.description}</p>
              )}

              {repositories.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {repositories.map((repo) => (
                    <a
                      key={repo.id}
                      href={repo.repoUrl ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={repo.name}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      <RepositoryProviderIcon provider={repo.provider} />
                    </a>
                  ))}
                </div>
              )}

              {taskTotal > 0 && (
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-gray-600">{dict.project.progress}</span>
                    <span className="text-gray-500 font-mono">{taskDone} / {taskTotal}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${taskTotal > 0 ? Math.round((taskDone / taskTotal) * 100) : 0}%`,
                        background: 'linear-gradient(90deg,#6366f1,#818cf8)',
                      }}
                    />
                  </div>
                  <div className="flex gap-4 mt-2">
                    {(['todo', 'in_progress', 'done', 'blocked'] as const).map((s) => {
                      const count = snap?.tasks[s] ?? 0;
                      if (count === 0) return null;
                      const colors: Record<string, string> = {
                        todo: 'text-gray-500',
                        in_progress: 'text-indigo-400',
                        done: 'text-green-500',
                        blocked: 'text-red-400',
                      };

                      return (
                        <span key={s} className={`text-xs flex items-center gap-1 ${colors[s]}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          {count} {s.replace('_', ' ')}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <ProgressRing value={taskDone} total={taskTotal} size={72} stroke={6} />
          </div>

          {/* Active task banner */}
          {activeTask && (
            <div
              className="mt-4 flex items-center gap-3 rounded-lg px-4 py-2.5"
              style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: '#6366f1', animation: 'pulse 2s infinite' }}
              />
              <span className="text-xs text-gray-400">{dict.project.inProgress}</span>
              <span className="text-xs text-indigo-300 flex-1 truncate font-medium">{activeTask.title}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tab nav + content */}
      <main className="mx-auto max-w-5xl px-8 py-6">
        <TabNav activeTab={tab} />

        {tab === 'tasks' && <TasksTab token={token} projectId={id} dict={dict} />}
        {tab === 'phases' && <PhasesTab token={token} projectId={id} dict={dict} />}
        {tab === 'decisions' && <DecisionsTab token={token} projectId={id} dict={dict} />}
        {tab === 'memory' && <MemoryTab token={token} projectId={id} q={q} dict={dict} />}
        {tab === 'codeflow' && <CodeflowTab token={token} projectId={id} activeView={cf} dict={dict} />}
        {(tab === 'activity' || tab === 'audit') && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-white">{dict.activity.title}</h2>
            <ActivityTimeline
              token={token}
              projectId={id}
              dict={dict}
              filters={{
                eventType: sp.eventType,
                actorType: sp.actorType,
                dateFrom: sp.dateFrom,
                dateTo: sp.dateTo,
                page: sp.page,
              }}
            />
          </div>
        )}
        {tab === 'contributors' && (
          <ContributorsTabLoader token={token} projectId={id} session={session} project={project} dict={dict} />
        )}
      </main>
    </AppShell>
  );
}


async function TasksTab({ token, projectId, dict }: { token: string; projectId: string; dict: Dictionary }) {

  // Cap SSR payload — full listing is rarely useful and pages with 100+
  // tasks were rendering 400+ KB of HTML per tab navigation. Show the
  // most recent 50; total count is shown in the header.
  const [tasks, totalTasks, phases] = await Promise.all([
    listTasks(token, projectId, { take: 50 }),
    countTasks(token, projectId),
    listPhases(token, projectId),
  ]);

  const phaseMap = new Map(phases.map((p) => [p.id, p]));

  const grouped = tasks.reduce<Record<string, Task[]>>((acc, task) => {
    const key = task.phaseId ?? '__none__';
    (acc[key] ??= []).push(task);
    return acc;
  }, {});

  const unassigned = grouped['__none__'] ?? [];
  const byPhase = phases
    .map((p) => ({ phase: p, tasks: grouped[p.id] ?? [] }))
    .filter(({ tasks: t }) => t.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          {dict.project.totalTasks(totalTasks)}
          {totalTasks > tasks.length && ` (mostro ${tasks.length} più recenti)`}
        </p>
        <CreateTaskForm projectId={projectId} phases={phases} />
      </div>

      {tasks.length === 0 && (
        <p className="text-xs text-gray-500">{dict.project.noTasks}</p>
      )}

      {byPhase.map(({ phase, tasks: phaseTasks }) => (
        <div key={phase.id}>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">{phase.title}</p>
          <TaskList tasks={phaseTasks} projectId={projectId} />
        </div>
      ))}

      {unassigned.length > 0 && (
        <div>
          {byPhase.length > 0 && (
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">{dict.project.unassigned}</p>
          )}
          <TaskList tasks={unassigned} projectId={projectId} />
        </div>
      )}
    </div>
  );
}


async function PhasesTab({ token, projectId, dict }: { token: string; projectId: string; dict: Dictionary }) {

  const [phases, tasks, decisions] = await Promise.all([
    listPhases(token, projectId),
    listTasks(token, projectId),
    listDecisions(token, projectId),
  ]);

  const tasksByPhase = tasks.reduce<Record<string, Task[]>>((acc, task) => {
    if (task.phaseId) {
      (acc[task.phaseId] ??= []).push(task);
    }

    return acc;
  }, {});

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-500">{dict.project.totalPhases(phases.length)}</p>
        <CreatePhaseForm projectId={projectId} decisions={decisions} />
      </div>

      {phases.length === 0 && (
        <p className="text-xs text-gray-500">{dict.project.noPhases}</p>
      )}

      {phases.map((phase) => (
        <PhaseAccordion
          key={phase.id}
          phase={phase}
          tasks={tasksByPhase[phase.id] ?? []}
          projectId={projectId}
        />
      ))}
    </div>
  );
}


async function DecisionsTab({ token, projectId, dict }: { token: string; projectId: string; dict: Dictionary }) {

  const [decisions, phases] = await Promise.all([
    listDecisions(token, projectId),
    listPhases(token, projectId),
  ]);

  const phasesByDecision = phases.reduce<Record<string, Phase[]>>((acc, phase) => {
    if (phase.decisionId) {
      (acc[phase.decisionId] ??= []).push(phase);
    }

    return acc;
  }, {});

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-500">{dict.project.totalDecisions(decisions.length)}</p>
        <CreateDecisionForm projectId={projectId} />
      </div>

      {decisions.length === 0 && (
        <p className="text-xs text-gray-500">{dict.project.noDecisions}</p>
      )}

      {decisions.map((d) => (
        <DecisionAccordion
          key={d.id}
          decision={d}
          phases={phasesByDecision[d.id] ?? []}
        />
      ))}
    </div>
  );
}


async function MemoryTab({ token, projectId, q, dict }: { token: string; projectId: string; q?: string; dict: Dictionary }) {

  // Cap SSR payload — full listing was rendering 400+KB of HTML when the
  // project has many memory entries, which made tab navigation feel
  // sluggish. Show the most recent 50 by default; lift the cap when the
  // user is actively searching so the query hits the full history.
  const take = q ? undefined : 50;
  const [memory, totalMemory] = await Promise.all([
    listMemory(token, projectId, q, { take }),
    countMemory(token, projectId, q),
  ]);

  return (
    <div className="space-y-4">
      <MemorySearch defaultValue={q ?? ''} />
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          {q ? dict.project.totalResults(totalMemory, q) : dict.project.totalEntries(totalMemory)}
          {totalMemory > memory.length && ` · mostro ${memory.length} più recenti`}
        </p>
        <CreateMemoryForm projectId={projectId} />
      </div>

      {memory.length === 0 && (
        <p className="text-xs text-gray-500">{dict.project.noMemory}</p>
      )}

      <div className="grid gap-2">
        {memory.map((entry) => (
          <div key={entry.id} className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${MEMORY_TYPE_COLOR[entry.type] ?? 'bg-gray-700 text-gray-300'}`}>
                {entry.type}
              </span>
              <span className="text-xs font-medium text-white">{entry.title}</span>
            </div>
            {entry.body && (
              <Markdown className="text-xs text-gray-400">{entry.body}</Markdown>
            )}
            <AttributionLine
              createdBy={entry.createdBy}
              updatedBy={entry.updatedBy}
              updatedAt={entry.updatedAt}
              dict={dict}
              className="mt-2"
            />
          </div>
        ))}
      </div>
    </div>
  );
}


function TaskList({ tasks, projectId }: { tasks: Task[]; projectId: string }) {

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
      {tasks.map((task, i) => (
        <TaskRow key={task.id} task={task} projectId={projectId} isLast={i === tasks.length - 1} />
      ))}
    </div>
  );
}


function CodeflowTab({
  token,
  projectId,
  activeView,
  dict,
}: {
  token: string;
  projectId: string;
  activeView: string;
  dict: Dictionary;
}) {

  return (
    <div className="space-y-4">
      <CodeflowSubNav activeView={activeView} />

      {activeView === 'map' && <ArchitectureMapView token={token} projectId={projectId} dict={dict} />}
      {activeView === 'impact' && <ChangeImpactView dict={dict} />}
      {activeView === 'decisionGraph' && <DecisionGraphView dict={dict} />}
      {activeView === 'agentContext' && <AgentContextView token={token} projectId={projectId} dict={dict} />}
    </div>
  );
}


async function ContributorsTabLoader({
  token,
  projectId,
  session,
  project,
  dict,
}: {
  token: string;
  projectId: string;
  session: { userId: string; role: string };
  project: { ownerUserId: string | null; homeUrl?: string | null; thumbnailUrl?: string | null };
  dict: Dictionary;
}) {

  const [users, grants, myMemberships] = await Promise.all([
    listUsers(token).catch(() => []),
    listGrants(token, projectId).catch(() => []),
    listMyMemberships(token, session.userId).catch(() => []),
  ]);

  const isAdmin = session.role === 'admin';
  const myTeamIds = new Set(myMemberships.map((m) => m.teamId));
  const isProjectAdmin = grants.some((g) =>
    g.grantType === 'project.admin' && (
      (g.subjectType === 'user' && g.subjectId === session.userId)
      || (g.subjectType === 'team' && myTeamIds.has(g.subjectId))
    ),
  );
  const isOwner = isAdmin || project.ownerUserId === session.userId || isProjectAdmin;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-white">{dict.tabs.contributors}</h2>
        <ContributorsTab
          projectId={projectId}
          currentUserId={session.userId}
          isOwner={isOwner}
          users={users}
          initialGrants={grants}
        />
      </div>
      {isOwner && (
        <EditThumbnailForm
          projectId={projectId}
          initialHomeUrl={project.homeUrl ?? null}
          initialThumbnailUrl={project.thumbnailUrl ?? null}
        />
      )}
    </div>
  );
}
