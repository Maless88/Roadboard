'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';


interface AutoRefreshProps {
  intervalMs?: number;
}


export function AutoRefresh({ intervalMs = 30000 }: AutoRefreshProps) {

  const router = useRouter();

  useEffect(() => {

    function refresh() {

      if (document.visibilityState === 'visible') {
        router.refresh();
      }
    }

    function onVisibility() {

      if (document.visibilityState === 'visible') {
        router.refresh();
      }
    }

    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisibility);

    const id = window.setInterval(refresh, intervalMs);

    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(id);
    };
  }, [router, intervalMs]);

  return null;
}
