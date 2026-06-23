import Link from "next/link";
import { redirect } from "next/navigation";
import { getToken } from "@/lib/auth";
import { validateSession, getAgentProfile } from "@/lib/api";
import type { AgentProfile } from "@/lib/api";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

const AV = "linear-gradient(135deg,#7c5cff,#a06eff)";

function bullets(t: string | null): string[] {
  return (t ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
}
function meta(m: Record<string, unknown> | null, k: string): string {
  const v = m ? m[k] : undefined;
  return v == null ? "" : String(v);
}

export default async function AgentProfilePage({ params }: { params: Promise<{ slug: string }> }) {

  const { slug } = await params;
  const token = await getToken();
  if (!token) redirect("/login");
  const session = await validateSession(token);
  if (!session) redirect("/login");

  const enabled = process.env.AGENTS_ENABLED === "true";
  const p: AgentProfile | null = enabled ? await getAgentProfile(token, slug) : null;

  return (
    <AppShell username={session.username} displayName={session.displayName}>
      <div className="mx-auto max-w-3xl p-6">
        <Link href="/agent-office" className="text-sm text-zinc-400 hover:text-zinc-200">← Agenti</Link>

        {!p ? (
          <p className="mt-6 text-sm text-zinc-500">Agente non trovato o agentica disabilitata.</p>
        ) : (
          <>
            <div className="mt-3 flex items-center gap-4 rounded-2xl border border-white/10 bg-zinc-900/60 p-5">
              {p.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.avatarUrl} alt={p.name} className="h-20 w-20 rounded-full object-cover" />
              ) : (
                <span className="flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold text-white" style={{ background: AV }}>
                  {p.name.charAt(0).toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-semibold text-zinc-100">{p.name}</h1>
                <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {p.provider}
                </span>
                <p className="mt-1 text-xs text-zinc-500">capability: {p.capability} · modello: {p.model} · runtime: {p.runtime}</p>
              </div>
              <Link href="/boardchat" className="rounded-xl px-4 py-2 text-sm font-medium text-white" style={{ background: AV }}>Avvia chat</Link>
            </div>

            {p.description ? <p className="mt-4 text-sm text-zinc-300">{p.description}</p> : null}

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
                <h2 className="mb-2 text-sm font-semibold text-emerald-400">Cosa fa</h2>
                <ul className="space-y-1 text-sm text-zinc-300">{bullets(p.doesText).map((l, i) => <li key={i}>• {l}</li>)}</ul>
              </div>
              <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-4">
                <h2 className="mb-2 text-sm font-semibold text-red-400">Cosa non fa</h2>
                <ul className="space-y-1 text-sm text-zinc-300">{bullets(p.doesNotText).map((l, i) => <li key={i}>• {l}</li>)}</ul>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-4 gap-3 rounded-2xl border border-white/10 bg-zinc-900/40 p-4">
              <div><div className="text-xs text-zinc-500">Run oggi</div><div className="text-lg font-bold text-zinc-100">{p.stats.runsToday}</div></div>
              <div><div className="text-xs text-zinc-500">Latenza media</div><div className="text-lg font-bold text-zinc-100">{p.stats.avgLatencyMs != null ? `${(p.stats.avgLatencyMs/1000).toFixed(1)}s` : "—"}</div></div>
              <div><div className="text-xs text-zinc-500">Ultimo run</div><div className="text-lg font-bold text-zinc-100">{p.stats.lastRun ? new Date(p.stats.lastRun).toLocaleTimeString() : "—"}</div></div>
              <div><div className="text-xs text-zinc-500">Token ~ (storico)</div><div className="text-lg font-bold text-zinc-100">{p.stats.tokensApprox}</div></div>
            </div>

            <h2 className="mt-6 mb-2 text-sm font-semibold text-zinc-200">Attività recente</h2>
            <div className="space-y-2">
              {p.recent.length === 0 ? <p className="text-sm text-zinc-500">Nessuna attività.</p> :
                p.recent.map((e, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl border border-white/10 bg-zinc-900/60 px-4 py-2 text-sm">
                    <span className="text-zinc-200">{e.eventType.replace("agent.run.", "")}{meta(e.metadata, "to") ? ` → ${meta(e.metadata, "to")}` : ""}</span>
                    <span className="text-xs text-zinc-500">{meta(e.metadata, "durationMs") ? `${meta(e.metadata, "durationMs")} ms · ` : ""}{new Date(e.createdAt).toLocaleTimeString()}</span>
                  </div>
                ))}
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-zinc-900/40 p-4 text-xs text-zinc-500">
              workspace: {p.workspacePath} · contesto: CLAUDE.md / AGENTS.md
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
