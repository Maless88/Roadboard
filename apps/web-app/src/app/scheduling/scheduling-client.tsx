"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

interface Agent { name: string; slug: string; avatarUrl?: string | null }
interface Activity {
  id: string; title: string; kind: "cron" | "interval" | "once";
  cronExpr: string | null; everyMs: number | null; runAt: string | null; tz: string;
  agentSlug: string; promptTemplate: string; status: string;
  nextRunAt: string | null; lastRunAt: string | null;
}
interface Run { id: string; firedAt: string; status: string; durationMs: number | null; outputPreview: string | null; error: string | null }

const AV = "linear-gradient(135deg,#7c5cff,#a06eff)";
const DOW = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"];
const MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

const STATUS_TONE: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-400", paused: "bg-amber-500/15 text-amber-300",
  expired: "bg-zinc-500/15 text-zinc-400", done: "bg-indigo-500/15 text-indigo-300",
  ok: "text-emerald-400", error: "text-red-400", running: "text-indigo-300", pending: "text-zinc-400",
};

// cadence presets -> create payload
const PRESETS: { id: string; label: string; build: () => Record<string, unknown> }[] = [
  { id: "hourly", label: "Oraria", build: () => ({ kind: "cron", cronExpr: "0 * * * *" }) },
  { id: "daily", label: "Giornaliera (09:00)", build: () => ({ kind: "cron", cronExpr: "0 9 * * *" }) },
  { id: "weekly", label: "Settimanale (lun 09:00)", build: () => ({ kind: "cron", cronExpr: "0 9 * * 1" }) },
  { id: "biweekly", label: "Quindicinale", build: () => ({ kind: "interval", everyMs: 14 * 24 * 3600 * 1000 }) },
  { id: "monthly", label: "Mensile (giorno 1, 09:00)", build: () => ({ kind: "cron", cronExpr: "0 9 1 * *" }) },
];

function cadenceLabel(a: Activity): string {
  if (a.kind === "once") return a.runAt ? `Una volta · ${new Date(a.runAt).toLocaleString()}` : "Una volta";
  if (a.kind === "interval") {
    const d = (a.everyMs ?? 0) / (24 * 3600 * 1000);
    if (d >= 1) return `Ogni ${Math.round(d)} giorni`;
    const h = (a.everyMs ?? 0) / (3600 * 1000);
    return `Ogni ${Math.round(h)}h`;
  }
  const p = PRESETS.find((x) => x.build().cronExpr === a.cronExpr);
  return p ? p.label : `cron: ${a.cronExpr}`;
}
function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function startOfWeek(d: Date): Date {
  const x = new Date(d); const day = (x.getDay() + 6) % 7; x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - day); return x;
}

