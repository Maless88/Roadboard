'use client';

import { useEffect, useState } from 'react';
import { useDict } from '@/lib/i18n/locale-context';
import { formatBuildLabel } from '@/lib/build-label';


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
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      if (!payload.hasPending) {
        setDeploying(false);
      }
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

  async function onDeploy() {

    setError(null);
    setDeploying(true);

    try {
      const res = await fetch('/api/deploy', { method: 'POST' });

      if (!res.ok) {
        const text = await res.text();
        setError(text || 'deploy failed');
        setDeploying(false);
      }
    } catch {
      setError('network error');
      setDeploying(false);
    }
  }

  if (!status?.hasPending || !status.pending) {
    return null;
  }

  if (dismissed === status.pending.sha) {
    return null;
  }

  const fullSha = status.pending.sha;
  const versionLabel = formatBuildLabel(status.pending.at);

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-3 rounded-lg border border-amber-500/50 bg-amber-600/90 px-4 py-3 text-sm text-white shadow-lg backdrop-blur">
      <span title={fullSha}>
        {dict.release.pending} <code className="font-mono text-xs opacity-80">{versionLabel}</code>
      </span>
      <button
        type="button"
        onClick={onDeploy}
        disabled={deploying}
        className="rounded-md bg-white px-3 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {deploying ? dict.release.deploying : dict.release.deploy}
      </button>
      {error !== null ? (
        <span className="text-xs text-red-100" title={error}>⚠</span>
      ) : null}
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
