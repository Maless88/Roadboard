'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

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
type Filter = 'all' | 'unread' | 'reminder';

function fmtAbs(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function NotificationsPage() {
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/notifications?limit=200&scope=all', { cache: 'no-store' });
      if (r.ok) {
        const d = await r.json();
        setItems(Array.isArray(d.items) ? d.items : []);
        setUnread(Number(d.unread) || 0);
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  const markRead = useCallback(async (ids?: string[]) => {
    setItems((prev) => prev.map((n) => (!ids || ids.includes(n.id)) ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n));
    setUnread((u) => (ids ? Math.max(0, u - ids.length) : 0));
    try { await fetch('/api/notifications/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ids ? { ids } : {}) }); load(); } catch { /* ignore */ }
  }, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((n) => {
      if (filter === 'unread' && n.read_at) return false;
      if (filter === 'reminder' && n.agent_slug !== 'reminder') return false;
      if (!needle) return true;
      return [n.title, n.body, n.agent_slug].some((s) => (s || '').toLowerCase().includes(needle));
    });
  }, [items, q, filter]);

  const tabs: { key: Filter; label: string }[] = [
    { key: 'all', label: 'Tutte' },
    { key: 'unread', label: `Non lette${unread ? ` (${unread})` : ''}` },
    { key: 'reminder', label: 'Promemoria' },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-white">Notifiche</h1>
        {unread > 0 && (
          <button type="button" onClick={() => markRead()} className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-indigo-300 hover:bg-white/5">
            Segna tutte lette
          </button>
        )}
      </div>

      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Cerca nelle notifiche…"
        className="mb-3 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-indigo-400/50"
      />

      <div className="mb-4 flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setFilter(t.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${filter === t.key ? 'bg-indigo-500 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10">
        {loading ? (
          <div className="px-4 py-10 text-center text-sm text-gray-500">Caricamento…</div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-gray-500">Nessuna notifica</div>
        ) : (
          filtered.map((n) => {
            const isReminder = n.agent_slug === 'reminder';
            const unreadItem = !n.read_at;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => unreadItem && markRead([n.id])}
                className={`flex w-full gap-3 border-b border-white/5 px-4 py-3 text-left transition hover:bg-white/5 ${unreadItem ? 'bg-indigo-500/10' : ''}`}
              >
                <span className="mt-0.5 shrink-0 text-lg">{isReminder ? '⏰' : (ICON[n.level] ?? '🔔')}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className={`truncate text-sm ${unreadItem ? 'font-semibold text-white' : 'text-gray-300'}`}>
                      {isReminder ? 'Promemoria' : n.title}
                    </span>
                    <span className="shrink-0 text-[11px] text-gray-500">{fmtAbs(n.created_at)}</span>
                  </span>
                  {(isReminder ? n.title : n.body) && (
                    <span className="mt-0.5 block text-xs text-gray-400">{isReminder ? n.title : n.body}</span>
                  )}
                  {!isReminder && n.agent_slug && (
                    <span className="mt-0.5 block text-[11px] italic text-gray-500">— {n.agent_slug}</span>
                  )}
                </span>
                {unreadItem && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-400" />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
