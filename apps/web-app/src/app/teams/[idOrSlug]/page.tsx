import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getToken } from '@/lib/auth';
import { getDict } from '@/lib/i18n';
import {
  validateSession,
  getTeam,
  listMemberships,
  listProjects,
} from '@/lib/api';
import { AppShell } from '@/components/app-shell';


const PROJECT_STATUS_COLOR: Record<string, string> = {
  active: 'bg-green-500/10 text-green-400',
  draft: 'bg-gray-500/10 text-gray-400',
  paused: 'bg-yellow-500/10 text-yellow-400',
  completed: 'bg-blue-500/10 text-blue-400',
  archived: 'bg-gray-500/[0.07] text-gray-500',
};


const ROLE_COLOR: Record<string, string> = {
  admin: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  member: 'text-green-400 bg-green-500/10 border-green-500/20',
};


interface Props {
  params: Promise<{ idOrSlug: string }>;
}


export default async function TeamPage({ params }: Props) {

  const { idOrSlug } = await params;
  const token = await getToken();

  if (!token) redirect('/login');

  const [session, dict] = await Promise.all([validateSession(token), getDict()]);

  if (!session) redirect('/login');

  let team;

  try {
    team = await getTeam(token, idOrSlug);
  } catch {
    notFound();
  }

  const [memberships, allProjects] = await Promise.all([
    listMemberships(token, team.id).catch(() => []),
    listProjects(token).catch(() => []),
  ]);

  const teamProjects = allProjects.filter((p) => p.ownerTeamId === team.id);

  return (
    <AppShell
      username={session.username}
      displayName={session.displayName}
      userProjects={[...allProjects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((p) => ({ id: p.id, name: p.name, status: p.status }))}
    >
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Link
          href="/settings"
          className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
        >
          {dict.teamPage.backLink}
        </Link>

        <div className="mt-2 mb-8">
          <h1 className="text-lg font-semibold text-white">{team.name}</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            <span className="font-mono">{team.slug}</span>
            {' · '}
            {dict.teamPage.membersCount(memberships.length)}
            {' · '}
            {dict.teamPage.projectsCount(teamProjects.length)}
          </p>
          {team.description && (
            <p className="text-sm text-gray-400 mt-3">{team.description}</p>
          )}
        </div>

        <section className="mb-8">
          <h2 className="text-sm font-semibold text-white mb-3">{dict.teamPage.members}</h2>

          {memberships.length === 0 ? (
            <p className="text-sm text-gray-500">{dict.teamPage.noMembers}</p>
          ) : (
            <div
              className="rounded-xl overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              {memberships.map((m, i) => {
                const roleCls = ROLE_COLOR[m.role] ?? ROLE_COLOR.member;

                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between px-4 py-3"
                    style={{ borderBottom: i === memberships.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.05)' }}
                  >
                    <div>
                      <p className="text-sm text-white font-medium">
                        {m.user?.displayName ?? m.userId}
                      </p>
                      {m.user && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          @{m.user.username} · {m.user.email}
                        </p>
                      )}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded border ${roleCls}`}>
                      {m.role}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-sm font-semibold text-white mb-3">{dict.teamPage.projects}</h2>

          {teamProjects.length === 0 ? (
            <p className="text-sm text-gray-500">{dict.teamPage.noProjects}</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {teamProjects.map((p) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="rounded-xl px-4 py-3 transition-colors hover:bg-white/[0.05]"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <span className="text-sm text-white font-medium truncate">{p.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${PROJECT_STATUS_COLOR[p.status] ?? 'bg-gray-700 text-gray-300'}`}>
                      {p.status}
                    </span>
                  </div>
                  {p.description && (
                    <p className="text-xs text-gray-500 line-clamp-2">{p.description}</p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </AppShell>
  );
}
