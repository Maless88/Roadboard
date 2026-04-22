'use client';

import { useEffect, useState } from 'react';
import { useDict } from '@/lib/i18n/locale-context';


const POLL_INTERVAL_MS = 60_000;


interface ReleaseStatus {
  current: string;
  pending: { sha: string; at: string } | null;
  hasPending: boolean;
  deployUrl: string;
}


async function fetchReleaseStatus(): Promise<ReleaseStatus | null> {

  try {
    const res = await fetch('/api/release-status', { cache: 'no-store' });

    if (!res.ok) {
      return null;
    }

    return (await res.json()) as ReleaseStatus;
  } catch {
    return null;
  }
}


export function ReleaseBanner() {

  const dict = useDict();
  const [status, setStatus] = useState<ReleaseStatus | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {

    let cancelled = false;

    async function check() {

      if (document.visibilityState !== 'visible') {
        return;
      }

      const payload = await fetchReleaseStatus();

      if (cancelled || !payload) {
        return;
      }

      setStatus(payload);
    }

    void check();
    const id = window.setInterval(check, POLL_INTERVAL_MS);
    window.addEventListener('focus', check);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener('focus', check);
    };
  }, []);

  if (!status?.hasPending || !status.pending) {
    return null;
  }

  if (dismissed === status.pending.sha) {
    return null;
  }

  const shortSha = status.pending.sha.slice(0, 7);

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-3 rounded-lg border border-amber-500/50 bg-amber-600/90 px-4 py-3 text-sm text-white shadow-lg backdrop-blur">
      <span>
        {dict.release.pending} <code className="font-mono text-xs opacity-80">{shortSha}</code>
      </span>
      <a
        href={status.deployUrl}
        target="_blank"
        rel="noreferrer"
        className="rounded-md bg-white px-3 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50"
      >
        {dict.release.deploy}
      </a>
      <button
        type="button"
        onClick={() => setDismissed(status.pending!.sha)}
        aria-label={dict.release.dismiss}
        className="text-white/70 hover:text-white"
      >
        ×
      </button>
    </div>
  );
}
