'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logoutAction } from '@/app/actions';


const PROJECT_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'phases', label: 'Roadmap' },
  { key: 'decisions', label: 'Decisioni' },
  { key: 'memory', label: 'Memory' },
  { key: 'audit', label: 'Audit' },
] as const;


interface ActiveProject {
  id: string;
  name: string;
  taskDone: number;
  taskTotal: number;
}


interface SidebarProps {
  username: string;
  displayName: string;
  activeProject?: ActiveProject;
}


export function Sidebar({ username, displayName, activeProject }: SidebarProps) {

  const pathname = usePathname();

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  const currentTab = (() => {
    if (!activeProject) return null;
    const url = new URL(typeof window !== 'undefined' ? window.location.href : 'http://localhost');
    return url.searchParams.get('tab') ?? 'overview';
  })();

  const pct = activeProject && activeProject.taskTotal > 0
    ? Math.round((activeProject.taskDone / activeProject.taskTotal) * 100)
    : 0;

  return (
    <aside className="w-56 shrink-0 flex flex-col min-h-screen sticky top-0" style={{
      background: 'rgba(17,17,27,0.85)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderRight: '1px solid rgba(255,255,255,0.05)',
    }}>

      {/* Logo */}
      <div className="px-4 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: 'rgba(99,102,241,0.9)' }}>
          <span className="text-xs font-black text-white">R</span>
        </div>
        <span className="text-sm font-bold text-white tracking-tight">RoadBoard</span>
        <span className="text-xs text-indigo-400 font-mono ml-auto">2.0</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">

        {/* Dashboard */}
        <Link
          href="/dashboard"
          className={[
            'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
            isActive('/dashboard')
              ? 'bg-indigo-600/20 text-indigo-300 font-medium'
              : 'text-gray-400 hover:text-white hover:bg-white/5',
          ].join(' ')}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          Dashboard
        </Link>

        {/* Progetti */}
        <Link
          href="/projects"
          className={[
            'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
            isActive('/projects') && !activeProject
              ? 'bg-indigo-600/20 text-indigo-300 font-medium'
              : 'text-gray-400 hover:text-white hover:bg-white/5',
          ].join(' ')}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          Progetti
        </Link>

        {/* Project sub-nav */}
        {activeProject && (
          <div className="ml-1 mt-1 rounded-lg overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="px-3 py-2.5">
              <p className="text-xs text-gray-300 font-medium truncate mb-2">{activeProject.name}</p>
              <div className="h-1 rounded-full overflow-hidden mb-1" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#6366f1,#818cf8)' }}
                />
              </div>
              <p className="text-xs text-gray-600">{pct}% · {activeProject.taskDone}/{activeProject.taskTotal}</p>
            </div>
            <div className="px-1 pb-1 space-y-0.5">
              {PROJECT_TABS.map((tab) => {
                const href = `/projects/${activeProject.id}?tab=${tab.key}`;
                const active = currentTab === tab.key;

                return (
                  <Link
                    key={tab.key}
                    href={href}
                    className={[
                      'block px-3 py-1.5 rounded-md text-xs transition-colors',
                      active
                        ? 'bg-indigo-600/20 text-indigo-300'
                        : 'text-gray-500 hover:text-white hover:bg-white/5',
                    ].join(' ')}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="px-2 py-3 space-y-0.5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <Link
          href="/settings"
          className={[
            'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
            isActive('/settings')
              ? 'bg-indigo-600/20 text-indigo-300 font-medium'
              : 'text-gray-400 hover:text-white hover:bg-white/5',
          ].join(' ')}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Settings
        </Link>

        <div className="flex items-center gap-2.5 px-3 py-2 mt-1">
          <div className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white" style={{ background: 'rgba(99,102,241,0.8)' }}>
            {displayName.charAt(0).toUpperCase()}
          </div>
          <span className="text-xs text-gray-300 flex-1 truncate">{username}</span>
          <form action={logoutAction}>
            <button type="submit" className="text-xs text-gray-600 hover:text-gray-300 transition-colors" title="Sign out">
              ↩
            </button>
          </form>
        </div>
      </div>

    </aside>
  );
}
