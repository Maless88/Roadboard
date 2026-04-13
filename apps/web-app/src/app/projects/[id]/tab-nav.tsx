'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';


const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'phases', label: 'Fasi' },
  { key: 'decisions', label: 'Decisioni' },
  { key: 'memory', label: 'Memory' },
] as const;


interface TabNavProps {
  activeTab: string;
}


export function TabNav({ activeTab }: TabNavProps) {

  const pathname = usePathname();

  return (
    <nav className="flex gap-1 border-b border-gray-800 mb-6">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;

        return (
          <Link
            key={tab.key}
            href={`${pathname}?tab=${tab.key}`}
            className={[
              'px-3 py-2 text-xs font-medium rounded-t transition-colors',
              isActive
                ? 'text-white border-b-2 border-indigo-500 -mb-px'
                : 'text-gray-500 hover:text-gray-300',
            ].join(' ')}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
