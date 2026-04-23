import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getToken } from '@/lib/auth';
import { getDict } from '@/lib/i18n';
import {
  getProject,
  listProjects,
  listTasks,
  listMemory,
  listPhases,
  listDecisions,
  getDashboardSnapshot,
  validateSession,
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
import { PhaseAccordion } from './phase-accordion';
import { DecisionAccordion } from './decision-accordion';
import { TaskRow } from './task-row';
import { CodeflowSubNav } from './codeflow/sub-nav';
import { ArchitectureMapView } from './codeflow/architecture-map-view';
import { ChangeImpactView, DecisionGraphView, AgentContextView } from './codeflow/placeholder-views';
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

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; q?: string; cf?: string }>;
}


export default async function ProjectDetailPage({ params, searchParams }: Props) {

  const { id } = await params;
  const { tab = 'tasks', q, cf = 'map' } = await searchParams;
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

  const [session, snap, userProjects, dict] = await Promise.all([
    validateSession(token),
    getDashboardSnapshot(token, id).catch(() => null),
    listProjects(token).catch(() => []),
    getDict(),
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
                <p className="text-xs text-gray-500 mb-4">{project.description}</p>
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
      </main>
    </AppShell>
  );
}


async function TasksTab({ token, projectId, dict }: { token: string; projectId: string; dict: Dictionary }) {

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
        <p className="text-xs text-gray-500">{dict.project.totalTasks(tasks.length)}</p>
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

  const memory = await listMemory(token, projectId, q);

  return (
    <div className="space-y-4">
      <MemorySearch defaultValue={q ?? ''} />
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          {q ? dict.project.totalResults(memory.length, q) : dict.project.totalEntries(memory.length)}
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
              <p className="text-xs text-gray-400 whitespace-pre-wrap">{entry.body}</p>
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
      {activeView === 'agentContext' && <AgentContextView dict={dict} />}
    </div>
  );
}
