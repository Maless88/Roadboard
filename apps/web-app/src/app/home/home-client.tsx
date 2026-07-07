"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/* eslint-disable @typescript-eslint/no-explicit-any */
const MD_COMPONENTS: any = {
  code: (pr: any) => /language-/.test(pr.className || "")
    ? <code className={pr.className}>{pr.children}</code>
    : <code className="rounded bg-black/40 px-1 text-[0.85em] text-emerald-300">{pr.children}</code>,
  pre: (pr: any) => <pre className="my-1 overflow-x-auto rounded-lg bg-black/50 p-2 text-xs leading-snug text-zinc-200">{pr.children}</pre>,
  ul: (pr: any) => <ul className="my-1 list-disc pl-5">{pr.children}</ul>,
  ol: (pr: any) => <ol className="my-1 list-decimal pl-5">{pr.children}</ol>,
  li: (pr: any) => <li className="my-0.5">{pr.children}</li>,
  a: (pr: any) => <a href={pr.href} target="_blank" rel="noreferrer" className="text-indigo-300 underline">{pr.children}</a>,
  p: (pr: any) => <p className="my-1 whitespace-pre-wrap">{pr.children}</p>,
  h1: (pr: any) => <p className="my-1 text-sm font-bold">{pr.children}</p>,
  h2: (pr: any) => <p className="my-1 text-sm font-bold">{pr.children}</p>,
  h3: (pr: any) => <p className="my-1 text-sm font-semibold">{pr.children}</p>,
  strong: (pr: any) => <strong className="font-semibold text-zinc-100">{pr.children}</strong>,
};
/* eslint-enable @typescript-eslint/no-explicit-any */
function Markdown({ text }: { text: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>{text}</ReactMarkdown>;
}

interface Contact { name: string; slug: string; capability: string; avatarUrl?: string | null; description?: string | null }
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
function splitSender(raw: string): string {
  if (raw.startsWith("\x1e")) {
    const nl = raw.indexOf("\n");
    return nl === -1 ? "" : raw.slice(nl + 1);
  }
  return raw;
}

const ICONS = {
  clip: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-[15px] w-[15px]"><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M9 3h6v3H9z" /><path d="M8 11h8M8 15h6" /></svg>,
  chat: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-[15px] w-[15px]"><path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.5A8 8 0 1 1 21 12z" /></svg>,
  chart: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-[15px] w-[15px]"><path d="M4 19V5M9 19v-7M14 19V8M19 19v-4" /></svg>,
};

function Avatar({ url, name, slug, size }: { url?: string | null; name: string; slug: string; size: number }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size, border: "3px solid #111119" }} />;
  }
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white" style={{ width: size, height: size, background: colorFor(slug), border: "3px solid #111119", fontSize: size * 0.4 }}>
      {name[0]?.toUpperCase() ?? "?"}
    </span>
  );
}