export function SchedulingClient() {
  const [acts, setActs] = useState<Activity[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"week" | "month">("week");
  const [cursor, setCursor] = useState<Date>(() => new Date());
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [runsOf, setRunsOf] = useState<Activity | null>(null);

  const reload = useCallback(async () => {
    const r = await fetch("/api/scheduling");
    if (r.ok) setActs(await r.json());
  }, []);

  useEffect(() => {
    let on = true;
    void (async () => {
      try {
        const [a, c] = await Promise.all([fetch("/api/scheduling"), fetch("/api/agents/contacts")]);
        if (!on) return;
        if (a.ok) setActs(await a.json());
        if (c.ok) setAgents((await c.json()).filter((x: Agent & { capability?: string }) => x.capability !== "routing"));
      } finally { if (on) setLoading(false); }
    })();
    return () => { on = false; };
  }, []);

  const nameOf = useCallback((slug: string) => agents.find((a) => a.slug === slug)?.name ?? slug, [agents]);

  // activities by their next occurrence day
  const byDay = useMemo(() => {
    const m = new Map<string, Activity[]>();
    for (const a of acts) {
      if (!a.nextRunAt) continue;
      const k = new Date(a.nextRunAt).toDateString();
      (m.get(k) ?? m.set(k, []).get(k)!).push(a);
    }
    return m;
  }, [acts]);

  const days = useMemo(() => {
    if (view === "week") {
      const s = startOfWeek(cursor);
      return Array.from({ length: 7 }, (_, i) => { const d = new Date(s); d.setDate(s.getDate() + i); return d; });
    }
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const gridStart = startOfWeek(first);
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(gridStart); d.setDate(gridStart.getDate() + i); return d; });
  }, [view, cursor]);

  async function act(id: string, action: "pause" | "resume" | "delete") {
    if (action === "delete") { if (!confirm("Eliminare questa attività schedulata?")) return; await fetch(`/api/scheduling/${id}`, { method: "DELETE" }); }
    else await fetch(`/api/scheduling/${id}/${action}`, { method: "POST" });
    await reload();
  }

  const periodLabel = view === "week"
    ? `Settimana del ${startOfWeek(cursor).toLocaleDateString()}`
    : `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
  function shift(dir: number) {
    const d = new Date(cursor);
    if (view === "week") d.setDate(d.getDate() + dir * 7); else d.setMonth(d.getMonth() + dir);
    setCursor(d);
  }

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-zinc-500">Pianificazione</p>
          <h1 className="text-xl font-semibold text-zinc-100">Agenda attività agenti</h1>
        </div>
        <button onClick={() => setCreating(true)} className="rounded-xl px-4 py-2 text-sm font-medium text-white" style={{ background: AV }}>+ Nuova attività</button>
      </div>

      {/* calendar controls */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-xl border border-white/10">
          <button onClick={() => setView("week")} className={`px-3 py-1.5 text-xs ${view === "week" ? "bg-white/10 text-white" : "text-zinc-400"}`}>Settimana</button>
          <button onClick={() => setView("month")} className={`px-3 py-1.5 text-xs ${view === "month" ? "bg-white/10 text-white" : "text-zinc-400"}`}>Mese</button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => shift(-1)} className="h-8 w-8 rounded-lg border border-white/10 text-zinc-300 hover:bg-white/5">‹</button>
          <button onClick={() => setCursor(new Date())} className="rounded-lg border border-white/10 px-2.5 py-1 text-xs text-zinc-300 hover:bg-white/5">Oggi</button>
          <button onClick={() => shift(1)} className="h-8 w-8 rounded-lg border border-white/10 text-zinc-300 hover:bg-white/5">›</button>
        </div>
        <span className="order-last w-full text-sm text-zinc-300 sm:order-none sm:ml-1 sm:w-auto">{periodLabel}</span>
      </div>

      {/* calendar */}
      {view === "week" ? (
        <>
          {/* mobile: agenda verticale, un giorno per riga */}
          <div className="space-y-1.5 sm:hidden">
            {days.map((d, i) => {
              const items = byDay.get(d.toDateString()) ?? [];
              const today = sameDay(d, new Date());
              return (
                <div key={i} className={`rounded-xl border p-2.5 ${today ? "border-violet-500/50 bg-violet-500/5" : "border-white/5 bg-zinc-900/30"}`}>
                  <div className="mb-1 text-xs font-medium text-zinc-300">{DOW[i]} {d.getDate()}/{d.getMonth() + 1}{today ? " · oggi" : ""}</div>
                  {items.length === 0 ? <div className="text-[11px] text-zinc-600">Nessuna attività</div> : (
                    <div className="space-y-1">
                      {items.map((a) => (
                        <button key={a.id} onClick={() => setRunsOf(a)} className="block w-full truncate rounded-lg bg-violet-500/15 px-2 py-1.5 text-left text-xs text-violet-200 hover:bg-violet-500/25">
                          {new Date(a.nextRunAt!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {a.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {/* desktop: griglia 7 colonne */}
          <div className="hidden gap-1 sm:grid sm:grid-cols-7">
            {DOW.map((d) => <div key={d} className="px-1 pb-1 text-center text-[10px] uppercase tracking-wider text-zinc-600">{d}</div>)}
            {days.map((d, i) => {
              const items = byDay.get(d.toDateString()) ?? [];
              const today = sameDay(d, new Date());
              return (
                <div key={i} className={`min-h-[72px] rounded-lg border p-1 ${today ? "border-violet-500/50 bg-violet-500/5" : "border-white/5 bg-zinc-900/30"}`}>
                  <div className="mb-0.5 text-[10px] text-zinc-500">{d.getDate()}</div>
                  <div className="space-y-0.5">
                    {items.slice(0, 4).map((a) => (
                      <button key={a.id} onClick={() => setRunsOf(a)} title={`${a.title} · ${cadenceLabel(a)}`}
                        className="block w-full truncate rounded bg-violet-500/15 px-1 py-0.5 text-left text-[10px] text-violet-200 hover:bg-violet-500/25">
                        {new Date(a.nextRunAt!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} {a.title}
                      </button>
                    ))}
                    {items.length > 4 ? <div className="text-[10px] text-zinc-600">+{items.length - 4}</div> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        /* mese: griglia sempre; mobile = pallini, desktop = chip */
        <div className="grid grid-cols-7 gap-1">
          {DOW.map((d) => <div key={d} className="px-0.5 pb-1 text-center text-[9px] uppercase tracking-wider text-zinc-600 sm:text-[10px]">{d}</div>)}
          {days.map((d, i) => {
            const items = byDay.get(d.toDateString()) ?? [];
            const today = sameDay(d, new Date());
            const dim = d.getMonth() !== cursor.getMonth();
            return (
              <button key={i} onClick={() => { if (items.length === 1) setRunsOf(items[0]); }} className={`min-h-[46px] rounded-lg border p-1 text-left sm:min-h-[68px] ${today ? "border-violet-500/50 bg-violet-500/5" : "border-white/5 bg-zinc-900/30"} ${dim ? "opacity-40" : ""}`}>
                <div className="text-[10px] text-zinc-500">{d.getDate()}</div>
                {items.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-0.5 sm:hidden">
                    {items.slice(0, 6).map((a) => <span key={a.id} className="h-1.5 w-1.5 rounded-full bg-violet-400" />)}
                  </div>
                ) : null}
                <div className="mt-0.5 hidden space-y-0.5 sm:block">
                  {items.slice(0, 3).map((a) => (
                    <span key={a.id} onClick={(e) => { e.stopPropagation(); setRunsOf(a); }} title={`${a.title} · ${cadenceLabel(a)}`}
                      className="block w-full cursor-pointer truncate rounded bg-violet-500/15 px-1 py-0.5 text-left text-[10px] text-violet-200 hover:bg-violet-500/25">{a.title}</span>
                  ))}
                  {items.length > 3 ? <div className="text-[10px] text-zinc-600">+{items.length - 3}</div> : null}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* list / management */}
      <h2 className="mt-6 mb-2 text-sm font-semibold text-zinc-200">Tutte le attività</h2>
      {loading ? <p className="text-sm text-zinc-500">Carico…</p> : acts.length === 0 ? (
        <p className="text-sm text-zinc-500">Nessuna attività schedulata. Creane una con “+ Nuova attività”.</p>
      ) : (
        <div className="space-y-2">
          {acts.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-zinc-900/40 px-3 py-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-zinc-100">{a.title}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_TONE[a.status] ?? "bg-white/10 text-zinc-300"}`}>{a.status}</span>
                </div>
                <div className="truncate text-xs text-zinc-500">{nameOf(a.agentSlug)} · {cadenceLabel(a)}{a.nextRunAt ? ` · prossima ${new Date(a.nextRunAt).toLocaleString()}` : ""}</div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 text-xs">
                <button onClick={() => setRunsOf(a)} className="rounded-lg border border-white/10 px-2 py-1 text-zinc-300 hover:bg-white/5">Storico</button>
                <button onClick={() => setEditing(a)} className="rounded-lg border border-white/10 px-2 py-1 text-zinc-300 hover:bg-white/5">Modifica</button>
                {a.status === "active"
                  ? <button onClick={() => void act(a.id, "pause")} className="rounded-lg border border-white/10 px-2 py-1 text-amber-300 hover:bg-white/5">Pausa</button>
                  : <button onClick={() => void act(a.id, "resume")} className="rounded-lg border border-white/10 px-2 py-1 text-emerald-300 hover:bg-white/5">Riprendi</button>}
                <button onClick={() => void act(a.id, "delete")} className="rounded-lg border border-white/10 px-2 py-1 text-red-400 hover:bg-white/5">Elimina</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {creating ? <ActivityFormModal mode="create" agents={agents} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); void reload(); }} /> : null}
      {editing ? <ActivityFormModal mode="edit" activity={editing} agents={agents} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void reload(); }} /> : null}
      {runsOf ? <RunsModal activity={runsOf} nameOf={nameOf} cadence={cadenceLabel(runsOf)} onClose={() => setRunsOf(null)} /> : null}
    </div>
  );
}

