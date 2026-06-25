"use client";

import { useEffect, useState } from "react";

/**
 * Per-user provider credentials form, shown on the scheda of agents that need a
 * user-supplied API key (e.g. Grafico → Cloudflare Workers AI). The key is sent to
 * the backend and stored encrypted; it is never rendered back. A "Supporto" button
 * opens a modal with the step-by-step Cloudflare setup guide.
 */
export function AgentCredentialsForm({ provider = "cloudflare" }: { provider?: string }) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [accountId, setAccountId] = useState("");
  const [token, setToken] = useState("");
  const [savedAccount, setSavedAccount] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [help, setHelp] = useState(false);

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
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-amber-300">Setup richiesto · API Cloudflare</h2>
        <div className="flex items-center gap-2">
          <button
            type="button" onClick={() => setHelp(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-200 hover:bg-amber-500/20"
          >
            ? Supporto
          </button>
          {configured === null ? null : configured ? (
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400">● configurata{savedAccount ? ` · ${savedAccount.slice(0, 6)}…` : ""}</span>
          ) : (
            <span className="rounded-full bg-zinc-700/40 px-2.5 py-0.5 text-xs font-medium text-zinc-400">● non configurata</span>
          )}
        </div>
      </div>
      <p className="mt-2 text-xs text-zinc-400">
        Questo agente genera immagini con <b>Cloudflare Workers AI (FLUX.1-schnell)</b>. La chiave la crei tu, gratis — premi <b>Supporto</b> per la guida passo-passo.
      </p>
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

      {help ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setHelp(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-zinc-100">Come ottenere le credenziali Cloudflare</h3>
              <button onClick={() => setHelp(false)} className="rounded-lg px-2 py-1 text-sm text-zinc-400 hover:bg-white/10 hover:text-zinc-200">✕</button>
            </div>
            <p className="text-xs text-zinc-500">Gratis, free tier (10.000 generazioni/giorno, senza carta).</p>

            <ol className="mt-4 space-y-3 text-sm text-zinc-300">
              <li>
                <span className="font-semibold text-amber-300">1) Account ID</span>
                <p className="mt-1 text-zinc-400">Su <span className="text-zinc-200">dash.cloudflare.com</span> → <b>Workers &amp; Pages</b>. In basso a destra, riquadro <b>Account Details</b> → <b>Account ID</b> con l’icona di copia. (È anche nell’URL, subito dopo <span className="text-zinc-200">dash.cloudflare.com/</span>.)</p>
              </li>
              <li>
                <span className="font-semibold text-amber-300">2) API Token</span>
                <p className="mt-1 text-zinc-400">In alto a destra, <b>icona utente</b> (profilo) → <b>My Profile</b> → menu a sinistra <b>API Tokens</b> → <b>Create Token</b>.</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-400">
                  <li>Se c’è il template <b>“Workers AI”</b>: <span className="text-zinc-200">Use template → Continue → Create Token</span>.</li>
                  <li>Altrimenti <b>Create Custom Token</b>:
                    <ul className="mt-1 list-[circle] space-y-0.5 pl-5">
                      <li><b>Permissions</b>: <span className="text-zinc-200">Account → Workers AI → Read</span></li>
                      <li><b>Account Resources</b>: <span className="text-zinc-200">Include → il tuo account</span></li>
                      <li><span className="text-zinc-200">Continue to summary → Create Token</span></li>
                    </ul>
                  </li>
                  <li>A fine creazione <b>copia il token</b> (si vede <b>una sola volta</b>).</li>
                </ul>
              </li>
              <li>
                <span className="font-semibold text-amber-300">3) Incolla qui</span>
                <p className="mt-1 text-zinc-400">Metti <b>Account ID</b> e <b>Token</b> nei campi e premi <b>Salva</b>. Il token resta solo qui, cifrato.</p>
              </li>
            </ol>

            <div className="mt-5 flex justify-end">
              <button onClick={() => setHelp(false)} className="rounded-xl bg-amber-500/90 px-4 py-2 text-sm font-medium text-zinc-950">Ho capito</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
