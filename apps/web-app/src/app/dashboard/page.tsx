import { redirect } from 'next/navigation';
import { getToken } from '@/lib/auth';
import { validateSession, listProjects, listTeams, getDashboardSnapshot } from '@/lib/api';
import { getDict } from '@/lib/i18n';
import { AppShell } from '@/components/app-shell';
import { AutoRefresh } from '@/components/auto-refresh';
import { CreateProjectForm } from '@/app/projects/create-project-form';
import { SwipeableProjectCard } from './swipeable-project-card';
import type { Project } from '@/lib/api';


export default async function DashboardPage() {

  const token = await getToken();

  if (!token) redirect('/login');

  const [session, dict] = await Promise.all([
    validateSession(token),
    getDict(),
  ]);

  if (!session) redirect('/login');

  const [projects, teams] = await Promise.all([
    listProjects(token).catch(() => [] as Project[]),
    listTeams(token).catch(() => []),
  ]);

  const visible = projects.filter((p) => p.status !== 'archived');
  const sorted = [...visible].sort((a, b) => {
    const order: Record<string, number> = { active: 0, paused: 1, draft: 2, completed: 3 };
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
      <AutoRefresh />
      <main className="p-8">
        <div className="max-w-5xl mx-auto">

          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>{dict.projects.title}</h1>
              <p className="text-sm mt-0.5 capitalize" style={{ color: 'var(--text-faint)' }}>{dateLabel}</p>
            </div>
            <CreateProjectForm teams={teams} />
          </div>

          {sorted.length === 0 ? (
            <div
              className="rounded-2xl p-12 text-center"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <p className="text-sm" style={{ color: 'var(--text-faint)' }}>{dict.projects.noProjects}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {sorted.map((project, i) => (
                <SwipeableProjectCard
                  key={project.id}
                  project={project}
                  snap={snapshots[i]}
                />
              ))}
            </div>
          )}

        </div>
      </main>
    </AppShell>
  );
}
