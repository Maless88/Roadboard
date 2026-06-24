"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface Contact { name: string; slug: string; capability: string }
interface Activity { eventType: string; createdAt: string; targetId?: string | null; metadata?: Record<string, unknown> | null }

const AV = "linear-gradient(135deg,#7c5cff,#a06eff)";
const PALETTE = ["#7c5cff", "#22c8b4", "#f59e0b", "#ef4d6f", "#3ccb7f", "#6da8ff", "#b06eff"];
function colorFor(slug: string): string {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
function timeAgo(iso: string): string {
  const d = Date.parse(iso);
  if (!Number.isFinite(d)) return "";
  const s = Math.max(0, Math.round((Date.now() - d) / 1000));
  if (s < 60) return `${s}s fa`;
  if (s < 3600) return `${Math.round(s / 60)}m fa`;
  if (s < 86400) return `${Math.round(s / 3600)}h fa`;
  return `${Math.round(s / 86400)}g fa`;
}

export function HomeClient({ displayName, contacts, activity }: { displayName: string; contacts: Contact[]; activity: Activity[] }) {

  const router = useRouter();
  const agents = useMemo(() => contacts.filter((c) => c.capability !== "routing"), [contacts]);
  const [target, setTarget] = useState("all");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const lastBySlug = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of activity) { const t = e.targetId; if (t && !m.has(t)) m.set(t, e.createdAt); }
    return m;
  }, [activity]);

  const recent = useMemo(() => activity.filter((e) => e.eventType.startsWith("agent.run")).slice(0, 8), [activity]);

  async function dispatch() {
    if (busy) return;
    const body = text.trim();
    setBusy(true);
    try {
      let roomId: string | null = null;
      if (target === "all") {
        const r = await fetch("/api/agents/rooms/workspace", { method: "POST" });
        if (r.ok) roomId = (await r.json()).id;
      } else {
        const r = await fetch("/api/agents/rooms/direct", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agentSlug: target }),
        });
        if (r.ok) roomId = (await r.json()).id;
      }
      if (roomId) {
        const q = new URLSearchParams({ room: roomId });
        if (body) q.set("draft", body);
        router.push(`/chatboard?${q.toString()}`);
      }
    } finally { setBusy(false); }
  }

  async function openAgent(slug: string) {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/agents/rooms/direct", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agentSlug: slug }),
      });
      if (r.ok) { const room = await r.json(); router.push(`/chatboard?room=${room.id}`); }
    } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6">

      <div className="mb-4">
        <p className="text-xs uppercase tracking-wider text-zinc-500">Agenti</p>
        <h1 className="text-xl font-semibold text-zinc-100">Chi lavora nel tuo workspace</h1>
        <p className="text-sm text-zinc-500">Ciao {displayName} — scrivi una richiesta, a tutti o a un agente.</p>
      </div>

      {/* composer */}
      <div className="mb-6 rounded-2xl border border-white/10 bg-zinc-900/50 p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider text-zinc-500">A</span>
          <select value={target} onChange={(e) => setTarget(e.target.value)}
            className="rounded-xl border border-white/10 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-indigo-500/50">
            <option value="all">Tutti gli agenti</option>
            {agents.map((a) => <option key={a.slug} value={a.slug}>{a.name}</option>)}
          </select>
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2}
          placeholder="Es: ricordami che alle 17 ho la call con Gaito, e prepara 2 idee per la live."
          className="w-full resize-none rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500/50" />
        <div className="mt-2 flex justify-end">
          <button onClick={() => void dispatch()} disabled={busy}
            className="rounded-xl px-5 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: AV }}>
            {busy ? "…" : "Invia"}
          </button>
        </div>
      </div>

      {/* agent grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((a) => {
          const last = lastBySlug.get(a.slug);
          return (
            <div key={a.slug} className="flex flex-col rounded-2xl border border-white/10 bg-zinc-900/40 p-4">
              <div className="mb-2 flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: colorFor(a.slug) }}>
                  {a.name[0]?.toUpperCase() ?? "?"}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-100">{a.name}</p>
                  <p className="truncate text-xs text-zinc-500">{a.capability}</p>
                </div>
              </div>
              <p className="mb-3 text-[11px] text-zinc-600">{last ? `Ultima attività ${timeAgo(last)}` : "Nessuna attività"}</p>
              <div className="mt-auto flex gap-2">
                <button onClick={() => void openAgent(a.slug)} disabled={busy}
                  className="flex-1 rounded-xl py-1.5 text-xs font-medium text-white disabled:opacity-50" style={{ background: AV }}>
                  Chat
                </button>
                <a href={`/agents/${a.slug}`} className="rounded-xl border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5">Scheda</a>
              </div>
            </div>
          );
        })}
      </div>

      {/* in lavorazione */}
      <div className="mt-6">
        <p className="mb-2 text-[11px] uppercase tracking-wider text-zinc-500">In lavorazione</p>
        {recent.length === 0 ? (
          <p className="text-xs text-zinc-600">Niente di recente.</p>
        ) : (
          <ul className="space-y-1">
            {recent.map((e, i) => (
              <li key={i} className="flex items-center justify-between rounded-xl border border-white/5 bg-zinc-900/30 px-3 py-1.5 text-xs">
                <span className="truncate text-zinc-300">{e.eventType.replace("agent.run.", "")} · {e.targetId ?? "—"}</span>
                <span className="shrink-0 text-zinc-600">{timeAgo(e.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
