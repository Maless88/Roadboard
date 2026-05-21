import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getToken } from '@/lib/auth';
import { validateSession, listProjects, listTeams } from '@/lib/api';
import { getDict } from '@/lib/i18n';
import { AppShell } from '@/components/app-shell';
import { AutoRefresh } from '@/components/auto-refresh';
import { CreateProjectForm } from '@/app/projects/create-project-form';
import { ProjectsGrid } from './projects-grid';
import { ProjectGridSkeleton } from './project-card-skeleton';
import type { Project } from '@/lib/api';


export default async function DashboardPage() {

  const token = await getToken();

  if (!token) redirect('/login');

  const [session, dict, projects, teams] = await Promise.all([
    validateSession(token),
    getDict(),
    listProjects(token).catch(() => [] as Project[]),
    listTeams(token).catch(() => []),
  ]);

  if (!session) redirect('/login');

  const visible = projects.filter((p) => !p.archivedForMe);
  const sorted = [...visible].sort((a, b) => {
    const order: Record<string, number> = { active: 0, paused: 1, draft: 2, completed: 3 };
    return (order[a.status] ?? 9) - (order[b.status] ?? 9) || b.updatedAt.localeCompare(a.updatedAt);
  });

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

          <Suspense fallback={<ProjectGridSkeleton count={sorted.length || 3} />}>
            <ProjectsGrid token={token} projects={sorted} />
          </Suspense>

        </div>
      </main>
    </AppShell>
  );
}
