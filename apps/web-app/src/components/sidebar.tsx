'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logoutAction } from '@/app/actions';


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

  const pct = activeProject && activeProject.taskTotal > 0
    ? Math.round((activeProject.taskDone / activeProject.taskTotal) * 100)
    : 0;

  return (
    <aside
      className="w-52 shrink-0 flex flex-col min-h-screen sticky top-0"
      style={{
        background: 'rgba(13,13,20,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      {/* Logo */}
      <div className="px-4 py-4 flex items-center gap-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg,#6366f1,#818cf8)' }}
        >
          <span className="text-xs font-black text-white">R</span>
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-sm font-bold text-white tracking-tight">RoadBoard</span>
          <span className="text-[10px] text-indigo-400 font-mono">2.0</span>
        </div>
      </div>

      {/* Nav principale */}
      <nav className="flex-1 px-2 py-4 flex flex-col gap-0.5 overflow-y-auto">

        <NavItem
          href="/dashboard"
          active={isActive('/dashboard')}
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10-3a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1v-7z" />
            </svg>
          }
        >
          Dashboard
        </NavItem>

        <NavItem
          href="/projects"
          active={isActive('/projects') && !activeProject}
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          }
        >
          Progetti
        </NavItem>

        {/* Progetto attivo — solo contesto, niente tab */}
        {activeProject && (
          <div
            className="mt-2 mx-1 rounded-xl p-3"
            style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.15)' }}
          >
            <Link
              href={`/projects/${activeProject.id}`}
              className="block text-xs font-semibold text-indigo-300 truncate mb-2.5 hover:text-indigo-200 transition-colors"
            >
              {activeProject.name}
            </Link>

            <div className="h-1 rounded-full overflow-hidden mb-1.5" style={{ background: 'rgba(255,255,255,0.07)' }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#6366f1,#818cf8)', transition: 'width 0.7s ease' }}
              />
            </div>

            <div className="flex justify-between text-[10px] text-gray-600">
              <span>{pct}% completato</span>
              <span>{activeProject.taskDone}/{activeProject.taskTotal}</span>
            </div>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="px-2 py-3 space-y-0.5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <NavItem
          href="/settings"
          active={isActive('/settings')}
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        >
          Impostazioni
        </NavItem>

        {/* User */}
        <div className="flex items-center gap-2.5 px-3 py-2 mt-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <div
            className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white"
            style={{ background: 'linear-gradient(135deg,#6366f1,#818cf8)' }}
          >
            {displayName.charAt(0).toUpperCase()}
          </div>
          <span className="text-xs text-gray-400 flex-1 truncate">{username}</span>
          <form action={logoutAction}>
            <button
              type="submit"
              title="Esci"
              className="text-gray-600 hover:text-gray-300 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}


function NavItem({
  href, active, icon, children,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {

  return (
    <Link
      href={href}
      className={[
        'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
        active
          ? 'bg-indigo-600/20 text-indigo-300 font-medium'
          : 'text-gray-500 hover:text-white hover:bg-white/5',
      ].join(' ')}
    >
      {icon}
      {children}
    </Link>
  );
}
