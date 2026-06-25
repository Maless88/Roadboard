"use client";

import { useEffect, useState } from "react";

/**
 * Per-user provider credentials form, shown on the scheda of agents that need a
 * user-supplied API key (e.g. Grafico → Cloudflare Workers AI). The key is sent to
 * the backend and stored encrypted; it is never rendered back.
 */
export function AgentCredentialsForm({ provider = "cloudflare" }: { provider?: string }) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [accountId, setAccountId] = useState("");
  const [token, setToken] = useState("");
  const [savedAccount, setSavedAccount] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    try {
      const r = await fetch(`/api/agents/credentials/status?provider=${provider}`, { cache: "no-store" });
      const j = await r.json();
      setConfigured(!!j.configured);
      setSavedAccount(j.accountId);
    } catch { setConfigured(false); }
  }
  useEffect(() => { void refresh(); }, [provider]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/agents/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, accountId, token }),
      });
      const j = await r.json();
      if (j.ok) { setMsg("Salvata ✓"); setToken(""); setAccountId(""); void refresh(); }
      else setMsg(j.error || "Errore nel salvataggio");
    } catch { setMsg("Errore di rete"); }
    finally { setBusy(false); }
  }

  return (
    <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-amber-300">Setup richiesto · API Cloudflare</h2>
        {configured === null ? null : configured ? (
          <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400">● configurata{savedAccount ? ` · acct ${savedAccount.slice(0, 6)}…` : ""}</span>
        ) : (
          <span className="rounded-full bg-zinc-700/40 px-2.5 py-0.5 text-xs font-medium text-zinc-400">● non configurata</span>
        )}
      </div>
      <p className="mt-2 text-xs text-zinc-400">
        Questo agente genera immagini con <b>Cloudflare Workers AI (FLUX.1-schnell)</b>. La chiave la crei tu, gratis:
      </p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-zinc-400">
        <li>Vai su <span className="text-zinc-200">dash.cloudflare.com</span> → registrati (free, senza carta).</li>
        <li>Copia il tuo <span className="text-zinc-200">Account ID</span> (Workers &amp; Pages → Overview).</li>
        <li>Crea un <span className="text-zinc-200">API Token</span> con permesso <span className="text-zinc-200">Workers AI → Read/Run</span> e incollalo qui sotto.</li>
      </ol>
      <form onSubmit={save} className="mt-3 space-y-2">
        <input
          value={accountId} onChange={(e) => setAccountId(e.target.value)}
          placeholder="Cloudflare Account ID"
          className="w-full rounded-lg border border-white/10 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-amber-500/50"
        />
        <input
          value={token} onChange={(e) => setToken(e.target.value)} type="password"
          placeholder="Cloudflare API Token (Workers AI)"
          className="w-full rounded-lg border border-white/10 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-amber-500/50"
        />
        <div className="flex items-center gap-3">
          <button type="submit" disabled={busy || !accountId || !token}
            className="rounded-xl bg-amber-500/90 px-4 py-2 text-sm font-medium text-zinc-950 disabled:opacity-40">
            {busy ? "Salvataggio…" : configured ? "Aggiorna chiave" : "Salva chiave"}
          </button>
          {msg ? <span className="text-xs text-zinc-400">{msg}</span> : null}
        </div>
      </form>
      <p className="mt-2 text-[11px] text-zinc-600">La chiave è salvata cifrata (AES-256-GCM), per-utente, e non viene mai mostrata di nuovo.</p>
    </div>
  );
}
