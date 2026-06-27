"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
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
function Markdown({ text }: { text: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>{text}</ReactMarkdown>;
}

interface RoomListItem {
  id: string;
  kind: string;
  title: string | null;
  agents: string[];
  lastMessage: string | null;
  lastMessageAt: string | null;
}
interface Participant { kind: string; refId: string }
interface RMsg { senderKind: "user" | "agent"; senderId: string; content: string }
interface RoomDetail { id: string; kind: string; title: string | null; participants: Participant[]; messages: RMsg[] }
interface Contact { name: string; slug: string; capability: string; avatarUrl?: string | null }

const AV = "linear-gradient(135deg,#7c5cff,#a06eff)";
const PALETTE = ["#7c5cff", "#22c8b4", "#f59e0b", "#ef4d6f", "#3ccb7f", "#6da8ff", "#b06eff"];

function colorFor(slug: string): string {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/** Sender avatar: image if available, else a colored initial — like a messaging app. */
function Avatar({ url, label, bg, size = 28 }: { url?: string | null; label: string; bg: string; size?: number }) {
  const dim = { width: size, height: size };
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={label} className="shrink-0 rounded-full object-cover" style={dim} />;
  }
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white" style={{ ...dim, background: bg, fontSize: size * 0.4 }}>
      {label[0]?.toUpperCase() ?? "?"}
    </span>
  );
}

/** Split a leading sender marker (RS + JSON + "\n") from streamed turn output. */
function splitSender(raw: string): { sender: { senderId: string; reason?: string } | null; body: string } {
  if (raw.startsWith("\x1e")) {
    const nl = raw.indexOf("\n");
    if (nl === -1) return { sender: null, body: "" };
    try {
      return { sender: JSON.parse(raw.slice(1, nl)), body: raw.slice(nl + 1) };
    } catch {
      return { sender: null, body: raw.slice(nl + 1) };
    }
  }
  return { sender: null, body: raw };
}

