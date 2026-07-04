import Link from "next/link";
import { redirect } from "next/navigation";
import { getToken } from "@/lib/auth";
import { validateSession, getAgentActivity, getOpsStatus } from "@/lib/api";
import type { AgentActivity, OpsStatus } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import { isLifeOsUser } from "@/lib/access";

export const dynamic = "force-dynamic";

const EVENT_TONE: Record<string, string> = {
  "agent.run.completed": "bg-green-500/15 text-green-400",
  "agent.run.started": "bg-indigo-500/15 text-indigo-300",
  "agent.run.failed": "bg-red-500/15 text-red-400",
};

function meta(a: AgentActivity, k: string): string {
  const v = a.metadata ? a.metadata[k] : undefined;
  return v == null ? "" : String(v);
}

function StatusBadge({ status }: { status: string }) {
  const ok = status === "ok";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${ok ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-green-400" : "bg-red-400"}`} />
      {status}
    </span>
  );
}

export default async function AgentiSistemaPage() {

  const token = await getToken();
  if (!token) redirect("/login");
  const session = await validateSession(token);
  if (!session) redirect("/login");
  if (!isLifeOsUser(session)) redirect("/dashboard");

  const enabled = process.env.AGENTS_ENABLED === "true";

  let events: AgentActivity[] = [];
  let activityError: string | null = null;
  if (enabled) {
    try { events = await getAgentActivity(token); } catch (e) { activityError = e instanceof Error ? e.message : String(e); }
  }

  let ops: OpsStatus | null = null;
  let opsError: string | null = null;
  try { ops = await getOpsStatus(token); } catch (e) { opsError = e instanceof Error ? e.message : String(e); }

  return (
    <AppShell username={session.username} displayName={session.displayName}>
      <div className="mx-auto max-w-4xl p-6">
        <h1 className="mb-1 text-2xl font-semibold text-zinc-100">Agenti &amp; Sistema</h1>
        <p className="mb-6 text-sm text-zinc-400">Salute dei servizi e attività recente degli agenti.</p>

        {/* ---- Sistema / Ops ---- */}
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Sistema</h2>
          {ops ? (
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${ops.overall === "ok" ? "bg-green-500/15 text-green-400" : "bg-amber-500/15 text-amber-400"}`}>{ops.overall}</span>
          ) : null}
        </div>
        {opsError ? (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">Impossibile leggere lo stato: {opsError}</div>
        ) : ops ? (
          <div className="mb-8 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/60">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left text-zinc-400">
                <tr><th className="px-4 py-3 font-medium">Componente</th><th className="px-4 py-3 font-medium">Stato</th><th className="px-4 py-3 font-medium">Latenza</th><th className="px-4 py-3 font-medium">Dettaglio</th></tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-zinc-200">
                <tr><td className="px-4 py-3">{ops.api.name}</td><td className="px-4 py-3"><StatusBadge status={ops.api.status} /></td><td className="px-4 py-3 text-zinc-500">—</td><td className="px-4 py-3 text-zinc-500">—</td></tr>
                <tr><td className="px-4 py-3">{ops.database.name}</td><td className="px-4 py-3"><StatusBadge status={ops.database.status} /></td><td className="px-4 py-3">{ops.database.latencyMs != null ? `${ops.database.latencyMs} ms` : "—"}</td><td className="px-4 py-3 text-zinc-500">{ops.database.detail ?? "—"}</td></tr>
                {ops.services.map((s) => (
                  <tr key={s.name}><td className="px-4 py-3">{s.name}</td><td className="px-4 py-3"><StatusBadge status={s.status} /></td><td className="px-4 py-3">{s.latencyMs != null ? `${s.latencyMs} ms` : "—"}</td><td className="px-4 py-3 text-zinc-500">{s.detail ?? "—"}</td></tr>
                ))}
                {ops.services.length === 0 ? <tr><td colSpan={4} className="px-4 py-3 text-zinc-500">Nessun servizio configurato (OPS_HEALTH_TARGETS).</td></tr> : null}
              </tbody>
            </table>
            <div className="border-t border-white/5 px-4 py-2 text-xs text-zinc-500">Aggiornato: {new Date(ops.generatedAt).toLocaleString()}</div>
          </div>
        ) : null}

        {/* ---- Agenti / attività ---- */}
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">Attività agenti</h2>
        {!enabled ? (
          <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-4 text-sm text-zinc-400">Agentica disabilitata su questa istanza (AGENTS_ENABLED).</div>
        ) : activityError ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">{activityError}</div>
        ) : events.length === 0 ? (
          <p className="text-sm text-zinc-500">Nessuna attività ancora.</p>
        ) : (
          <div className="space-y-2">
            {events.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-zinc-900/60 px-4 py-3">
                <div className="min-w-0">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${EVENT_TONE[a.eventType] ?? "bg-white/10 text-zinc-300"}`}>{a.eventType.replace("agent.run.", "")}</span>
                  <Link href={`/agents/${a.targetId}`} className="ml-2 text-sm text-zinc-200 underline-offset-2 hover:underline">{a.targetId}</Link>
                  <span className="ml-2 text-xs text-zinc-500">{[meta(a, "provider"), meta(a, "model"), meta(a, "runtime")].filter(Boolean).join(" · ")}</span>
                  {meta(a, "error") ? <span className="ml-2 text-xs text-red-400">{meta(a, "error")}</span> : null}
                </div>
                <div className="shrink-0 text-right text-xs text-zinc-500">{meta(a, "durationMs") ? `${meta(a, "durationMs")} ms` : ""}<div>{new Date(a.createdAt).toLocaleTimeString()}</div></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