/* ---------------- Modal shell ---------------- */
function Modal({ title, subtitle, onClose, children, sideImage }: { title: React.ReactNode; subtitle?: string; onClose: () => void; children: React.ReactNode; sideImage?: string }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className={`fixed inset-0 z-50 flex justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-6 ${sideImage ? "lg:pl-24" : ""}`} onClick={onClose}>
      <div className="flex items-end justify-center">
        {sideImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={sideImage}
            alt=""
            aria-hidden="true"
            className="pointer-events-none relative z-0 hidden h-[80vh] w-auto shrink-0 object-contain lg:block lg:-mr-6"
            style={{ filter: "drop-shadow(0 20px 40px rgba(0,0,0,0.5))" }}
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        ) : null}
        <div className={`relative z-10 flex h-[100dvh] w-full flex-col overflow-hidden border border-white/10 bg-zinc-950 shadow-2xl sm:h-auto sm:rounded-3xl ${sideImage ? "sm:max-h-[92vh] sm:max-w-3xl" : "sm:max-h-[88vh] sm:max-w-lg"}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-zinc-100">{title}</div>
            {subtitle ? <div className="truncate text-xs text-zinc-500">{subtitle}</div> : null}
          </div>
          <button onClick={onClose} className="ml-3 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:bg-white/10 hover:text-zinc-100">✕</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Scheda (profile) ---------------- */
interface RecentItem { eventType: string; createdAt: string; metadata: Record<string, unknown> | null; roomId: string | null; roomLabel: string | null }
interface Profile {
  name: string; slug: string; capability: string; provider: string; model: string; runtime: string;
  trustTier: string; description: string | null; avatarUrl: string | null; doesText: string | null; doesNotText: string | null;
  skills: { name: string; description: string }[];
  stats: { runsToday: number; avgLatencyMs: number | null; lastRun: string | null; tokensApprox: number; tokensHaveReal?: boolean };
  recent: RecentItem[];
}
function useProfile(slug: string) {
  const [p, setP] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let on = true;
    void (async () => {
      try { const r = await fetch(`/api/agents/profile/${slug}`); if (r.ok && on) setP(await r.json()); }
      finally { if (on) setLoading(false); }
    })();
    return () => { on = false; };
  }, [slug]);
  return { p, loading };
}
function bullets(t: string | null | undefined): string[] {
  return (t ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
}
function SchedaModal({ agent, onClose }: { agent: Contact; onClose: () => void }) {
  const { p, loading } = useProfile(agent.slug);
  return (
    <Modal title={`Scheda · ${agent.name}`} subtitle="Scheda tecnica" onClose={onClose} sideImage={`/agents-fullbody/${agent.slug}.png`}>
      <div className="p-5">
        {loading ? <p className="text-sm text-zinc-500">Carico…</p> : !p ? <p className="text-sm text-zinc-500">Profilo non disponibile.</p> : (
          <>
            <div className="flex items-center gap-3">
              <Avatar url={p.avatarUrl} name={p.name} slug={p.slug} size={56} />
              <div className="min-w-0">
                <div className="text-base font-semibold text-zinc-100">{p.name}</div>
                <div className="text-xs text-zinc-500">{p.capability} · {p.model} · {p.runtime}</div>
                {p.trustTier && p.trustTier !== "restricted" ? <span className="mt-1 inline-block rounded-full border border-violet-500/40 bg-violet-500/10 px-2 py-0.5 text-[11px] font-medium text-violet-300">● {p.trustTier}</span> : null}
              </div>
            </div>
            {p.description ? <p className="mt-3 text-sm text-zinc-300">{p.description}</p> : null}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-3">
                <div className="mb-1 text-xs font-semibold text-emerald-400">Cosa fa</div>
                <ul className="space-y-1 text-xs text-zinc-300">{bullets(p.doesText).map((l, i) => <li key={i}>• {l}</li>)}</ul>
              </div>
              <div className="rounded-xl border border-white/10 bg-zinc-900/50 p-3">
                <div className="mb-1 text-xs font-semibold text-red-400">Cosa non fa</div>
                <ul className="space-y-1 text-xs text-zinc-300">{bullets(p.doesNotText).map((l, i) => <li key={i}>• {l}</li>)}</ul>
              </div>
            </div>
            {p.skills?.length ? (
              <div className="mt-4">
                <div className="mb-1.5 text-xs font-semibold text-violet-300">Skill</div>
                <div className="flex flex-wrap gap-1.5">{p.skills.map((s) => <span key={s.name} title={s.description} className="rounded-md bg-violet-500/15 px-2 py-0.5 text-[11px] font-medium text-violet-300">{s.name}</span>)}</div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </Modal>
  );
}

/* ---------------- Log (usage) ---------------- */
const EV_LABEL: Record<string, string> = { completed: "Completato", started: "Avviato", failed: "Fallito", routed: "Instradato", skipped: "Saltato" };
const EV_TONE: Record<string, string> = { completed: "text-emerald-400", started: "text-indigo-300", failed: "text-red-400", routed: "text-violet-300" };
function evNum(m: Record<string, unknown> | null, k: string): number | null {
  const v = m ? Number(m[k]) : NaN;
  return Number.isFinite(v) ? v : null;
}
function eventDetail(eventType: string, m: Record<string, unknown> | null): string {
  const kind = eventType.replace("agent.run.", "");
  if (kind === "completed") {
    const ms = evNum(m, "durationMs"); const ch = evNum(m, "chars");
    return [ms != null ? `${(ms / 1000).toFixed(1)}s` : null, ch != null ? `~${Math.round(ch / 4)} tok` : null].filter(Boolean).join(" · ");
  }
  if (kind === "started") return [m?.model, m?.runtime].filter(Boolean).join(" · ");
  if (kind === "routed") return m?.to ? `→ ${m.to}` : "";
  if (kind === "failed") return typeof m?.error === "string" ? m.error : "";
  return "";
}
function LogModal({ agent, onClose }: { agent: Contact; onClose: () => void }) {
  const { p, loading } = useProfile(agent.slug);
  const [sel, setSel] = useState<RecentItem | null>(null);
  return (
    <Modal title={`Log · ${agent.name}`} subtitle={sel ? "Dettaglio attività" : "Utilizzo e attività"} onClose={onClose}>
      <div className="p-5">
        {loading ? <p className="text-sm text-zinc-500">Carico…</p> : !p ? <p className="text-sm text-zinc-500">Nessun dato.</p> : sel ? (
          <ActivityDetail item={sel} onBack={() => setSel(null)} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[["Run oggi", String(p.stats.runsToday)], ["Latenza", p.stats.avgLatencyMs != null ? `${(p.stats.avgLatencyMs / 1000).toFixed(1)}s` : "—"], ["Ultimo run", p.stats.lastRun ? timeAgo(p.stats.lastRun) : "—"], [p.stats.tokensHaveReal ? "Token" : "Token ~", String(p.stats.tokensApprox)]].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-white/10 bg-zinc-900/50 p-3">
                  <div className="text-[11px] text-zinc-500">{k}</div>
                  <div className="text-base font-bold text-zinc-100">{v}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 mb-2 text-xs font-semibold text-zinc-300">Attività recente</div>
            {p.recent.length === 0 ? <p className="text-xs text-zinc-600">Nessuna attività.</p> : (
              <ul className="space-y-1.5">
                {p.recent.map((e, i) => {
                  const kind = e.eventType.replace("agent.run.", "");
                  const detail = eventDetail(e.eventType, e.metadata);
                  const desc = [EV_LABEL[kind] ?? kind, e.roomLabel].filter(Boolean).join(" · ");
                  return (
                    <li key={i}>
                      <button onClick={() => setSel(e)} className="flex w-full items-center justify-between gap-3 rounded-lg border border-white/5 bg-zinc-900/40 px-3 py-2 text-left text-xs transition-colors hover:bg-white/5">
                        <span className="flex min-w-0 flex-col">
                          <span className="flex items-center gap-2">
                            <span className={`font-medium ${EV_TONE[kind] ?? "text-zinc-300"}`}>{EV_LABEL[kind] ?? kind}</span>
                            {e.roomLabel ? <span className="truncate text-zinc-400">{e.roomLabel}</span> : null}
                          </span>
                          {detail ? <span className="mt-0.5 truncate text-zinc-600">{detail}</span> : null}
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5 text-zinc-600">{timeAgo(e.createdAt)}<svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

function ActivityDetail({ item, onBack }: { item: RecentItem; onBack: () => void }) {
  const kind = item.eventType.replace("agent.run.", "");
  const m = item.metadata ?? {};
  const ms = evNum(m, "durationMs");
  const ch = evNum(m, "chars");
  const tokTotal = evNum(m, "tokensTotal");
  const tokIn = evNum(m, "tokensIn");
  const tokOut = evNum(m, "tokensOut");
  const tokCc = evNum(m, "tokensCacheCreate");
  const tokCr = evNum(m, "tokensCacheRead");
  const tokenLabel = tokTotal != null ? "Token" : "Token ~";
  const tokenValue = tokTotal != null
    ? `${tokTotal} (in ${tokIn ?? "?"} · out ${tokOut ?? "?"} · cache_wr ${tokCc ?? 0} · cache_rd ${tokCr ?? 0})`
    : ch != null ? `~${Math.round(ch / 4)} (${ch} char)` : "—";
  const rows: [string, string][] = [
    ["Esito", EV_LABEL[kind] ?? kind],
    ["Quando", new Date(item.createdAt).toLocaleString()],
    ["Contesto", item.roomLabel ?? "—"],
    ["Modello", typeof m.model === "string" ? m.model : "—"],
    ["Runtime", typeof m.runtime === "string" ? m.runtime : "—"],
    ["Provider", typeof m.provider === "string" ? m.provider : "—"],
    ["Durata", ms != null ? `${(ms / 1000).toFixed(1)}s` : "—"],
    [tokenLabel, tokenValue],
    ["Delega a", typeof m.to === "string" ? m.to : "—"],
    ["Room id", item.roomId ?? "—"],
  ];
  return (
    <div>
      <button onClick={onBack} className="mb-3 inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-100">
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Indietro
      </button>
      <div className="overflow-hidden rounded-xl border border-white/10 bg-zinc-900/50">
        {rows.map(([k, v], i) => (
          <div key={k} className={`flex items-start justify-between gap-3 px-3 py-2 text-xs ${i > 0 ? "border-t border-white/5" : ""}`}>
            <span className="shrink-0 text-zinc-500">{k}</span>
            <span className="min-w-0 break-words text-right text-zinc-200">{v}</span>
          </div>
        ))}
      </div>
      {typeof m.error === "string" && m.error ? (
        <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">{m.error}</div>
      ) : null}
    </div>
  );
}

/* ---------------- Chat (modal) ---------------- */
interface Msg { role: "user" | "agent"; content: string }
function ChatModal({ agent, onClose }: { agent: Contact; onClose: () => void }) {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  useEffect(() => {
    let on = true;
    void (async () => {
      try {
        const r = await fetch("/api/agents/rooms/direct", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agentSlug: agent.slug }) });
        if (!r.ok || !on) return;
        const room = await r.json();
        setRoomId(room.id);
        const d = await fetch(`/api/agents/rooms/${room.id}`);
        if (d.ok && on) {
          const dj = await d.json();
          setMsgs((dj.messages ?? []).map((m: { senderKind: string; content: string }) => ({ role: m.senderKind === "user" ? "user" : "agent", content: m.content })));
        }
      } finally { if (on) setLoading(false); }
    })();
    return () => { on = false; };
  }, [agent.slug]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || !roomId) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", content: text }, { role: "agent", content: "" }]);
    setSending(true);
    try {
      const res = await fetch(`/api/agents/rooms/${roomId}/turn?message=${encodeURIComponent(text)}`);
      if (!res.ok || !res.body) throw new Error(`turn ${res.status}`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let raw = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        raw += dec.decode(value, { stream: true });
        const body = splitSender(raw);
        setMsgs((m) => { const n = [...m]; n[n.length - 1] = { role: "agent", content: body }; return n; });
      }
    } catch (e) {
      setMsgs((m) => { const n = [...m]; n[n.length - 1] = { role: "agent", content: `[errore] ${e instanceof Error ? e.message : String(e)}` }; return n; });
    } finally { setSending(false); }
  }, [input, sending, roomId]);

  return (
    <Modal title={<span className="flex items-center gap-2"><Avatar url={agent.avatarUrl} name={agent.name} slug={agent.slug} size={22} />{agent.name}</span>} subtitle="Chat dedicata" onClose={onClose}>
      <div className="flex h-full min-h-0 flex-col sm:h-[60vh]">
        <div className="flex-1 space-y-2.5 overflow-y-auto p-4">
          {loading ? <p className="text-sm text-zinc-500">Carico la conversazione…</p> :
            msgs.length === 0 ? <p className="text-sm text-zinc-500">Scrivi un messaggio per iniziare a parlare con {agent.name}.</p> :
            msgs.map((m, i) => {
              if (m.role === "user") {
                return (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl bg-violet-600 px-3.5 py-2 text-sm text-white">{m.content}</div>
                  </div>
                );
              }
              const sep = m.content.indexOf("\x1f");
              const txt = sep === -1 ? m.content : m.content.slice(0, sep);
              const img = sep === -1 ? null : m.content.slice(sep + 1);
              return (
                <div key={i} className="flex justify-start">
                  <div className="max-w-[85%]">
                    <div className="rounded-2xl border border-white/10 bg-zinc-900 px-3.5 py-2 text-sm text-zinc-200">
                      {txt ? <Markdown text={txt} /> : (sending && i === msgs.length - 1 ? "…" : "")}
                    </div>
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt="immagine generata" className="mt-1 block max-w-full rounded-2xl border border-white/10" />
                    ) : null}
                  </div>
                </div>
              );
            })}
          <div ref={endRef} />
        </div>
        <div className="flex items-end gap-2 border-t border-white/10 p-3">
          <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={1}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
            placeholder={`Messaggio a ${agent.name}…`}
            className="max-h-28 flex-1 resize-none rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500/50" />
          <button onClick={() => void send()} disabled={sending || !input.trim()} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white disabled:opacity-40" style={{ background: AV }}>{ICONS.chat}</button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- Page ---------------- */
type ModalState = { type: "scheda" | "chat" | "log"; agent: Contact } | null;

export function HomeClient({ displayName, contacts, activity }: { displayName: string; contacts: Contact[]; activity: Activity[] }) {

  const router = useRouter();
  const agents = useMemo(() => contacts.filter((c) => c.capability !== "routing"), [contacts]);
  const [target, setTarget] = useState("all");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);

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
        const r = await fetch("/api/agents/rooms/direct", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agentSlug: target }) });
        if (r.ok) roomId = (await r.json()).id;
      }
      if (roomId) {
        const q = new URLSearchParams({ room: roomId });
        if (body) q.set("draft", body);
        router.push(`/chatboard?${q.toString()}`);
      }
    } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6">

      <div className="mb-4">
        <p className="text-xs uppercase tracking-wider text-zinc-500">Agenti</p>
        <h1 className="text-xl font-semibold text-zinc-100">Chi lavora nel tuo workspace</h1>
        <p className="text-sm text-zinc-500">Ciao {displayName} — scrivi una richiesta, a tutti o a un agente.</p>
      </div>

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

      {/* agent grid — variant D */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((a) => {
          const last = lastBySlug.get(a.slug);
          const c = colorFor(a.slug);
          return (
            <div key={a.slug} className="overflow-hidden rounded-2xl border border-white/10 bg-[#111119] transition-transform hover:-translate-y-0.5 hover:border-white/20">
              <div className="relative h-[54px]" style={{ background: `linear-gradient(135deg, ${c}40, ${c}10)` }}>
                <div className="absolute -bottom-6 left-4"><Avatar url={a.avatarUrl} name={a.name} slug={a.slug} size={58} /></div>
              </div>
              <div className="px-4 pb-4 pt-8">
                <p className="truncate text-[15px] font-bold text-zinc-100">{a.name}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-500"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{a.capability}{last ? ` · ${timeAgo(last)}` : ""}</p>
                <p className="mt-2 text-xs leading-relaxed text-zinc-400" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: 34 }}>
                  {a.description || "—"}
                </p>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => setModal({ type: "scheda", agent: a })} title="Scheda tecnica"
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-white/10 bg-white/[.05] py-2 text-[11.5px] font-semibold text-zinc-300 hover:bg-white/10 hover:text-white">{ICONS.clip}Scheda</button>
                  <button onClick={() => setModal({ type: "chat", agent: a })} title="Chat dedicata"
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] py-2 text-[11.5px] font-semibold text-white" style={{ background: AV }}>{ICONS.chat}Chat</button>
                  <button onClick={() => setModal({ type: "log", agent: a })} title="Log utilizzo"
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-white/10 bg-white/[.05] py-2 text-[11.5px] font-semibold text-zinc-300 hover:bg-white/10 hover:text-white">{ICONS.chart}Log</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

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

      {modal?.type === "scheda" ? <SchedaModal agent={modal.agent} onClose={() => setModal(null)} /> : null}
      {modal?.type === "chat" ? <ChatModal agent={modal.agent} onClose={() => setModal(null)} /> : null}
      {modal?.type === "log" ? <LogModal agent={modal.agent} onClose={() => setModal(null)} /> : null}
    </div>
  );
}
