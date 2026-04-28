'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDict } from '@/lib/i18n/locale-context';
import { acceptTeamInvite } from '@/lib/api';


type Props = {
  inviteToken: string;
  sessionToken: string;
};


export function AcceptInviteAction({ inviteToken, sessionToken }: Props) {

  const dict = useDict();
  const router = useRouter();
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);


  async function handleAccept() {

    setAccepting(true);
    setError(null);

    try {
      await acceptTeamInvite(sessionToken, inviteToken);
      setSuccess(true);
    } catch (err) {
      setError((err as Error).message);
      setAccepting(false);
    }
  }


  if (success) {
    return (
      <div className="mt-6">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
          {dict.invites.page.successTitle}
        </h2>
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="mt-3 text-sm px-4 py-2 rounded font-medium"
          style={{ background: '#6366f1', color: 'white' }}
        >
          {dict.invites.page.successCta}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={handleAccept}
        disabled={accepting}
        className="text-sm px-4 py-2 rounded font-medium"
        style={{ background: '#6366f1', color: 'white', opacity: accepting ? 0.6 : 1 }}
      >
        {accepting ? dict.invites.page.accepting : dict.invites.page.acceptButton}
      </button>
      {error && (
        <p
          className="text-xs mt-3 px-3 py-2 rounded"
          style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
