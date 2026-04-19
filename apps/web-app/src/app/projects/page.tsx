import { redirect } from 'next/navigation';
import { getToken } from '@/lib/auth';
import { listProjects, listTeams, validateSession } from '@/lib/api';
import { getDict } from '@/lib/i18n';
import { AppShell } from '@/components/app-shell';
import { CreateProjectForm } from './create-project-form';
import { SwipeableProjectRow } from './swipeable-project-row';


export default async function ProjectsPage() {

  const token = await getToken();

  if (!token) {
    redirect('/login');
  }

  const [session, projects, teams, dict] = await Promise.all([
    validateSession(token),
    listProjects(token),
    listTeams(token).catch(() => []),
    getDict(),
  ]);

  if (!session) redirect('/login');

  return (
    <AppShell username={session.username} displayName={session.displayName} userProjects={[...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((p) => ({ id: p.id, name: p.name, status: p.status }))}>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-semibold text-white">{dict.projects.title}</h1>
          <CreateProjectForm teams={teams} />
        </div>

        {projects.length === 0 ? (
          <p className="text-sm text-gray-500">{dict.projects.noProjects}</p>
        ) : (
          <div className="grid gap-3">
            {projects.map((project) => (
              <SwipeableProjectRow
                key={project.id}
                id={project.id}
                name={project.name}
                status={project.status}
                description={project.description}
              />
            ))}
          </div>
        )}
      </main>
    </AppShell>
  );
}
