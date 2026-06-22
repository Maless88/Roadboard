"use client";

import { useEffect, useRef, useState } from "react";

interface Contact {
  name: string;
  slug: string;
  capability: string;
  provider: string;
  model: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
}
interface Msg { role: "user" | "assistant"; content: string }

const AV = "linear-gradient(135deg,#7c5cff,#a06eff)";

export function BoardChatClient({ initialContacts }: { initialContacts: Contact[] }) {

  const [contacts] = useState<Contact[]>(initialContacts);
  const [active, setActive] = useState<Contact | null>(initialContacts[0] ?? null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const slug = active?.slug;

  useEffect(() => {
    if (!slug) return;
    setMessages([]);
    fetch(`/api/agents/messages?agent=${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: { role: string; content: string }[]) =>
        setMessages(rows.map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.content }))),
      )
      .catch(() => {});
  }, [slug]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    if (!active) return;
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }, { role: "assistant", content: "" }]);
    setBusy(true);
    try {
      const res = await fetch(`/api/chat?agent=${encodeURIComponent(active.slug)}&message=${encodeURIComponent(text)}`);
      if (!res.ok || !res.body) throw new Error(`chat error ${res.status}`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const ch = dec.decode(value, { stream: true });
        setMessages((m) => {
          const c = [...m];
          c[c.length - 1] = { role: "assistant", content: c[c.length - 1].content + ch };
          return c;
        });
      }
    } catch (e) {
      setMessages((m) => {
        const c = [...m];
        c[c.length - 1] = { role: "assistant", content: `[errore] ${e instanceof Error ? e.message : String(e)}` };
        return c;
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-1rem)] overflow-hidden">

      {/* lista contatti */}
      <aside className="flex w-72 shrink-0 flex-col border-r border-white/10 bg-zinc-950/40">
        <div className="border-b border-white/10 p-3">
          <p className="px-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500">Agenti</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {contacts.length === 0 ? (
            <p className="p-3 text-xs text-zinc-500">Nessun agente. Creane uno in AgentConfig.</p>
          ) : (
            contacts.map((c) => (
              <button
                key={c.slug}
                onClick={() => setActive(c)}
                className={`mb-1 flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors ${
                  active?.slug === c.slug ? "bg-indigo-500/15" : "hover:bg-white/5"
                }`}
              >
                <span className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: AV }}>
                  {c.name.charAt(0).toUpperCase()}
                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-zinc-950 bg-emerald-400" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-zinc-100">{c.name}</span>
                  <span className="block truncate text-xs text-zinc-500">{c.lastMessage ?? c.capability}</span>
                </span>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* conversazione */}
      <section className="flex min-w-0 flex-1 flex-col">
        {active ? (
          <>
            <header className="flex items-center gap-3 border-b border-white/10 px-5 py-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: AV }}>
                {active.name.charAt(0).toUpperCase()}
              </span>
              <span>
                <span className="block text-sm font-semibold text-zinc-100">{active.name}</span>
                <span className="block text-xs text-emerald-400">{active.provider} · online</span>
              </span>
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              {messages.length === 0 ? (
                <p className="text-sm text-zinc-500">Scrivi un messaggio a {active.name}.</p>
              ) : (
                messages.map((m, i) => (
                  <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
                    <span
                      className={`inline-block max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                        m.role === "user" ? "text-white" : "bg-white/5 text-zinc-200"
                      }`}
                      style={m.role === "user" ? { background: AV } : undefined}
                    >
                      {m.content || (busy ? "…" : "")}
                    </span>
                  </div>
                ))
              )}
              <div ref={endRef} />
            </div>

            <div className="flex gap-2 border-t border-white/10 p-4">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder={`Scrivi a ${active.name}…`}
                className="flex-1 rounded-2xl border border-white/10 bg-zinc-900 px-4 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500/50"
              />
              <button
                onClick={() => void send()}
                disabled={busy}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white disabled:opacity-50"
                style={{ background: AV }}
              >
                {busy ? "…" : "→"}
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">Seleziona un agente</div>
        )}
      </section>
    </div>
  );
}
