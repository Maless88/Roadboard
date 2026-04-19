import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getToken } from '@/lib/auth';
import { validateSession, listProjects, getDashboardSnapshot } from '@/lib/api';
import { getDict } from '@/lib/i18n';
import { AppShell } from '@/components/app-shell';
import type { Project, DashboardSnapshot } from '@/lib/api';
import type { Dictionary } from '@/lib/i18n';


const STATUS_DOT: Record<string, string> = {
  active: 'bg-green-400',
  paused: 'bg-yellow-400',
  draft: 'bg-gray-500',
  completed: 'bg-indigo-400',
  archived: 'bg-gray-700',
};

const STATUS_LABEL: Record<string, string> = {
  active: 'text-green-400',
  paused: 'text-yellow-400',
  draft: 'text-gray-500',
  completed: 'text-indigo-400',
  archived: 'text-gray-600',
};

const TASK_COLORS: Record<string, string> = {
  todo: 'text-gray-500',
  in_progress: 'text-indigo-400',
  done: 'text-green-400',
  blocked: 'text-red-400',
};


export default async function DashboardPage() {

  const token = await getToken();

  if (!token) redirect('/login');

  const [session, dict] = await Promise.all([
    validateSession(token),
    getDict(),
  ]);

  if (!session) redirect('/login');

  const projects = await listProjects(token).catch(() => [] as Project[]);

  const sorted = [...projects].sort((a, b) => {
    const order: Record<string, number> = { active: 0, paused: 1, draft: 2, completed: 3, archived: 4 };
    return (order[a.status] ?? 9) - (order[b.status] ?? 9) || b.updatedAt.localeCompare(a.updatedAt);
  });

  const snapshots = await Promise.all(
    sorted.map((p) => getDashboardSnapshot(token, p.id).catch(() => null)),
  );

  const now = new Date();
  const dateLabel = now.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <AppShell
      username={session.username}
      displayName={session.displayName}
      userProjects={sorted.map((p) => ({ id: p.id, name: p.name, status: p.status }))}
    >
      <main className="p-8">
        <div className="max-w-5xl mx-auto">

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-xl font-bold text-white">{dict.projects.title}</h1>
            <p className="text-sm text-gray-500 mt-0.5 capitalize">{dateLabel}</p>
          </div>

          {sorted.length === 0 ? (
            <div
              className="rounded-2xl p-12 text-center"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <p className="text-sm text-gray-500 mb-4">{dict.projects.noProjects}</p>
              <Link
                href="/projects"
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                {dict.projects.createProject} →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {sorted.map((project, i) => (
                <ProjectCard key={project.id} project={project} snap={snapshots[i]} dict={dict} />
              ))}
            </div>
          )}

        </div>
      </main>
    </AppShell>
  );
}


function ProjectCard({ project, snap, dict }: { project: Project; snap: DashboardSnapshot | null; dict: Dictionary }) {

  const taskDone = snap?.tasks['done'] ?? 0;
  const taskTotal = snap ? Object.values(snap.tasks).reduce((a, b) => a + b, 0) : 0;
  const pct = taskTotal > 0 ? Math.round((taskDone / taskTotal) * 100) : 0;

  const visibleStatuses = (['in_progress', 'todo', 'done', 'blocked'] as const).filter(
    (s) => (snap?.tasks[s] ?? 0) > 0,
  );

  return (
    <Link
      href={`/projects/${project.id}?tab=tasks`}
      className="group block rounded-2xl p-5 transition-all bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.07)] hover:bg-[rgba(255,255,255,0.055)] hover:border-[rgba(255,255,255,0.12)]"
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[project.status] ?? 'bg-gray-500'}`} />
          <h2 className="text-sm font-semibold text-white truncate">{project.name}</h2>
        </div>
        <span className={`text-xs shrink-0 font-medium ${STATUS_LABEL[project.status] ?? 'text-gray-500'}`}>
          {project.status}
        </span>
      </div>

      {/* Description */}
      {project.description && (
        <p className="text-xs text-gray-500 mb-4 line-clamp-2">{project.description}</p>
      )}

      {/* Progress */}
      {taskTotal > 0 ? (
        <div className="mb-3">
          <div className="flex justify-between text-[10px] text-gray-600 mb-1.5">
            <span>{pct}% {dict.nav.completed}</span>
            <span className="font-mono">{taskDone}/{taskTotal}</span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#6366f1,#818cf8)' }}
            />
          </div>
        </div>
      ) : (
        <div className="mb-3">
          <div className="h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }} />
        </div>
      )}

      {/* Task counts */}
      {visibleStatuses.length > 0 ? (
        <div className="flex items-center gap-3 flex-wrap">
          {visibleStatuses.map((s) => (
            <span key={s} className={`flex items-center gap-1 text-[10px] ${TASK_COLORS[s]}`}>
              <span className="w-1 h-1 rounded-full bg-current" />
              {snap!.tasks[s]} {s.replace('_', '\u00a0')}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-[10px] text-gray-700">{dict.project.noTasks}</p>
      )}

      {/* Active phases hint */}
      {snap && snap.activePhases.length > 0 && (
        <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <p className="text-[10px] text-gray-600 truncate">
            📍 {snap.activePhases[0].title}
            {snap.activePhases.length > 1 && ` +${snap.activePhases.length - 1}`}
          </p>
        </div>
      )}
    </Link>
  );
}
