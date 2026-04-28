'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useDict } from '@/lib/i18n/locale-context';
import {
  createTeamInvite,
  revokeTeamInvite,
  type TeamInvite,
} from '@/lib/api';


type Props = {
  token: string;
  teamId: string;
  invites: TeamInvite[];
  isAdmin: boolean;
  origin: string;
};


const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  accepted: 'bg-green-500/10 text-green-400 border-green-500/20',
  revoked: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
  expired: 'bg-red-500/10 text-red-400 border-red-500/20',
};


function daysUntil(date: string): number {

  const ms = new Date(date).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}


export function InvitesSection({ token, teamId, invites, isAdmin, origin }: Props) {

  const dict = useDict();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const sortedInvites = [...invites].sort((a, b) => {
    const order = { pending: 0, accepted: 1, expired: 2, revoked: 3 } as Record<string, number>;
    const da = order[a.status] ?? 9;
    const db = order[b.status] ?? 9;
    if (da !== db) return da - db;
    return b.createdAt.localeCompare(a.createdAt);
  });


  async function handleCreate(e: React.FormEvent) {

    e.preventDefault();
    setError(null);

    try {
      await createTeamInvite(token, teamId, { email, role });
      setEmail('');
      startTransition(() => router.refresh());
    } catch (err) {
      setError((err as Error).message);
    }
  }


  async function handleRevoke(inviteId: string) {

    if (!window.confirm(dict.invites.confirmRevoke)) return;

    try {
      await revokeTeamInvite(token, inviteId);
      startTransition(() => router.refresh());
    } catch (err) {
      setError((err as Error).message);
    }
  }


  async function handleCopy(invite: TeamInvite) {

    const link = `${origin}/invite/${invite.token}`;
    await navigator.clipboard.writeText(link);
    setCopiedId(invite.id);
    setTimeout(() => setCopiedId(null), 1500);
  }


  return (
    <section className="mb-8">
      <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>
        {dict.invites.pendingTitle}
      </h2>

      {sortedInvites.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-faint)' }}>
          {dict.invites.pendingEmpty}
        </p>
      ) : (
        <div
          className="rounded-xl overflow-hidden mb-4"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          {sortedInvites.map((inv, i) => {
            const cls = STATUS_COLOR[inv.status] ?? STATUS_COLOR.pending;
            const days = daysUntil(inv.expiresAt);
            const statusLabel =
              inv.status === 'pending' ? dict.invites.statusPending
              : inv.status === 'accepted' ? dict.invites.statusAccepted
              : inv.status === 'revoked' ? dict.invites.statusRevoked
              : dict.invites.statusExpired;

            return (
              <div
                key={inv.id}
                className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap"
                style={{ borderBottom: i === sortedInvites.length - 1 ? 'none' : '1px solid var(--border-soft)' }}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                    {inv.email}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>
                    {inv.role}
                    {inv.invitedBy ? ` · ${dict.invites.invitedBy(inv.invitedBy.displayName)}` : ''}
                    {inv.status === 'pending' ? ` · ${dict.invites.expiresIn(days)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded border ${cls}`}>
                    {statusLabel}
                  </span>
                  {inv.status === 'pending' && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleCopy(inv)}
                        className="text-xs px-2 py-1 rounded transition-colors"
                        style={{ background: 'var(--surface-overlay)', color: 'var(--text)', border: '1px solid var(--border)' }}
                      >
                        {copiedId === inv.id ? dict.invites.copied : dict.invites.copyLink}
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleRevoke(inv.id)}
                          className="text-xs px-2 py-1 rounded transition-colors"
                          style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
                        >
                          {dict.invites.revoke}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isAdmin ? (
        <form
          onSubmit={handleCreate}
          className="rounded-xl p-4"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>
            {dict.invites.inviteTitle}
          </h3>
          <div className="flex flex-wrap gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={dict.invites.emailPlaceholder}
              className="flex-1 min-w-[200px] text-sm px-3 py-2 rounded"
              style={{ background: 'var(--surface-overlay)', color: 'var(--text)', border: '1px solid var(--border)' }}
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="text-sm px-3 py-2 rounded"
              style={{ background: 'var(--surface-overlay)', color: 'var(--text)', border: '1px solid var(--border)' }}
            >
              <option value="member">{dict.invites.roleMember}</option>
              <option value="admin">{dict.invites.roleAdmin}</option>
            </select>
            <button
              type="submit"
              disabled={isPending}
              className="text-sm px-4 py-2 rounded font-medium transition-colors"
              style={{ background: '#6366f1', color: 'white', opacity: isPending ? 0.6 : 1 }}
            >
              {isPending ? dict.invites.sending : dict.invites.sendButton}
            </button>
          </div>
          {error && (
            <p
              className="text-xs mt-2 px-3 py-2 rounded"
              style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              {error}
            </p>
          )}
        </form>
      ) : (
        <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
          {dict.invites.onlyAdminCanInvite}
        </p>
      )}
    </section>
  );
}
