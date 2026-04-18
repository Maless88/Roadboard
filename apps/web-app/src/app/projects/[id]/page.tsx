import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getToken } from '@/lib/auth';
import {
  getProject,
  listProjects,
  listTasks,
  listMemory,
  listPhases,
  listDecisions,
  getDashboardSnapshot,
  listAuditEvents,
  validateSession,
} from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { ProgressRing } from '@/components/progress-ring';
import { TabNav } from './tab-nav';
import { TaskStatusSelect } from './task-status';
import { CreateTaskForm } from './create-task-form';
import { CreatePhaseForm } from './create-phase-form';
import { CreateDecisionForm } from './create-decision-form';
import { CreateMemoryForm } from './create-memory-form';
import { MemorySearch } from './memory-search';
import { DeleteProjectButton } from './delete-project-button';
import type { Task } from '@/lib/api';


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

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; q?: string }>;
}


export default async function ProjectDetailPage({ params, searchParams }: Props) {

  const { id } = await params;
  const { tab = 'tasks', q } = await searchParams;
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

  const [session, snap, userProjects] = await Promise.all([
    validateSession(token),
    getDashboardSnapshot(token, id).catch(() => null),
    listProjects(token).catch(() => []),
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
      {/* Project header with glass health bar */}
      <div
        className="px-8 py-5"
        style={{
          background: 'rgba(17,17,27,0.6)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <div className="max-w-5xl mx-auto">
          <div className="flex items-start gap-6">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <Link href="/projects" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
                  ← Progetti
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
                <p className="text-xs text-gray-500 mb-4">{project.description}</p>
              )}

              {taskTotal > 0 && (
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-gray-600">Avanzamento</span>
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
              <span className="text-xs text-gray-400">In progress:</span>
              <span className="text-xs text-indigo-300 flex-1 truncate font-medium">{activeTask.title}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tab nav + content */}
      <main className="mx-auto max-w-5xl px-8 py-6">
        <TabNav activeTab={tab} />

        {tab === 'tasks' && <TasksTab token={token} projectId={id} />}
        {tab === 'phases' && <PhasesTab token={token} projectId={id} />}
        {tab === 'decisions' && <DecisionsTab token={token} projectId={id} />}
        {tab === 'memory' && <MemoryTab token={token} projectId={id} q={q} />}
        {tab === 'audit' && <AuditTab token={token} projectId={id} />}
      </main>
    </AppShell>
  );
}


async function TasksTab({ token, projectId }: { token: string; projectId: string }) {

  const [tasks, phases] = await Promise.all([
    listTasks(token, projectId),
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
        <p className="text-xs text-gray-500">{tasks.length} task totali</p>
        <CreateTaskForm projectId={projectId} phases={phases} />
      </div>

      {tasks.length === 0 && (
        <p className="text-xs text-gray-500">Nessun task ancora.</p>
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
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Senza fase</p>
          )}
          <TaskList tasks={unassigned} projectId={projectId} />
        </div>
      )}
    </div>
  );
}


async function PhasesTab({ token, projectId }: { token: string; projectId: string }) {

  const phases = await listPhases(token, projectId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">{phases.length} fasi</p>
        <CreatePhaseForm projectId={projectId} />
      </div>

      {phases.length === 0 && (
        <p className="text-xs text-gray-500">Nessuna fase ancora.</p>
      )}

      {phases.map((phase) => (
        <div key={phase.id} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-white">{phase.title}</span>
              {phase.description && (
                <p className="text-xs text-gray-400 mt-0.5">{phase.description}</p>
              )}
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ml-4 ${STATUS_COLOR[phase.status] ?? 'bg-gray-700 text-gray-300'}`}>
              {phase.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}


async function DecisionsTab({ token, projectId }: { token: string; projectId: string }) {

  const decisions = await listDecisions(token, projectId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">{decisions.length} decisioni</p>
        <CreateDecisionForm projectId={projectId} />
      </div>

      {decisions.length === 0 && (
        <p className="text-xs text-gray-500">Nessuna decisione ancora.</p>
      )}

      <div className="grid gap-3">
        {decisions.map((d) => (
          <div key={d.id} className="rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-start justify-between gap-3 mb-2">
              <span className="text-sm font-medium text-white">{d.title}</span>
              <div className="flex items-center gap-2 shrink-0">
                {d.impactLevel && (
                  <span className={`text-xs font-medium ${DECISION_IMPACT_COLOR[d.impactLevel] ?? 'text-gray-400'}`}>
                    {d.impactLevel}
                  </span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[d.status] ?? 'bg-gray-700 text-gray-300'}`}>
                  {d.status}
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-400">{d.summary}</p>
            {d.rationale && (
              <p className="text-xs text-gray-500 mt-1 italic">{d.rationale}</p>
            )}
            {d.outcome && (
              <p className="text-xs text-green-400 mt-1">Outcome: {d.outcome}</p>
            )}
            {d.resolvedAt && (
              <p className="text-xs text-gray-600 mt-1">Risolto: {new Date(d.resolvedAt).toLocaleDateString('it-IT')}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}


async function MemoryTab({ token, projectId, q }: { token: string; projectId: string; q?: string }) {

  const memory = await listMemory(token, projectId, q);

  return (
    <div className="space-y-4">
      <MemorySearch defaultValue={q ?? ''} />
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          {memory.length} {q ? `risultati per "${q}"` : 'entries'}
        </p>
        <CreateMemoryForm projectId={projectId} />
      </div>

      {memory.length === 0 && (
        <p className="text-xs text-gray-500">Nessuna entry ancora.</p>
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
              <p className="text-xs text-gray-400 whitespace-pre-wrap">{entry.body}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}


async function AuditTab({ token, projectId }: { token: string; projectId: string }) {

  let page;

  try {
    page = await listAuditEvents(token, projectId);
  } catch {
    return <p className="text-xs text-gray-500">Audit log non disponibile.</p>;
  }

  const { events, total } = page;

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">{total} eventi totali</p>

      {events.length === 0 && (
        <p className="text-xs text-gray-500">Nessun evento registrato.</p>
      )}

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
        {events.map((event) => (
          <div key={event.id} className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="shrink-0 text-xs px-2 py-0.5 rounded text-gray-400 font-mono" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  {event.eventType}
                </span>
                <span className="text-xs text-gray-300 truncate">
                  {event.targetType} <span className="text-gray-500">{event.targetId.slice(0, 8)}</span>
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-gray-500">{event.actorType}:{event.actorId.slice(0, 8)}</span>
                <span className="text-xs text-gray-600">
                  {new Date(event.createdAt).toLocaleString('it-IT', {
                    month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              </div>
            </div>
            {event.metadata && Object.keys(event.metadata).length > 0 && (
              <p className="text-xs text-gray-600 mt-1 font-mono truncate">
                {JSON.stringify(event.metadata)}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}


function TaskList({ tasks, projectId }: { tasks: Task[]; projectId: string }) {

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
      {tasks.map((task) => (
        <div key={task.id} className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
          <div className="flex items-center gap-3 min-w-0">
            <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${TASK_STATUS_COLOR[task.status] ?? 'bg-gray-700 text-gray-300'}`}>
              {task.status.replace('_', ' ')}
            </span>
            <span className="text-sm text-white truncate">{task.title}</span>
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-4">
            {task.priority && (
              <span className={`text-xs font-medium ${TASK_PRIORITY_COLOR[task.priority] ?? 'text-gray-400'}`}>
                {task.priority}
              </span>
            )}
            <TaskStatusSelect taskId={task.id} projectId={projectId} currentStatus={task.status} />
          </div>
        </div>
      ))}
    </div>
  );
}
