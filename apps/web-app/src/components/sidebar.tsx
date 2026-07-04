'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef, useState, useEffect } from 'react';
import { logoutAction } from '@/app/actions';
import { useDict } from '@/lib/i18n/locale-context';
import { LanguageSwitcher } from './language-switcher';
import { ThemeToggle } from './theme-toggle';
import { NotificationBell } from './notification-bell';
import { formatBuildLabel } from '@/lib/build-label';
import type { Locale } from '@/lib/i18n';
import { isLifeOsUser } from '@/lib/access';


interface ActiveProject {
  id: string;
  name: string;
  taskDone: number;
  taskTotal: number;
}

interface UserProject {
  id: string;
  name: string;
  status: string;
}


interface SidebarProps {
  username: string;
  displayName: string;
  activeProject?: ActiveProject;
  userProjects?: UserProject[];
  locale: Locale;
}

const STATUS_DOT: Record<string, string> = {
  active: 'bg-green-400',
  paused: 'bg-yellow-400',
  draft: 'bg-gray-500',
  completed: 'bg-indigo-400',
  archived: 'bg-gray-700',
};


export function Sidebar({ username, displayName, activeProject, userProjects = [], locale }: SidebarProps) {

  const dict = useDict();
  const showLifeOs = isLifeOsUser({ username });
  const [menuOpen, setMenuOpen] = useState(false);
  const [projectSwitcherOpen, setProjectSwitcherOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const switcherRef = useRef<HTMLDivElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  // load/persist the collapsed state (desktop)
  useEffect(() => {
    try { setCollapsed(localStorage.getItem("rb.sidebar.collapsed") === "1"); } catch { /* ignore */ }
  }, []);
  const toggleCollapsed = () => setCollapsed((c) => { const n = !c; try { localStorage.setItem("rb.sidebar.collapsed", n ? "1" : "0"); } catch { /* ignore */ } return n; });

  // close the mobile drawer whenever navigation changes the route
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const pct = activeProject && activeProject.taskTotal > 0
    ? Math.round((activeProject.taskDone / activeProject.taskTotal) * 100)
    : 0;

  useEffect(() => {

    function handleClickOutside(e: MouseEvent) {

      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }

    if (menuOpen) document.addEventListener('mousedown', handleClickOutside);

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  useEffect(() => {

    function handleClickOutside(e: MouseEvent) {

      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setProjectSwitcherOpen(false);
      }
    }

    function handleKey(e: KeyboardEvent) {

      if (e.key === 'Escape') setProjectSwitcherOpen(false);
    }

    if (projectSwitcherOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKey);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [projectSwitcherOpen]);

  return (
    <>
      {/* mobile top bar with hamburger (desktop: hidden) */}
      <div
        className="md:hidden fixed top-0 inset-x-0 z-40 flex items-center gap-2 px-3 h-12"
        style={{
          background: 'var(--surface-strong)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--border-soft)',
        }}
      >
        <button
          type="button"
          aria-label="Menu"
          onClick={() => setMobileOpen(true)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-300 hover:bg-white/5"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="text-sm font-bold text-white tracking-tight">RoadBoard</span>
        <div className="ml-auto"><NotificationBell /></div>
      </div>

      {/* backdrop when drawer open (mobile only) */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileOpen(false)} />
      )}

      <aside
        className={`${mobileOpen ? 'flex fixed inset-y-0 left-0 z-50' : 'hidden'} w-64 shrink-0 flex-col h-screen overflow-hidden md:flex md:sticky md:top-0 md:z-auto transition-[width] duration-200 ${collapsed ? 'md:w-16' : 'md:w-52'}`}
        style={{
        background: 'var(--surface-strong)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRight: '1px solid var(--border-soft)',
      }}
    >
      {/* Logo + collapse toggle */}
      <div className="flex items-center" style={{ borderBottom: '1px solid var(--border-soft)' }}>
        <Link
          href="/dashboard"
          className={`flex flex-1 items-center gap-2.5 py-4 hover:bg-white/5 transition-colors ${collapsed ? 'justify-center px-2' : 'px-4'}`}
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg,#6366f1,#818cf8)' }}
          >
            <span className="text-xs font-black text-white">R</span>
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-none">
              <span className="text-sm font-bold text-white tracking-tight">RoadBoard</span>
              <span className="text-[10px] text-indigo-400 font-mono" title={process.env.NEXT_PUBLIC_BUILD_SHA ?? 'unknown'}>
                {formatBuildLabel(process.env.NEXT_PUBLIC_BUILD_TIME)}
              </span>
            </div>
          )}
        </Link>
        {!collapsed && (
          <div className="hidden md:block mr-1"><NotificationBell /></div>
        )}
        {!collapsed && (
          <button type="button" aria-label="Comprimi sidebar" onClick={toggleCollapsed}
            className="hidden md:inline-flex h-8 w-8 mr-2 items-center justify-center rounded-lg text-gray-500 hover:bg-white/5 hover:text-gray-200">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
        )}
      </div>
      {collapsed && (
        <button type="button" aria-label="Espandi sidebar" onClick={toggleCollapsed}
          className="hidden md:inline-flex h-8 w-full items-center justify-center text-gray-500 hover:bg-white/5 hover:text-gray-200" style={{ borderBottom: '1px solid var(--border-soft)' }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      )}

      {/* Nav principale */}
      <nav className="flex-1 px-2 py-4 flex flex-col gap-0.5 overflow-y-auto">

        {/* Progetto attivo + switcher */}
        {activeProject && !collapsed && (
          <div ref={switcherRef} className="relative mt-2 mx-1">
            <button
              type="button"
              onClick={() => setProjectSwitcherOpen((o) => !o)}
              className="w-full rounded-xl p-3 text-left transition-colors hover:bg-indigo-500/10"
              style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.15)' }}
            >
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <span className="text-xs font-semibold text-indigo-300 truncate">
                  {activeProject.name}
                </span>
                <svg
                  className="w-3 h-3 text-indigo-300/70 shrink-0 transition-transform"
                  style={{ transform: projectSwitcherOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              <div className="h-1 rounded-full overflow-hidden mb-1.5" style={{ background: 'rgba(255,255,255,0.07)' }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#6366f1,#818cf8)', transition: 'width 0.7s ease' }}
                />
              </div>

              <div className="flex justify-between text-[10px] text-gray-600">
                <span>{pct}% {dict.nav.completed}</span>
                <span>{activeProject.taskDone}/{activeProject.taskTotal}</span>
              </div>
            </button>

            {projectSwitcherOpen && (
              <div
                className="absolute top-full mt-1.5 left-0 right-0 rounded-xl overflow-hidden z-50 max-h-80 overflow-y-auto"
                style={{
                  background: 'var(--surface-overlay)',
                  border: '1px solid var(--border)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  boxShadow: 'var(--shadow-card), 0 8px 32px rgba(0,0,0,0.18)',
                }}
              >
                <div className="px-3 pt-2.5 pb-1.5">
                  <p className="text-[10px] font-mono text-gray-600 uppercase tracking-wider mb-1.5">
                    {dict.nav.myProjects}
                  </p>
                  {userProjects.length === 0 ? (
                    <p className="text-xs text-gray-600 py-1">{dict.nav.noProjects}</p>
                  ) : (
                    <ul className="space-y-0.5">
                      {userProjects.map((p) => {

                        const isCurrent = p.id === activeProject.id;

                        return (
                          <li key={p.id}>
                            <Link
                              href={`/projects/${p.id}`}
                              onClick={() => setProjectSwitcherOpen(false)}
                              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                                isCurrent
                                  ? 'bg-indigo-500/15 text-indigo-200'
                                  : 'text-gray-300 hover:text-white hover:bg-white/5'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[p.status] ?? 'bg-gray-500'}`} />
                              <span className="truncate flex-1">{p.name}</span>
                              {isCurrent && (
                                <svg className="w-3 h-3 text-indigo-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        {/* Navigazione principale */}
        <div className="mt-3 px-1">
          {showLifeOs && (<>
          {!collapsed && <p className="px-2 mb-1 text-[10px] font-mono text-gray-600 uppercase tracking-wider">Navigazione</p>}
          <Link href="/home" title="Home"
            className={`flex items-center gap-2.5 py-2 rounded-lg text-xs transition-colors hover:text-white hover:bg-white/5 ${pathname === '/home' ? 'text-white bg-white/5' : 'text-gray-400'} ${collapsed ? 'justify-center px-0' : 'px-3'}`}>
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l9-9 9 9M5 10v10h14V10" />
            </svg>
            {!collapsed && <span>Home</span>}
          </Link>
          <Link href="/chatboard" title="Chat"
            className={`flex items-center gap-2.5 py-2 rounded-lg text-xs transition-colors hover:text-white hover:bg-white/5 ${pathname === '/chatboard' ? 'text-white bg-white/5' : 'text-gray-400'} ${collapsed ? 'justify-center px-0' : 'px-3'}`}>
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.5A8 8 0 1 1 21 12z" />
            </svg>
            {!collapsed && <span>Chat</span>}
          </Link>
          <Link href="/agent-office" title="Agenti & Sistema"
            className={`flex items-center gap-2.5 py-2 rounded-lg text-xs transition-colors hover:text-white hover:bg-white/5 ${pathname === '/agent-office' ? 'text-white bg-white/5' : 'text-gray-400'} ${collapsed ? 'justify-center px-0' : 'px-3'}`}>
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3.5 20a5.5 5.5 0 0 1 11 0M16 11.5a2.5 2.5 0 1 0 0-5M15 20a5 5 0 0 1 6-4.6" />
            </svg>
            {!collapsed && <span>Agenti &amp; Sistema</span>}
          </Link>
          <Link href="/scheduling" title="Agenda"
            className={`flex items-center gap-2.5 py-2 rounded-lg text-xs transition-colors hover:text-white hover:bg-white/5 ${pathname === '/scheduling' ? 'text-white bg-white/5' : 'text-gray-400'} ${collapsed ? 'justify-center px-0' : 'px-3'}`}>
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            {!collapsed && <span>Agenda</span>}
          </Link>
          <Link href="/notifications" title="Notifiche"
            className={`flex items-center gap-2.5 py-2 rounded-lg text-xs transition-colors hover:text-white hover:bg-white/5 ${pathname === '/notifications' ? 'text-white bg-white/5' : 'text-gray-400'} ${collapsed ? 'justify-center px-0' : 'px-3'}`}>
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9" />
            </svg>
            {!collapsed && <span>Notifiche</span>}
          </Link>
          </>)}
        </div>

      </nav>

      {/* Footer */}
      <div className="px-2 py-3 space-y-0.5" style={{ borderTop: '1px solid var(--border-soft)' }}>

        {/* Guida (secondaria, in fondo) */}
        {showLifeOs && (
        <Link href="/guida" title="Guida"
          className={`flex items-center gap-2.5 py-2 rounded-lg text-xs transition-colors hover:text-white hover:bg-white/5 ${pathname === '/guida' ? 'text-white bg-white/5' : 'text-gray-400'} ${collapsed ? 'justify-center px-0' : 'px-3'}`}>
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          {!collapsed && <span>Guida</span>}
        </Link>
        )}

        {/* User menu */}
        <div ref={menuRef} className="relative mt-1">

          <button
            onClick={() => setMenuOpen((o) => !o)}
            className={`w-full flex items-center gap-2.5 py-2 rounded-lg transition-colors hover:bg-white/5 ${collapsed ? 'justify-center px-0' : 'px-3'}`}
            style={{ background: menuOpen ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.03)' }}
          >
            <div
              className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#6366f1,#818cf8)' }}
            >
              {displayName.charAt(0).toUpperCase()}
            </div>
            {!collapsed && <span className="text-xs text-gray-400 flex-1 truncate text-left">{username}</span>}
            {!collapsed && (
            <svg
              className="w-3 h-3 text-gray-600 shrink-0 transition-transform"
              style={{ transform: menuOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
            )}
          </button>

          {/* Dropdown */}
          {menuOpen && (
            <div
              className="absolute bottom-full mb-2 left-0 right-0 rounded-xl overflow-hidden z-50"
              style={{
                background: 'var(--surface-overlay)',
                border: '1px solid var(--border)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                boxShadow: 'var(--shadow-card), 0 -8px 32px rgba(0,0,0,0.18)',
              }}
            >
              <div className="px-2 py-1.5 space-y-0.5">
                <LanguageSwitcher currentLocale={locale} />
                <ThemeToggle />

                <Link
                  href="/settings"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {dict.nav.settings}
                </Link>

                <form action={logoutAction}>
                  <button
                    type="submit"
                    className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    {dict.nav.signOut}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
    </>
  );
}


