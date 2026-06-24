"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

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
interface Contact { name: string; slug: string; capability: string }

const AV = "linear-gradient(135deg,#7c5cff,#a06eff)";
const PALETTE = ["#7c5cff", "#22c8b4", "#f59e0b", "#ef4d6f", "#3ccb7f", "#6da8ff", "#b06eff"];

function colorFor(slug: string): string {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
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

export function ChatboardClient() {

  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
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
        }
      } catch { /* ignore */ }
    })();
  }, [loadRooms]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [detail?.messages]);

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
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: colorFor(a.slug) }}>
                  {a.name[0]?.toUpperCase() ?? "?"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-zinc-100">{a.name}</span>
                  <span className="block truncate text-xs text-zinc-500">{dr?.lastMessage ?? a.capability}</span>
                </span>
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
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: AV }}>
                {detail.kind === "group" ? roomAgents(detail).length : (nameOf(roomAgents(detail)[0] ?? "?")[0]?.toUpperCase() ?? "?")}
              </span>
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
                    <div key={i} className="text-right">
                      <span className="inline-block max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm text-white" style={{ background: AV }}>{m.content}</span>
                    </div>
                  );
                }
                return (
                  <div key={i} className="flex gap-2">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: colorFor(m.senderId || "?") }}>
                      {(nameOf(m.senderId)[0] ?? "?").toUpperCase()}
                    </span>
                    <span className="min-w-0">
                      <span className="mb-0.5 block text-[11px] text-zinc-500">{m.senderId ? nameOf(m.senderId) : "…"}</span>
                      <span className="inline-block max-w-full whitespace-pre-wrap rounded-2xl bg-white/5 px-3 py-2 text-sm text-zinc-200">{m.content || (busy ? "…" : "")}</span>
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
