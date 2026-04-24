'use client';

import Link from 'next/link';
import { useRef, useState, useEffect } from 'react';
import { logoutAction } from '@/app/actions';
import { useDict } from '@/lib/i18n/locale-context';
import { LanguageSwitcher } from './language-switcher';
import { ThemeToggle } from './theme-toggle';
import { formatBuildLabel } from '@/lib/build-label';
import type { Locale } from '@/lib/i18n';


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
  const [menuOpen, setMenuOpen] = useState(false);
  const [projectSwitcherOpen, setProjectSwitcherOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const switcherRef = useRef<HTMLDivElement>(null);

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
    <aside
      className="w-52 shrink-0 flex flex-col h-screen sticky top-0 overflow-hidden"
      style={{
        background: 'var(--surface-strong)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRight: '1px solid var(--border-soft)',
      }}
    >
      {/* Logo */}
      <Link
        href="/dashboard"
        className="px-4 py-4 flex items-center gap-2.5 hover:bg-white/5 transition-colors"
        style={{ borderBottom: '1px solid var(--border-soft)' }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg,#6366f1,#818cf8)' }}
        >
          <span className="text-xs font-black text-white">R</span>
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-sm font-bold text-white tracking-tight">RoadBoard</span>
          <span className="text-[10px] text-indigo-400 font-mono" title={process.env.NEXT_PUBLIC_BUILD_SHA ?? 'unknown'}>
            {formatBuildLabel(process.env.NEXT_PUBLIC_BUILD_TIME)}
          </span>
        </div>
      </Link>

      {/* Nav principale */}
      <nav className="flex-1 px-2 py-4 flex flex-col gap-0.5 overflow-y-auto">

        {/* Progetto attivo + switcher */}
        {activeProject && (
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
      </nav>

      {/* Footer */}
      <div className="px-2 py-3 space-y-0.5" style={{ borderTop: '1px solid var(--border-soft)' }}>

        {/* User menu */}
        <div ref={menuRef} className="relative mt-1">

          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors hover:bg-white/5"
            style={{ background: menuOpen ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.03)' }}
          >
            <div
              className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#6366f1,#818cf8)' }}
            >
              {displayName.charAt(0).toUpperCase()}
            </div>
            <span className="text-xs text-gray-400 flex-1 truncate text-left">{username}</span>
            <svg
              className="w-3 h-3 text-gray-600 shrink-0 transition-transform"
              style={{ transform: menuOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
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
  );
}


