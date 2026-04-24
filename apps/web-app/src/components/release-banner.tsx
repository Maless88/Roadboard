'use client';

import { useEffect, useState } from 'react';
import { useDict } from '@/lib/i18n/locale-context';
import { formatBuildLabel } from '@/lib/build-label';


const POLL_INTERVAL_MS = 60_000;


interface ReleaseStatus {
  currentSha: string;
  latestMainSha: string | null;
  latestMainAt: string | null;
  hasPending: boolean;
  deploying: boolean;
  lastDeployError: string | null;
}


async function fetchReleaseStatus(): Promise<ReleaseStatus | null> {

  try {
    const res = await fetch('/api/release-status', { cache: 'no-store' });

    if (!res.ok) return null;

    return (await res.json()) as ReleaseStatus;
  } catch {
    return null;
  }
}


export function ReleaseBanner() {

  const dict = useDict();
  const [status, setStatus] = useState<ReleaseStatus | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {

    let cancelled = false;

    async function check() {

      if (document.visibilityState !== 'visible') return;

      const payload = await fetchReleaseStatus();

      if (cancelled || !payload) return;

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

  async function onDeploy() {

    if (status?.deploying) return;

    setError(null);

    try {
      const res = await fetch('/api/deploy', { method: 'POST' });

      if (!res.ok) {
        const text = await res.text();
        setError(text || 'deploy failed');
        return;
      }

      const fresh = await fetchReleaseStatus();

      if (fresh) setStatus(fresh);
    } catch {
      setError('network error');
    }
  }

  if (!status?.hasPending || !status.latestMainSha) return null;

  if (dismissed === status.latestMainSha) return null;

  const fullSha = status.latestMainSha;
  const versionLabel = formatBuildLabel(status.latestMainAt, fullSha);
  const { deploying } = status;
  const errorMsg = error ?? status.lastDeployError;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-1">
      <button
        type="button"
        onClick={onDeploy}
        disabled={deploying}
        title={deploying ? undefined : errorMsg ?? fullSha}
        className="flex items-center gap-2 rounded-full border border-amber-500/60 bg-amber-600/95 px-4 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur transition hover:bg-amber-500 disabled:cursor-wait disabled:opacity-80"
      >
        {errorMsg !== null && !deploying && (
          <span className="text-red-100" aria-hidden>⚠</span>
        )}
        {deploying ? dict.release.deploying : `${dict.release.newVersion} ${versionLabel}`}
      </button>
      <button
        type="button"
        onClick={() => setDismissed(status.latestMainSha)}
        aria-label={dict.release.dismiss}
        className="rounded-full w-6 h-6 flex items-center justify-center text-white/70 hover:text-white hover:bg-amber-600/40"
      >
        ×
      </button>
    </div>
  );
}
