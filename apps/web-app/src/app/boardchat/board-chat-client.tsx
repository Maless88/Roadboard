"use client";

import { useState } from "react";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

export function BoardChatClient() {

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {

    const text = input.trim();
    if (!text || busy) return;

    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }, { role: "assistant", content: "" }]);
    setBusy(true);

    try {
      const res = await fetch(`/api/chat?message=${encodeURIComponent(text)}`);
      if (!res.ok || !res.body) throw new Error(`chat error ${res.status}`);

      const reader = res.body.getReader();
      const dec = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = dec.decode(value, { stream: true });
        setMessages((m) => {
          const copy = [...m];
          const last = copy[copy.length - 1];
          copy[copy.length - 1] = { role: "assistant", content: last.content + chunk };
          return copy;
        });
      }
    } catch (e) {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = {
          role: "assistant",
          content: `[errore] ${e instanceof Error ? e.message : String(e)}`,
        };
        return copy;
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-2rem)] max-w-3xl flex-col p-4">
      <h1 className="mb-3 text-xl font-semibold text-zinc-100">boardchat</h1>

      <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
        {messages.length === 0 ? (
          <p className="text-sm text-zinc-500">Scrivi un messaggio per parlare con l&apos;agente (claude-code).</p>
        ) : null}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <span
              className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                m.role === "user"
                  ? "bg-indigo-500/20 text-indigo-100"
                  : "bg-white/5 text-zinc-200"
              }`}
            >
              {m.content || (busy ? "…" : "")}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Messaggio…"
          className="flex-1 rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500/50"
        />
        <button
          onClick={() => void send()}
          disabled={busy}
          className="rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,#6366f1,#818cf8)" }}
        >
          {busy ? "…" : "Invia"}
        </button>
      </div>
    </div>
  );
}
