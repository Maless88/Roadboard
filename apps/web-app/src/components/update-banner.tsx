'use client';

import { useEffect, useRef, useState } from 'react';
import { useDict } from '@/lib/i18n/locale-context';


const POLL_INTERVAL_MS = 60_000;


interface VersionPayload {
  sha: string;
  builtAt: string;
  service: string;
}


async function fetchVersion(): Promise<VersionPayload | null> {

  try {
    const res = await fetch('/api/version', { cache: 'no-store' });

    if (!res.ok) {
      return null;
    }

    return (await res.json()) as VersionPayload;
  } catch {
    return null;
  }
}


export function UpdateBanner() {

  const dict = useDict();
  const initialShaRef = useRef<string | null>(null);
  const [newShaAvailable, setNewShaAvailable] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {

    let cancelled = false;

    async function check() {

      if (document.visibilityState !== 'visible') {
        return;
      }

      const payload = await fetchVersion();

      if (cancelled || !payload || payload.sha === 'unknown') {
        return;
      }

      if (initialShaRef.current === null) {
        initialShaRef.current = payload.sha;
        return;
      }

      if (payload.sha !== initialShaRef.current) {
        setNewShaAvailable((prev) => {

          if (prev !== payload.sha) {
            setDismissed(false);
          }

          return payload.sha;
        });
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

  if (!newShaAvailable || dismissed) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-lg border border-indigo-500/40 bg-indigo-600/90 px-4 py-3 text-sm text-white shadow-lg backdrop-blur">
      <span>{dict.update.available}</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-md bg-white px-3 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
      >
        {dict.update.reload}
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label={dict.update.dismiss}
        className="text-white/70 hover:text-white"
      >
        ×
      </button>
    </div>
  );
}