function ActivityFormModal({ mode, activity, agents, onClose, onSaved }: { mode: "create" | "edit"; activity?: Activity; agents: Agent[]; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(activity?.title ?? "");
  const [agentSlug, setAgentSlug] = useState(activity?.agentSlug ?? agents[0]?.slug ?? "");
  const [promptTemplate, setPrompt] = useState(activity?.promptTemplate ?? "");
  const [preset, setPreset] = useState(mode === "edit" ? "keep" : "daily");
  const [runAt, setRunAt] = useState("");
  const [cron, setCron] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    if (!title.trim() || !agentSlug || !promptTemplate.trim()) { setErr("Titolo, agente e prompt sono richiesti."); return; }
    let sched: Record<string, unknown> = {};
    if (preset === "keep") sched = {};
    else if (preset === "once") sched = { kind: "once", runAt: runAt ? new Date(runAt).toISOString() : new Date(Date.now() + 3600000).toISOString() };
    else if (preset === "cron") sched = { kind: "cron", cronExpr: cron.trim() };
    else sched = PRESETS.find((p) => p.id === preset)!.build();
    setBusy(true);
    try {
      const url = mode === "edit" && activity ? `/api/scheduling/${activity.id}` : "/api/scheduling";
      const method = mode === "edit" ? "PATCH" : "POST";
      const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: title.trim(), agentSlug, promptTemplate: promptTemplate.trim(), ...sched }) });
      if (!r.ok) { setErr(`Errore ${r.status}: ${(await r.text()).slice(0, 120)}`); return; }
      onSaved();
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div className="flex h-[100dvh] w-full flex-col overflow-hidden border border-white/10 bg-zinc-950 sm:h-auto sm:max-h-[88vh] sm:max-w-lg sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
          <div className="text-sm font-semibold text-zinc-100">{mode === "edit" ? "Modifica attività" : "Nuova attività schedulata"}</div>
          <button onClick={onClose} className="h-8 w-8 rounded-full text-zinc-400 hover:bg-white/10">✕</button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
          <label className="block text-xs text-zinc-400">Titolo
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500/50" /></label>
          <label className="block text-xs text-zinc-400">Agente
            <select value={agentSlug} onChange={(e) => setAgentSlug(e.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500/50">
              {agents.map((a) => <option key={a.slug} value={a.slug}>{a.name}</option>)}
            </select></label>
          <label className="block text-xs text-zinc-400">Cosa deve fare (prompt)
            <textarea value={promptTemplate} onChange={(e) => setPrompt(e.target.value)} rows={3} placeholder="Es: prepara il digest delle novità AI di oggi" className="mt-1 w-full resize-none rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500/50" /></label>
          <label className="block text-xs text-zinc-400">Cadenza
            <select value={preset} onChange={(e) => setPreset(e.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500/50">
              {mode === "edit" ? <option value="keep">Cadenza attuale (invariata)</option> : null}
              {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              <option value="once">Una volta</option>
              <option value="cron">Avanzato (cron)</option>
            </select></label>
          {preset === "once" ? (
            <label className="block text-xs text-zinc-400">Quando
              <input type="datetime-local" value={runAt} onChange={(e) => setRunAt(e.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500/50" /></label>
          ) : preset === "cron" ? (
            <label className="block text-xs text-zinc-400">Cron (5 campi)
              <input value={cron} onChange={(e) => setCron(e.target.value)} placeholder="0 9 * * 1" className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 font-mono text-sm text-zinc-100 outline-none focus:border-indigo-500/50" /></label>
          ) : null}
          {err ? <p className="text-xs text-red-400">{err}</p> : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-white/10 p-3">
          <button onClick={onClose} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-white/5">Annulla</button>
          <button onClick={() => void submit()} disabled={busy} className="rounded-xl px-5 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: AV }}>{busy ? "…" : mode === "edit" ? "Salva" : "Crea"}</button>
        </div>
      </div>
    </div>
  );
}

function RunsModal({ activity, nameOf, cadence, onClose }: { activity: Activity; nameOf: (s: string) => string; cadence: string; onClose: () => void }) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let on = true;
    void (async () => {
      try { const r = await fetch(`/api/scheduling/${activity.id}/runs`); if (r.ok && on) setRuns(await r.json()); }
      finally { if (on) setLoading(false); }
    })();
    return () => { on = false; };
  }, [activity.id]);
  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div className="flex h-[100dvh] w-full flex-col overflow-hidden border border-white/10 bg-zinc-950 sm:h-auto sm:max-h-[88vh] sm:max-w-lg sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
          <div className="min-w-0"><div className="truncate text-sm font-semibold text-zinc-100">{activity.title}</div><div className="truncate text-xs text-zinc-500">{nameOf(activity.agentSlug)} · {cadence}</div></div>
          <button onClick={onClose} className="h-8 w-8 rounded-full text-zinc-400 hover:bg-white/10">✕</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="mb-2 rounded-xl border border-white/10 bg-zinc-900/50 p-3 text-xs text-zinc-400">{activity.promptTemplate}</div>
          <div className="mb-2 text-xs font-semibold text-zinc-300">Storico run</div>
          {loading ? <p className="text-xs text-zinc-500">Carico…</p> : runs.length === 0 ? <p className="text-xs text-zinc-600">Nessun run ancora.</p> : (
            <ul className="space-y-1.5">
              {runs.map((r) => (
                <li key={r.id} className="rounded-lg border border-white/5 bg-zinc-900/40 px-3 py-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className={`font-medium ${STATUS_TONE[r.status] ?? "text-zinc-300"}`}>{r.status}{r.durationMs != null ? ` · ${(r.durationMs / 1000).toFixed(1)}s` : ""}</span>
                    <span className="text-zinc-600">{new Date(r.firedAt).toLocaleString()}</span>
                  </div>
                  {r.outputPreview ? <div className="mt-1 text-zinc-400">{r.outputPreview}</div> : null}
                  {r.error ? <div className="mt-1 text-red-400">{r.error}</div> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
