import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getToken } from '@/lib/auth';
import {
  getProject,
  listTasks,
  listMemory,
  listPhases,
  listDecisions,
  listMilestones,
  getDashboardSnapshot,
  listAuditEvents,
} from '@/lib/api';
import { Nav } from '@/components/nav';
import { TabNav } from './tab-nav';
import { TaskStatusSelect } from './task-status';
import { CreateTaskForm } from './create-task-form';
import { CreatePhaseForm } from './create-phase-form';
import { CreateMilestoneForm } from './create-milestone-form';
import { CreateDecisionForm } from './create-decision-form';
import { CreateMemoryForm } from './create-memory-form';
import { MemorySearch } from './memory-search';
import type { Task, Milestone } from '@/lib/api';


const STATUS_COLOR: Record<string, string> = {
  active: 'bg-green-900 text-green-300',
  draft: 'bg-gray-700 text-gray-300',
  paused: 'bg-yellow-900 text-yellow-300',
  completed: 'bg-blue-900 text-blue-300',
  in_progress: 'bg-indigo-900 text-indigo-300',
  archived: 'bg-gray-800 text-gray-500',
};

const TASK_PRIORITY_COLOR: Record<string, string> = {
  critical: 'text-red-400',
  high: 'text-orange-400',
  medium: 'text-yellow-400',
  low: 'text-gray-400',
};

const TASK_STATUS_COLOR: Record<string, string> = {
  todo: 'bg-gray-700 text-gray-300',
  in_progress: 'bg-indigo-900 text-indigo-300',
  done: 'bg-green-900 text-green-300',
  blocked: 'bg-red-900 text-red-300',
};

const MEMORY_TYPE_COLOR: Record<string, string> = {
  done: 'bg-green-900 text-green-300',
  next: 'bg-indigo-900 text-indigo-300',
  decision: 'bg-yellow-900 text-yellow-300',
  handoff: 'bg-purple-900 text-purple-300',
  architecture: 'bg-blue-900 text-blue-300',
  issue: 'bg-red-900 text-red-300',
  learning: 'bg-teal-900 text-teal-300',
  operational_note: 'bg-gray-700 text-gray-300',
  open_question: 'bg-orange-900 text-orange-300',
};

const DECISION_IMPACT_COLOR: Record<string, string> = {
  high: 'text-red-400',
  medium: 'text-yellow-400',
  low: 'text-gray-400',
};

const MILESTONE_STATUS_COLOR: Record<string, string> = {
  pending: 'bg-gray-700 text-gray-300',
  in_progress: 'bg-indigo-900 text-indigo-300',
  completed: 'bg-green-900 text-green-300',
  missed: 'bg-red-900 text-red-300',
};


interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; q?: string }>;
}


