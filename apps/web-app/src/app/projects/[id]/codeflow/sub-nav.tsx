'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useDict } from '@/lib/i18n/locale-context';


interface SubNavProps {
  activeView: string;
}


export function CodeflowSubNav({ activeView }: SubNavProps) {

  const dict = useDict();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const VIEWS = [
    { key: 'map', label: dict.codeflow.subNav.map },
    { key: 'impact', label: dict.codeflow.subNav.impact },
    { key: 'decisionGraph', label: dict.codeflow.subNav.decisionGraph },
    { key: 'agentContext', label: dict.codeflow.subNav.agentContext },
  ] as const;

  const buildHref = (view: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', 'codeflow');
    params.set('cf', view);
    return `${pathname}?${params.toString()}`;
  };

  return (
    <nav
      className="flex gap-1 rounded-lg p-1 mb-4 w-fit"
      style={{ background: 'var(--surface)', border: '1px solid var(--border-soft)' }}
    >
      {VIEWS.map((view) => {
        const isActive = activeView === view.key;

        return (
          <Link
            key={view.key}
            href={buildHref(view.key)}
            className={[
              'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
              isActive
                ? 'bg-indigo-500/20 text-indigo-300'
                : 'text-gray-500 hover:text-gray-300',
            ].join(' ')}
          >
            {view.label}
          </Link>
        );
      })}
    </nav>
  );
}
