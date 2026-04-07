import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getToken } from '@/lib/auth';
import { getProject, listTasks, listMemory } from '@/lib/api';
import { Nav } from '@/components/nav';
import { TaskStatusSelect } from './task-status';


const STATUS_COLOR: Record<string, string> = {
  active: 'bg-green-900 text-green-300',
  draft: 'bg-gray-700 text-gray-300',
  paused: 'bg-yellow-900 text-yellow-300',
  completed: 'bg-blue-900 text-blue-300',
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
  context: 'bg-gray-700 text-gray-300',
  decision: 'bg-yellow-900 text-yellow-300',
};


interface Props {
  params: Promise<{ id: string }>;
}


export default async function ProjectDetailPage({ params }: Props) {

  const { id } = await params;
  const token = await getToken();

  if (!token) {
    redirect('/login');
  }

  let project, tasks, memory;

  try {
    [project, tasks, memory] = await Promise.all([
      getProject(token, id),
      listTasks(token, id),
      listMemory(token, id),
    ]);
  } catch {
    notFound();
  }

  const grouped = tasks.reduce<Record<string, typeof tasks>>((acc, task) => {
    const key = task.phaseId ?? '__none__';
    (acc[key] ??= []).push(task);
    return acc;
  }, {});

  const unassigned = grouped['__none__'] ?? [];
  const byPhase = Object.entries(grouped).filter(([k]) => k !== '__none__');

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between">
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
            className={`text-xs px-2 py-0.5 rounded-full font-medium mt-6 ${STATUS_COLOR[project.status] ?? 'bg-gray-700 text-gray-300'}`}
          >
            {project.status}
          </span>
        </div>

        {/* Tasks */}
        <section>
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Tasks</h2>

          {tasks.length === 0 ? (
            <p className="text-xs text-gray-500">No tasks found.</p>
          ) : (
            <div className="space-y-6">

              {byPhase.map(([phaseId, phaseTasks]) => (
                <div key={phaseId}>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Phase {phaseId.slice(0, 8)}</p>
                  <TaskList tasks={phaseTasks} projectId={id} />
                </div>
              ))}

              {unassigned.length > 0 && (
                <div>
                  {byPhase.length > 0 && (
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Unassigned</p>
                  )}
                  <TaskList tasks={unassigned} projectId={id} />
                </div>
              )}

            </div>
          )}
        </section>

        {/* Memory */}
        {memory.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-300 mb-3">Memory</h2>
            <div className="grid gap-2">
              {memory.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-lg border border-gray-800 bg-gray-900 px-4 py-3"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded font-medium ${MEMORY_TYPE_COLOR[entry.type] ?? 'bg-gray-700 text-gray-300'}`}
                    >
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
          </section>
        )}

      </main>
    </>
  );
}


function TaskList({ tasks, projectId }: { tasks: Awaited<ReturnType<typeof listTasks>>; projectId: string }) {

  return (
    <div className="divide-y divide-gray-800 rounded-lg border border-gray-800 overflow-hidden">
      {tasks.map((task) => (
        <div key={task.id} className="flex items-center justify-between px-4 py-3 bg-gray-900">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${TASK_STATUS_COLOR[task.status] ?? 'bg-gray-700 text-gray-300'}`}
            >
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
