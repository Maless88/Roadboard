import { redirect } from 'next/navigation';
import { getToken } from '@/lib/auth';
import { validateSession, listProjects, getDashboardSnapshot, listTasks } from '@/lib/api';
import { AppShell } from '@/components/app-shell';
import { ProgressRing } from '@/components/progress-ring';
import { updateTaskStatusAction } from '@/app/actions';
import type { Task } from '@/lib/api';


const PRIORITY_COLOR: Record<string, string> = {
  critical: 'text-red-400',
  high: 'text-orange-400',
  medium: 'text-yellow-400',
  low: 'text-gray-500',
};

const PRIORITY_DOT: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-400',
  medium: 'bg-yellow-400',
  low: 'bg-gray-500',
};


export default async function DashboardPage() {

  const token = await getToken();

  if (!token) redirect('/login');

  const session = await validateSession(token);

  if (!session) redirect('/login');

  const projects = await listProjects(token).catch(() => []);
  const activeProject = projects.find((p) => p.status === 'active') ?? projects[0] ?? null;

  if (!activeProject) {

    return (
      <AppShell username={session.username} displayName={session.displayName}>
        <main className="flex-1 flex items-center justify-center p-8">
          <p className="text-sm text-gray-500">Nessun progetto trovato.</p>
        </main>
      </AppShell>
    );
  }

  const [snapshot, tasks] = await Promise.all([
    getDashboardSnapshot(token, activeProject.id),
    listTasks(token, activeProject.id),
  ]);

  const taskDone = snapshot.tasks['done'] ?? 0;
  const taskTotal = Object.values(snapshot.tasks).reduce((a, b) => a + b, 0);

  const activeTask: Task | undefined =
    tasks.find((t) => t.status === 'in_progress') ??
    tasks.filter((t) => t.status === 'todo').sort((a, b) => {
      const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      return (order[a.priority] ?? 9) - (order[b.priority] ?? 9);
    })[0];

  const nextTasks = tasks
    .filter((t) => t.status === 'todo' && t.id !== activeTask?.id)
    .sort((a, b) => {
      const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      return (order[a.priority] ?? 9) - (order[b.priority] ?? 9);
    })
    .slice(0, 6);

  const byPriority = tasks.reduce<Record<string, number>>((acc, t) => {
    if (t.status !== 'done') {
      acc[t.priority] = (acc[t.priority] ?? 0) + 1;
    }
    return acc;
  }, {});

  const now = new Date();
  const dateLabel = now.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <AppShell
      username={session.username}
      displayName={session.displayName}
      activeProject={{ id: activeProject.id, name: activeProject.name, taskDone, taskTotal }}
    >
      <main className="p-8 overflow-auto">
        <div className="max-w-3xl mx-auto space-y-5">

          {/* Header */}
          <div>
            <h1 className="text-xl font-bold text-white">Dashboard</h1>
            <p className="text-sm text-gray-500 mt-0.5 capitalize">{dateLabel}</p>
          </div>

          {/* Hero — active task */}
          {activeTask ? (
            <div
              className="relative rounded-2xl p-6 overflow-hidden"
              style={{
                background: 'rgba(79,70,229,0.08)',
                border: '1px solid rgba(99,102,241,0.25)',
                backdropFilter: 'blur(20px)',
              }}
            >
              {/* glow */}
              <div
                className="absolute -top-10 -right-10 w-48 h-48 rounded-full pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)' }}
              />

              <div className="relative flex items-center gap-6">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: '#6366f1', boxShadow: '0 0 6px rgba(99,102,241,0.8)', animation: 'pulse 2s infinite' }}
                    />
                    <span className="text-xs text-indigo-400 font-mono uppercase tracking-wider">
                      {activeTask.status === 'in_progress' ? 'In Progress' : 'Focus'}
                    </span>
                    <span className={`text-xs font-medium ml-2 ${PRIORITY_COLOR[activeTask.priority] ?? 'text-gray-400'}`}>
                      {activeTask.priority.toUpperCase()}
                    </span>
                  </div>

                  <h2 className="text-base font-semibold text-white leading-snug mb-1 line-clamp-2">
                    {activeTask.title}
                  </h2>
                  <p className="text-xs text-gray-500 mb-5">{activeProject.name}</p>

                  <div className="flex gap-2">
                    {activeTask.status === 'todo' && (
                      <form action={updateTaskStatusAction.bind(null, activeTask.id, 'in_progress', activeProject.id)}>
                        <button
                          type="submit"
                          className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl font-medium transition-colors"
                        >
                          Inizia
                        </button>
                      </form>
                    )}
                    {activeTask.status === 'in_progress' && (
                      <form action={updateTaskStatusAction.bind(null, activeTask.id, 'done', activeProject.id)}>
                        <button
                          type="submit"
                          className="text-xs bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-xl font-medium transition-colors"
                        >
                          Segna done ✓
                        </button>
                      </form>
                    )}
                    <a
                      href={`/projects/${activeProject.id}?tab=tasks`}
                      className="text-xs px-4 py-2 rounded-xl transition-colors text-gray-400 hover:text-white"
                      style={{ background: 'rgba(255,255,255,0.06)' }}
                    >
                      Apri →
                    </a>
                  </div>
                </div>

                <ProgressRing value={taskDone} total={taskTotal} size={88} stroke={8} label="done" />
              </div>
            </div>
          ) : (
            <div
              className="rounded-2xl p-6 text-center"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <p className="text-sm text-gray-500">Nessun task aperto — ottimo lavoro.</p>
            </div>
          )}

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Da fare', value: snapshot.tasks['todo'] ?? 0, color: 'text-white' },
              { label: 'In corso', value: snapshot.tasks['in_progress'] ?? 0, color: 'text-indigo-400' },
              { label: 'Completati', value: taskDone, color: 'text-green-400' },
              { label: 'Bloccati', value: snapshot.tasks['blocked'] ?? 0, color: 'text-red-400' },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="rounded-xl p-4 text-center"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <p className={`text-2xl font-black ${color}`}>{value}</p>
                <p className="text-xs text-gray-600 mt-1">{label}</p>
              </div>
            ))}
          </div>

          {/* Priority breakdown */}
          <div
            className="rounded-2xl p-5"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <h3 className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-4">Priorità aperte</h3>
            <div className="space-y-3">
              {(['critical', 'high', 'medium', 'low'] as const).map((p) => {
                const count = byPriority[p] ?? 0;
                const pct = taskTotal > 0 ? Math.round((count / taskTotal) * 100) : 0;

                return (
                  <div key={p}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className={PRIORITY_COLOR[p]}>{p.charAt(0).toUpperCase() + p.slice(1)}</span>
                      <span className="text-gray-600">{count} task</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#6b7280' }[p] }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Next tasks */}
          {nextTasks.length > 0 && (
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div
                className="px-5 py-3 flex items-center justify-between"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
              >
                <h3 className="text-xs font-mono text-gray-500 uppercase tracking-wider">Prossimi task</h3>
                <a href={`/projects/${activeProject.id}?tab=tasks`} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                  Tutti →
                </a>
              </div>
              <ul>
                {nextTasks.map((task) => (
                  <li
                    key={task.id}
                    className="px-5 py-3 flex items-center gap-3 transition-colors hover:bg-white/3"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_DOT[task.priority] ?? 'bg-gray-600'}`} />
                    <span className="text-xs text-gray-300 flex-1 truncate">{task.title}</span>
                    <span className={`text-xs shrink-0 ${PRIORITY_COLOR[task.priority] ?? 'text-gray-500'}`}>
                      {task.priority}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>
      </main>
    </AppShell>
  );
}
