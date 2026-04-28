import Link from 'next/link';
import { getToken } from '@/lib/auth';
import { getDict } from '@/lib/i18n';
import {
  validateSession,
  getTeamInviteByToken,
  type TeamInviteWithTeam,
  type SessionInfo,
} from '@/lib/api';
import { AcceptInviteAction } from './accept-action';


interface Props {
  params: Promise<{ token: string }>;
}


export default async function InvitePage({ params }: Props) {

  const { token: inviteToken } = await params;
  const dict = await getDict();
  const sessionToken = await getToken();
  const session: SessionInfo | null = sessionToken ? await validateSession(sessionToken) : null;

  let invite: TeamInviteWithTeam | null = null;
  let lookupError: string | null = null;

  try {
    invite = await getTeamInviteByToken(inviteToken);
  } catch (err) {
    lookupError = (err as Error).message;
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--bg)', color: 'var(--text)' }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8"
        style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}
      >
        <h1 className="text-lg font-semibold mb-1">{dict.invites.page.title}</h1>

        {lookupError || !invite ? (
          <p className="text-sm mt-4" style={{ color: 'var(--text-faint)' }}>
            {dict.invites.page.notFound}
          </p>
        ) : (
          <InviteBody
            invite={invite}
            session={session}
            sessionToken={sessionToken}
            dict={dict}
          />
        )}
      </div>
    </main>
  );
}


function InviteBody({
  invite,
  session,
  sessionToken,
  dict,
}: {
  invite: TeamInviteWithTeam;
  session: SessionInfo | null;
  sessionToken: string | null;
  dict: Awaited<ReturnType<typeof getDict>>;
}) {

  if (invite.status === 'accepted') {
    return (
      <p className="text-sm mt-4" style={{ color: 'var(--text-muted)' }}>
        {dict.invites.page.accepted}
      </p>
    );
  }

  if (invite.status === 'revoked') {
    return (
      <p className="text-sm mt-4" style={{ color: 'var(--text-muted)' }}>
        {dict.invites.page.revoked}
      </p>
    );
  }

  if (invite.status === 'expired') {
    return (
      <p className="text-sm mt-4" style={{ color: 'var(--text-muted)' }}>
        {dict.invites.page.expired}
      </p>
    );
  }

  const teamName = invite.team?.name ?? '';

  if (!session || !sessionToken) {
    const loginUrl = `/login?invite=${encodeURIComponent(invite.token)}&email=${encodeURIComponent(invite.email)}`;

    return (
      <>
        <p className="text-sm mt-4" style={{ color: 'var(--text-muted)' }}>
          {dict.invites.page.joinTeam(teamName)}
        </p>
        <p className="text-xs mt-2" style={{ color: 'var(--text-faint)' }}>
          {dict.invites.page.forEmail(invite.email)}
        </p>
        <p className="text-sm mt-6" style={{ color: 'var(--text)' }}>
          {dict.invites.page.loginRequired}
        </p>
        <Link
          href={loginUrl}
          className="inline-block mt-3 text-sm px-4 py-2 rounded font-medium"
          style={{ background: '#6366f1', color: 'white' }}
        >
          {dict.invites.page.goToLogin}
        </Link>
      </>
    );
  }

  if (session.email.toLowerCase() !== invite.email.toLowerCase()) {
    return (
      <>
        <h2 className="text-sm font-semibold mt-4">{dict.invites.page.mismatchTitle}</h2>
        <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
          {dict.invites.page.mismatchBody(invite.email)}
        </p>
        <Link
          href={`/logout?next=${encodeURIComponent(`/invite/${invite.token}`)}`}
          className="inline-block mt-4 text-sm px-4 py-2 rounded"
          style={{ background: 'var(--surface-overlay)', color: 'var(--text)', border: '1px solid var(--border)' }}
        >
          {dict.invites.page.logoutAndLogin}
        </Link>
      </>
    );
  }

  return (
    <>
      <p className="text-sm mt-4" style={{ color: 'var(--text-muted)' }}>
        {dict.invites.page.joinTeam(teamName)}
      </p>
      <p className="text-xs mt-2" style={{ color: 'var(--text-faint)' }}>
        {dict.invites.page.forEmail(invite.email)}
      </p>
      <AcceptInviteAction inviteToken={invite.token} sessionToken={sessionToken} />
    </>
  );
}
