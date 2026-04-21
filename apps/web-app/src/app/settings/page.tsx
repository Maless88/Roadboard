import { redirect } from 'next/navigation';
import { getToken } from '@/lib/auth';
import { validateSession, listTokens, listUsers, listProjects, listGrants, listMyMemberships, listMemberships } from '@/lib/api';
import { getDict } from '@/lib/i18n';
import { AppShell } from '@/components/app-shell';
import { SettingsTabs } from './settings-tabs';


export default async function SettingsPage() {

  const token = await getToken();

  if (!token) redirect('/login');

  const [session, dict] = await Promise.all([
    validateSession(token),
    getDict(),
  ]);

  if (!session) redirect('/login');

  const [tokens, users, projects, myMemberships] = await Promise.all([
    listTokens(token, session.userId),
    listUsers(token),
    listProjects(token),
    listMyMemberships(token, session.userId).catch(() => []),
  ]);

  const grantsPerProject = await Promise.all(
    projects.map(async (p) => ({
      project: p,
      grants: await listGrants(token, p.id),
    })),
  );

  const teams = await Promise.all(
    myMemberships.map(async (m) => ({
      team: m.team,
      role: m.role,
      memberships: await listMemberships(token, m.teamId).catch(() => []),
    })),
  );

  const isAdmin = session.role === 'admin';
  const isTeamLeader = session.role === 'team_leader';

  const myTeamIds = new Set(myMemberships.map((m) => m.teamId));
  const manageableGrantsPerProject = isAdmin
    ? grantsPerProject
    : grantsPerProject.filter(({ project, grants }) => {

      if (project.ownerUserId === session.userId) return true;

      return grants.some((g) =>
        g.grantType === 'project.admin' && (
          (g.subjectType === 'user' && g.subjectId === session.userId)
          || (g.subjectType === 'team' && myTeamIds.has(g.subjectId))
        ),
      );
    });
  const canManageAnyProject = manageableGrantsPerProject.length > 0;

  return (
    <AppShell username={session.username} displayName={session.displayName} userProjects={[...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((p) => ({ id: p.id, name: p.name, status: p.status }))}>
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-lg font-semibold text-white">{dict.settings.title}</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {session.displayName} · {session.username}
          </p>
        </div>
        <SettingsTabs
          session={session}
          tokens={tokens}
          users={users}
          projects={projects}
          grantsPerProject={manageableGrantsPerProject}
          teams={teams}
          isAdmin={isAdmin}
          isTeamLeader={isTeamLeader}
          canManageAnyProject={canManageAnyProject}
        />
      </main>
    </AppShell>
  );
}
