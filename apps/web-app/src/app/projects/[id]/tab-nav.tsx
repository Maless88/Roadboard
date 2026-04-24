'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useDict } from '@/lib/i18n/locale-context';


interface TabNavProps {
  activeTab: string;
}


export function TabNav({ activeTab }: TabNavProps) {

  const dict = useDict();
  const pathname = usePathname();

  const TABS = [
    { key: 'phases', label: dict.tabs.phases },
    { key: 'tasks', label: dict.tabs.tasks },
    { key: 'decisions', label: dict.tabs.decisions },
    { key: 'memory', label: dict.tabs.memory },
    { key: 'codeflow', label: dict.tabs.codeflow },
    { key: 'activity', label: dict.tabs.activity },
    { key: 'contributors', label: dict.tabs.contributors },
  ] as const;

  return (
    <nav className="flex gap-1 border-b mb-6" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
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
