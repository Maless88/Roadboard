import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getToken } from '@/lib/auth';
import { listProjects, listTeams } from '@/lib/api';
import { Nav } from '@/components/nav';
import { CreateProjectForm } from './create-project-form';


const STATUS_COLOR: Record<string, string> = {
  active: 'bg-green-900 text-green-300',
  draft: 'bg-gray-700 text-gray-300',
  paused: 'bg-yellow-900 text-yellow-300',
  completed: 'bg-blue-900 text-blue-300',
  archived: 'bg-gray-800 text-gray-500',
};


export default async function ProjectsPage() {

  const token = await getToken();

  if (!token) {
    redirect('/login');
  }

  const [projects, teams] = await Promise.all([
    listProjects(token),
    listTeams(token).catch(() => []),
  ]);

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-semibold text-white">Projects</h1>
          <CreateProjectForm teams={teams} />
        </div>

        {projects.length === 0 ? (
          <p className="text-sm text-gray-500">Nessun progetto trovato.</p>
        ) : (
          <div className="grid gap-3">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="block rounded-lg border border-gray-800 bg-gray-900 px-5 py-4 hover:border-gray-600 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white">{project.name}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[project.status] ?? 'bg-gray-700 text-gray-300'}`}
                  >
                    {project.status}
                  </span>
                </div>
                {project.description && (
                  <p className="mt-1 text-xs text-gray-400 line-clamp-1">{project.description}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
