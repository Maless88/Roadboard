import { redirect } from 'next/navigation';
import { getToken } from '@/lib/auth';
import { validateSession, listTokens, listUsers, listProjects, listGrants } from '@/lib/api';
import { Nav } from '@/components/nav';
import { SettingsTabs } from './settings-tabs';


export default async function SettingsPage() {

  const token = await getToken();

  if (!token) redirect('/login');

  const session = await validateSession(token);

  if (!session) redirect('/login');

  const [tokens, users, projects] = await Promise.all([
    listTokens(token, session.userId),
    listUsers(token),
    listProjects(token),
  ]);

  const grantsPerProject = await Promise.all(
    projects.map(async (p) => ({
      project: p,
      grants: await listGrants(token, p.id),
    })),
  );

  const isAdmin = session.username === 'alessio';

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-white">Settings</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {session.displayName} · {session.username}
          </p>
        </div>
        <SettingsTabs
          session={session}
          tokens={tokens}
          users={users}
          projects={projects}
          grantsPerProject={grantsPerProject}
          isAdmin={isAdmin}
        />
      </main>
    </>
  );
}