export function ChatboardClient({ displayName }: { displayName: string }) {

  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [avatars, setAvatars] = useState<Map<string, string | null>>(new Map());
  const [agents, setAgents] = useState<Contact[]>([]);
  const [detail, setDetail] = useState<RoomDetail | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [picker, setPicker] = useState<null | "invite" | "share">(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [input, setInput] = useState("");
  const [busyRooms, setBusyRooms] = useState<Set<string>>(new Set());
  const endRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const draftRef = useRef<string | null>(null);
  const [lastSeen, setLastSeen] = useState<Record<string, string>>({});
  const prevAtRef = useRef<Record<string, string>>({});
  const seenLoaded = useRef(false);

  const markSeen = useCallback((id: string) => {
    setLastSeen((prev) => {
      const next = { ...prev, [id]: new Date().toISOString() };
      try { localStorage.setItem("rb_chat_seen", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);
  const isUnread = (roomId: string | undefined, at: string | null | undefined) =>
    !!roomId && !!at && roomId !== activeId && at > (lastSeen[roomId] ?? "");

  const loadRooms = useCallback(async () => {
    try {
      const r = await fetch("/api/agents/rooms");
      if (r.ok) setRooms(await r.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    void loadRooms();
    void (async () => {
      try {
        const r = await fetch("/api/agents/contacts");
        if (r.ok) {
          const list: Contact[] = await r.json();
          setAgents(list);
          setNames(new Map(list.map((c) => [c.slug, c.name])));
          setAvatars(new Map(list.map((c) => [c.slug, c.avatarUrl ?? null])));
        }
      } catch { /* ignore */ }
    })();
  }, [loadRooms]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [detail?.messages]);

  // load persisted "seen" marks + ask notification permission once
  useEffect(() => {
    try { const raw = localStorage.getItem("rb_chat_seen"); if (raw) setLastSeen(JSON.parse(raw)); } catch { /* ignore */ }
    try { if (typeof Notification !== "undefined" && Notification.permission === "default") void Notification.requestPermission(); } catch { /* ignore */ }
    seenLoaded.current = true;
  }, []);

  // poll the room list so replies show up even when you are not in that chat
  useEffect(() => {
    const t = setInterval(() => { void loadRooms(); }, 6000);
    return () => clearInterval(t);
  }, [loadRooms]);

  // mark the open room as seen as its messages arrive
  useEffect(() => { if (detail) markSeen(detail.id); }, [detail, markSeen]);

  // notify when a NEW agent message lands in a room you are not viewing
  useEffect(() => {
    if (!seenLoaded.current) return;
    for (const r of rooms) {
      const at = r.lastMessageAt;
      if (!at) continue;
      const prev = prevAtRef.current[r.id];
      if (prev && at > prev && r.id !== activeId && at > (lastSeen[r.id] ?? "")) {
        const who = r.kind === "direct" ? nameOf(r.agents[0]) : (r.title || "Gruppo");
        try {
          if (typeof Notification !== "undefined" && Notification.permission === "granted")
            new Notification(who, { body: r.lastMessage ?? "Nuova risposta" });
        } catch { /* ignore */ }
      }
      prevAtRef.current[r.id] = at;
    }
  }, [rooms, activeId, lastSeen]);

  // deep-link from Home cockpit: ?room=<id>&draft=<text>
  useEffect(() => {
    const room = searchParams.get("room");
    if (room) { draftRef.current = searchParams.get("draft"); void openRoom(room); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // auto-send the draft once the linked room has loaded
  useEffect(() => {
    if (detail && draftRef.current) {
      const d = draftRef.current;
      draftRef.current = null;
      void send(d);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail]);

  const nameOf = (slug: string) => names.get(slug) ?? slug;
  const roomAgents = (d: RoomDetail) => d.participants.filter((p) => p.kind === "agent").map((p) => p.refId);
  // busy is per-room: a pending turn in one room must not block the others
  const busy = !!detail && busyRooms.has(detail.id);

  async function openRoom(id: string) {
    setActiveId(id);
    markSeen(id);
    setDetail(null);
    try {
      const r = await fetch(`/api/agents/rooms/${id}`);
      if (r.ok) setDetail(await r.json());
    } catch { /* ignore */ }
  }

  async function createRoom() {
    const agentSlugs = [...picked];
    if (agentSlugs.length === 0) return;
    try {
      const r = await fetch("/api/agents/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentSlugs, title: title.trim() || undefined }),
      });
      if (r.ok) {
        const room = await r.json();
        setCreating(false);
        setPicked(new Set());
        setTitle("");
        await loadRooms();
        void openRoom(room.id);
      }
    } catch { /* ignore */ }
  }

  async function openDirect(slug: string) {
    const existing = rooms.find((r) => r.kind === "direct" && r.agents[0] === slug);
    if (existing) { void openRoom(existing.id); return; }
    try {
      const r = await fetch("/api/agents/rooms/direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentSlug: slug }),
      });
      if (r.ok) {
        const room = await r.json();
        await loadRooms();
        void openRoom(room.id);
      }
    } catch { /* ignore */ }
  }

  async function send(textArg?: string) {
    const text = (textArg ?? input).trim();
    if (!text || !detail) return;
    const roomId = detail.id;
    markSeen(roomId);
    if (busyRooms.has(roomId)) return; // serialize within a room, never across rooms
    if (textArg === undefined) setInput("");
    setDetail((d) => (d && d.id === roomId) ? ({
      ...d,
      messages: [...d.messages, { senderKind: "user", senderId: "me", content: text }, { senderKind: "agent", senderId: "", content: "" }],
    }) : d);
    setBusyRooms((s) => new Set(s).add(roomId));
    try {
      const res = await fetch(`/api/agents/rooms/${roomId}/turn?message=${encodeURIComponent(text)}`);
      if (!res.ok || !res.body) throw new Error(`turn ${res.status}`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let raw = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        raw += dec.decode(value, { stream: true });
        const { sender, body } = splitSender(raw);
        setDetail((d) => {
          if (!d || d.id !== roomId) return d; // ignore if user navigated to another room
          const m = [...d.messages];
          const last = m.length - 1;
          m[last] = { senderKind: "agent", senderId: sender?.senderId || m[last].senderId || "", content: body };
          return { ...d, messages: m };
        });
      }
    } catch (e) {
      setDetail((d) => {
        if (!d || d.id !== roomId) return d;
        const m = [...d.messages];
        m[m.length - 1] = { senderKind: "agent", senderId: m[m.length - 1].senderId, content: `[errore] ${e instanceof Error ? e.message : String(e)}` };
        return { ...d, messages: m };
      });
    } finally {
      setBusyRooms((s) => { const n = new Set(s); n.delete(roomId); return n; });
      void loadRooms();
      try { const rr = await fetch(`/api/agents/rooms/${roomId}`); if (rr.ok) { const dj = await rr.json(); setDetail((d) => (d && d.id === roomId ? dj : d)); } } catch { /* keep streamed view */ }
    }
  }

  async function inviteAgent(slug: string) {
    if (!detail) return;
    await fetch(`/api/agents/rooms/${detail.id}/participants`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agentSlug: slug }),
    });
    setPicker(null);
    void openRoom(detail.id);
    void loadRooms();
  }

  async function shareTo(slug: string) {
    if (!detail) return;
    setPicker(null);
    await fetch(`/api/agents/rooms/${detail.id}/share`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ toAgentSlug: slug }),
    });
    void loadRooms();
  }

  return (
    <div className="flex h-[calc(100dvh-3rem)] overflow-hidden md:h-[calc(100vh-1rem)]">

      {/* lista stanze */}
      <aside className={`${activeId ? "hidden md:flex" : "flex"} w-full shrink-0 flex-col border-r border-white/10 bg-zinc-950/40 md:w-72`}>
        <div className="flex items-center justify-between border-b border-white/10 p-3">
          <p className="px-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">Chat</p>
          <button onClick={() => setCreating((v) => !v)} className="inline-flex h-7 w-7 items-center justify-center rounded-full text-white" style={{ background: AV }}>
            {creating ? "×" : "+"}
          </button>
        </div>

        {creating && (
          <div className="border-b border-white/10 bg-zinc-900/50 p-3">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titolo (opzionale)"
              className="mb-2 w-full rounded-xl border border-white/10 bg-zinc-900 px-3 py-1.5 text-sm outline-none focus:border-indigo-500/50" />
            <div className="flex flex-wrap gap-1.5">
              {agents.map((a) => {
                const on = picked.has(a.slug);
                return (
                  <button key={a.slug} onClick={() => setPicked((s) => { const n = new Set(s); n.has(a.slug) ? n.delete(a.slug) : n.add(a.slug); return n; })}
                    className={`rounded-full px-2.5 py-1 text-xs transition-colors ${on ? "text-white" : "bg-white/5 text-zinc-300"}`}
                    style={on ? { background: colorFor(a.slug) } : undefined}>
                    {a.name}
                  </button>
                );
              })}
            </div>
            <button onClick={() => void createRoom()} disabled={picked.size === 0}
              className="mt-2 w-full rounded-xl py-1.5 text-sm font-medium text-white disabled:opacity-40" style={{ background: AV }}>
              Crea gruppo ({picked.size})
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2">
          <p className="px-2 pb-1 pt-1 text-[10px] font-mono uppercase tracking-wider text-zinc-600">Chat dirette</p>
          {agents.filter((a) => a.capability !== "routing").map((a) => {
            const dr = rooms.find((r) => r.kind === "direct" && r.agents[0] === a.slug);
            return (
              <button key={a.slug} onClick={() => void openDirect(a.slug)}
                className={`mb-1 flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors ${dr && activeId === dr.id ? "bg-indigo-500/15" : "hover:bg-white/5"}`}>
                <Avatar url={a.avatarUrl} label={a.name} bg={colorFor(a.slug)} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-zinc-100">{a.name}</span>
                  <span className="block truncate text-xs text-zinc-500">{dr?.lastMessage ?? a.capability}</span>
                </span>
                {isUnread(dr?.id, dr?.lastMessageAt) ? <span className="ml-auto h-2.5 w-2.5 shrink-0 rounded-full bg-indigo-400" /> : null}
              </button>
            );
          })}

          <p className="px-2 pb-1 pt-3 text-[10px] font-mono uppercase tracking-wider text-zinc-600">Gruppi</p>
          {rooms.filter((r) => r.kind === "group").length === 0 ? (
            <p className="px-3 py-1 text-xs text-zinc-600">Nessun gruppo. Tocca + per crearne uno.</p>
          ) : rooms.filter((r) => r.kind === "group").map((c) => (
            <button key={c.id} onClick={() => void openRoom(c.id)}
              className={`mb-1 flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors ${activeId === c.id ? "bg-indigo-500/15" : "hover:bg-white/5"}`}>
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: AV }}>
                {c.agents.length}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-zinc-100">{c.title || c.agents.map(nameOf).join(", ") || "Gruppo"}</span>
                <span className="block truncate text-xs text-zinc-500">{c.lastMessage ?? `${c.agents.length} agenti`}</span>
              </span>
              {isUnread(c.id, c.lastMessageAt) ? <span className="ml-auto h-2.5 w-2.5 shrink-0 rounded-full bg-indigo-400" /> : null}
            </button>
          ))}
        </div>
      </aside>

      {/* conversazione */}
      <section className={`${activeId ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col`}>
        {activeId && detail ? (
          <>
            <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
              <button onClick={() => { setActiveId(null); setDetail(null); setPicker(null); }} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-zinc-300 hover:bg-white/5 md:hidden">←</button>
              {detail.kind === "group" ? (
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: AV }}>
                  {roomAgents(detail).length}
                </span>
              ) : (
                <Avatar url={avatars.get(roomAgents(detail)[0] ?? "")} label={nameOf(roomAgents(detail)[0] ?? "?")} bg={AV} size={36} />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-zinc-100">{detail.title || roomAgents(detail).map(nameOf).join(", ") || "Stanza"}</span>
                <span className="block truncate text-xs text-emerald-400">{roomAgents(detail).map(nameOf).join(" · ")}</span>
              </span>
              <button onClick={() => setPicker(picker === "invite" ? null : "invite")} title="Invita agente" className="shrink-0 rounded-full px-2.5 py-1 text-sm text-zinc-300 hover:bg-white/5">＋</button>
              <button onClick={() => setPicker(picker === "share" ? null : "share")} title="Condividi questa chat con…" className="shrink-0 rounded-full px-2.5 py-1 text-sm text-zinc-300 hover:bg-white/5">↗</button>
            </header>
            {picker && (
              <div className="border-b border-white/10 bg-zinc-900/50 p-3">
                <p className="mb-2 text-[11px] uppercase tracking-wider text-zinc-500">{picker === "invite" ? "Invita un agente nella stanza" : "Condividi questa chat con…"}</p>
                <div className="flex flex-wrap gap-1.5">
                  {agents.filter((a) => a.capability !== "routing" && (picker === "share" || !roomAgents(detail).includes(a.slug))).map((a) => (
                    <button key={a.slug} onClick={() => void (picker === "invite" ? inviteAgent(a.slug) : shareTo(a.slug))}
                      className="rounded-full px-2.5 py-1 text-xs font-medium text-white" style={{ background: colorFor(a.slug) }}>
                      {a.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              {detail.messages.length === 0 ? (
                <p className="text-sm text-zinc-500">Scrivi al team. Usa @nome per interpellare un agente.</p>
              ) : detail.messages.map((m, i) => {
                if (m.senderKind === "user") {
                  return (
                    <div key={i} className="flex justify-end gap-2">
                      <span className="inline-block max-w-[78%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm text-white" style={{ background: AV }}>{m.content}</span>
                      <Avatar label={displayName} bg={AV} />
                    </div>
                  );
                }
                return (
                  <div key={i} className="flex gap-2">
                    <span className="mt-0.5"><Avatar url={avatars.get(m.senderId)} label={nameOf(m.senderId)} bg={colorFor(m.senderId || "?")} /></span>
                    <span className="min-w-0">
                      <span className="mb-0.5 block text-[11px] text-zinc-500">{m.senderId ? nameOf(m.senderId) : "…"}</span>
                      {(() => {
                        const sep = m.content.indexOf("\x1f");
                        const txt = sep === -1 ? m.content : m.content.slice(0, sep);
                        const img = sep === -1 ? null : m.content.slice(sep + 1);
                        return (<>
                          <span className="inline-block max-w-full rounded-2xl bg-white/5 px-3 py-2 text-sm text-zinc-200">{txt ? <Markdown text={txt} /> : (busy ? "\u2026" : "")}</span>
                          {img ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={img} alt="immagine generata" className="mt-1 block max-w-[78%] rounded-2xl border border-white/10" />
                          ) : null}
                        </>);
                      })()}
                    </span>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>

            <div className="flex gap-2 border-t border-white/10 p-4">
              <input value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
                placeholder="Messaggio al team… (@nome per indirizzare)"
                className="flex-1 rounded-2xl border border-white/10 bg-zinc-900 px-4 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500/50" />
              <button onClick={() => void send()} disabled={busy} className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white disabled:opacity-50" style={{ background: AV }}>
                {busy ? "…" : "→"}
              </button>
            </div>
          </>
        ) : activeId ? (
          <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">…</div>
        ) : (
          <div className="hidden flex-1 items-center justify-center text-sm text-zinc-500 md:flex">Seleziona o crea una stanza</div>
        )}
      </section>
    </div>
  );
}