export default async function ProjectDetailPage({ params, searchParams }: Props) {

  const { id } = await params;
  const { tab = 'overview', q } = await searchParams;
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

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-5xl px-4 py-8">

        <div className="flex items-start justify-between mb-6">
          <div>
            <Link href="/projects" className="text-xs text-gray-500 hover:text-gray-300 transition-colors mb-2 block">
              ← Projects
            </Link>
            <h1 className="text-lg font-semibold text-white">{project.name}</h1>
            {project.description && (
              <p className="mt-1 text-sm text-gray-400">{project.description}</p>
            )}
          </div>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium mt-6 shrink-0 ${STATUS_COLOR[project.status] ?? 'bg-gray-700 text-gray-300'}`}
          >
            {project.status}
          </span>
        </div>

        <TabNav activeTab={tab} />

        {tab === 'overview' && <OverviewTab token={token} projectId={id} />}
        {tab === 'tasks' && <TasksTab token={token} projectId={id} />}
        {tab === 'phases' && <PhasesTab token={token} projectId={id} />}
        {tab === 'decisions' && <DecisionsTab token={token} projectId={id} />}
        {tab === 'memory' && <MemoryTab token={token} projectId={id} q={q} />}
        {tab === 'audit' && <AuditTab token={token} projectId={id} />}

      </main>
    </>
  );
}


async function OverviewTab({ token, projectId }: { token: string; projectId: string }) {

  let snap;

  try {
    snap = await getDashboardSnapshot(token, projectId);
  } catch {
    return <p className="text-xs text-gray-500">Dashboard non disponibile.</p>;
  }

  const totalTasks = Object.values(snap.tasks).reduce((a, b) => a + b, 0);
  const doneTasks = snap.tasks['done'] ?? 0;
  const progressPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <div className="space-y-6">

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(['todo', 'in_progress', 'done', 'blocked'] as const).map((s) => (
          <div key={s} className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-3">
            <p className="text-xs text-gray-500 mb-1">{s.replace('_', ' ')}</p>
            <p className="text-xl font-semibold text-white">{snap.tasks[s] ?? 0}</p>
          </div>
        ))}
      </div>

      {totalTasks > 0 && (
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Task completati</span>
            <span>{progressPct}%</span>
          </div>
          <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {snap.activePhases.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Fasi attive</h2>
          <div className="grid gap-2">
            {snap.activePhases.map((p) => (
              <div key={p.id} className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-2.5 flex items-center justify-between">
                <span className="text-sm text-white">{p.title}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[p.status] ?? 'bg-gray-700 text-gray-300'}`}>
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {snap.urgentTasks.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Task urgenti</h2>
          <div className="divide-y divide-gray-800 rounded-lg border border-gray-800 overflow-hidden">
            {snap.urgentTasks.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-4 py-2.5 bg-gray-900">
                <span className="text-sm text-white truncate">{t.title}</span>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  <span className={`text-xs font-medium ${TASK_PRIORITY_COLOR[t.priority] ?? 'text-gray-400'}`}>
                    {t.priority}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${TASK_STATUS_COLOR[t.status] ?? 'bg-gray-700 text-gray-300'}`}>
                    {t.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {snap.recentDecisions.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Decisioni recenti</h2>
          <div className="grid gap-2">
            {snap.recentDecisions.map((d) => (
              <div key={d.id} className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-2.5 flex items-center justify-between">
                <span className="text-sm text-white">{d.title}</span>
                <div className="flex items-center gap-2 ml-4 shrink-0">
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
            ))}
          </div>
        </section>
      )}

    </div>
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

  const [phases, milestones] = await Promise.all([
    listPhases(token, projectId),
    listMilestones(token, projectId),
  ]);

  const milestonesByPhase = milestones.reduce<Record<string, Milestone[]>>((acc, m) => {
    const key = m.phaseId ?? '__none__';
    (acc[key] ??= []).push(m);
    return acc;
  }, {});

  const unlinkedMilestones = milestonesByPhase['__none__'] ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">{phases.length} fasi · {milestones.length} milestone</p>
        <CreatePhaseForm projectId={projectId} />
      </div>

      {phases.length === 0 && (
        <p className="text-xs text-gray-500">Nessuna fase ancora.</p>
      )}

      {phases.map((phase) => (
        <div key={phase.id} className="rounded-lg border border-gray-800 bg-gray-900 p-4">
          <div className="flex items-center justify-between mb-3">
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

          {(milestonesByPhase[phase.id] ?? []).length > 0 && (
            <div className="space-y-1.5 mb-3">
              {(milestonesByPhase[phase.id] ?? []).map((m) => (
                <MilestoneRow key={m.id} milestone={m} />
              ))}
            </div>
          )}

          <CreateMilestoneForm projectId={projectId} phaseId={phase.id} />
        </div>
      ))}

      {unlinkedMilestones.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Milestone senza fase</p>
          <div className="space-y-1.5">
            {unlinkedMilestones.map((m) => (
              <MilestoneRow key={m.id} milestone={m} />
            ))}
          </div>
        </div>
      )}

      <div className="pt-2">
        <CreateMilestoneForm projectId={projectId} />
      </div>
    </div>
  );
}


function MilestoneRow({ milestone }: { milestone: Milestone }) {

  return (
    <div className="flex items-center justify-between px-3 py-2 rounded bg-gray-800">
      <span className="text-xs text-gray-200">{milestone.title}</span>
      <div className="flex items-center gap-2 ml-4 shrink-0">
        {milestone.dueDate && (
          <span className="text-xs text-gray-500">
            {new Date(milestone.dueDate).toLocaleDateString('it-IT')}
          </span>
        )}
        <span className={`text-xs px-1.5 py-0.5 rounded ${MILESTONE_STATUS_COLOR[milestone.status] ?? 'bg-gray-700 text-gray-300'}`}>
          {milestone.status}
        </span>
      </div>
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
          <div key={d.id} className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-3">
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
          <div key={entry.id} className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-3">
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

      <div className="divide-y divide-gray-800 rounded-lg border border-gray-800 overflow-hidden">
        {events.map((event) => (
          <div key={event.id} className="px-4 py-3 bg-gray-900">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="shrink-0 text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-400 font-mono">
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
    <div className="divide-y divide-gray-800 rounded-lg border border-gray-800 overflow-hidden">
      {tasks.map((task) => (
        <div key={task.id} className="flex items-center justify-between px-4 py-3 bg-gray-900">
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
