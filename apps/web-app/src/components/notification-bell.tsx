'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface Notif {
  id: string;
  agent_slug: string;
  title: string;
  body: string;
  level: string;
  status: string;
  created_at: string;
  read_at: string | null;
}

const ICON: Record<string, string> = { alert: '🚨', warn: '⚠️', info: '🔔' };

function relTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'ora';
  if (s < 3600) return `${Math.floor(s / 60)} min fa`;
  if (s < 86400) return `${Math.floor(s / 3600)} h fa`;
  return `${Math.floor(s / 86400)} g fa`;
}

export function NotificationBell() {
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 56, left: 8 });
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  // Position the panel with fixed coords measured from the button, so it escapes
  // any `overflow-hidden` ancestor (e.g. the sidebar) in every layout.
  const toggle = useCallback(() => {
    setOpen((o) => {
      if (!o) {
        const r = btnRef.current?.getBoundingClientRect();
        if (r) {
          const w = Math.min(320, window.innerWidth - 16);
          const left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
          setPos({ top: r.bottom + 8, left });
        }
      }
      return !o;
    });
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/notifications?limit=30', { cache: 'no-store' });
      if (!r.ok) return;
      const d = await r.json();
      setItems(Array.isArray(d.items) ? d.items : []);
      setUnread(Number(d.unread) || 0);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const t = e.target as Node;
      if (ref.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const markRead = useCallback(async (ids?: string[]) => {
    // optimistic
    setItems((prev) => prev.map((n) => (!ids || ids.includes(n.id)) ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n));
    setUnread((u) => (ids ? Math.max(0, u - ids.length) : 0));
    try {
      await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ids ? { ids } : {}),
      });
      load();
    } catch { /* ignore */ }
  }, [load]);

  const dismissAll = useCallback(async () => {
    // optimistic: clear the bell (items stay in the /notifications archive)
    setItems([]);
    setUnread(0);
    try {
      await fetch('/api/notifications/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      load();
    } catch { /* ignore */ }
  }, [load]);

  return (
    <div className="relative" ref={ref}>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-label="Notifiche"
        className="relative grid h-9 w-9 place-items-center rounded-lg text-lg text-gray-300 transition hover:bg-white/10 hover:text-white"
      >
        <span>🔔</span>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-[18px] text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && mounted && createPortal((
        <div
          ref={panelRef}
          style={{ top: pos.top, left: pos.left, width: `min(320px, calc(100vw - 16px))` }}
          className="fixed z-[60] overflow-hidden rounded-xl border border-white/10 bg-[#15171c] shadow-2xl"
        >
          <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
            <span className="text-sm font-semibold text-white">Notifiche</span>
            <span className="flex items-center gap-2">
              {unread > 0 && (
                <button type="button" onClick={() => markRead()} className="text-xs text-indigo-300 hover:text-indigo-200">
                  Segna lette
                </button>
              )}
              {items.length > 0 && (
                <button type="button" onClick={dismissAll} className="text-xs text-gray-400 hover:text-white">
                  Pulisci
                </button>
              )}
            </span>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-gray-500">Nessuna notifica</div>
            ) : (
              items.map((n) => {
                const isReminder = n.agent_slug === 'reminder';
                const unreadItem = !n.read_at;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => unreadItem && markRead([n.id])}
                    className={`flex w-full gap-2 border-b border-white/5 px-3 py-2 text-left transition hover:bg-white/5 ${unreadItem ? 'bg-indigo-500/10' : ''}`}
                  >
                    <span className="mt-0.5 shrink-0">{isReminder ? '⏰' : (ICON[n.level] ?? '🔔')}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className={`truncate text-sm ${unreadItem ? 'font-semibold text-white' : 'text-gray-300'}`}>
                          {isReminder ? 'Promemoria' : n.title}
                        </span>
                        <span className="shrink-0 text-[10px] text-gray-500">{relTime(n.created_at)}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-gray-400">
                        {isReminder ? n.title : n.body}
                      </span>
                      {!isReminder && n.agent_slug && (
                        <span className="mt-0.5 block text-[10px] italic text-gray-500">— {n.agent_slug}</span>
                      )}
                    </span>
                  </button>
                );
              })
            )}
          </div>
          <a
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-white/10 px-3 py-2 text-center text-xs font-medium text-indigo-300 hover:bg-white/5"
          >
            Vedi tutte
          </a>
        </div>
      ), document.body)}
    </div>
  );
}
