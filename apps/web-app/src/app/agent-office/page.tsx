import { redirect } from "next/navigation";
import { getToken } from "@/lib/auth";
import { validateSession, getAgentActivity } from "@/lib/api";
import type { AgentActivity } from "@/lib/api";
import { AppShell } from "@/components/app-shell";

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

export default async function AgentOfficePage() {

  const token = await getToken();
  if (!token) redirect("/login");

  const session = await validateSession(token);
  if (!session) redirect("/login");

  const enabled = process.env.AGENTS_ENABLED === "true";

  let events: AgentActivity[] = [];
  let error: string | null = null;
  if (enabled) {
    try {
      events = await getAgentActivity(token);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  return (
    <AppShell username={session.username} displayName={session.displayName}>
      <div className="mx-auto max-w-4xl p-6">
        <h1 className="mb-1 text-2xl font-semibold text-zinc-100">Agent Office</h1>
        <p className="mb-6 text-sm text-zinc-400">Attività recente degli agenti.</p>

        {!enabled ? (
          <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-4 text-sm text-zinc-400">
            Agentica disabilitata su questa istanza (AGENTS_ENABLED).
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">{error}</div>
        ) : events.length === 0 ? (
          <p className="text-sm text-zinc-500">Nessuna attività ancora. Usa la boardchat per generare eventi.</p>
        ) : (
          <div className="space-y-2">
            {events.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-zinc-900/60 px-4 py-3"
              >
                <div className="min-w-0">
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      EVENT_TONE[a.eventType] ?? "bg-white/10 text-zinc-300"
                    }`}
                  >
                    {a.eventType.replace("agent.run.", "")}
                  </span>
                  <span className="ml-2 text-sm text-zinc-200">{a.targetId}</span>
                  <span className="ml-2 text-xs text-zinc-500">
                    {[meta(a, "provider"), meta(a, "model"), meta(a, "runtime")].filter(Boolean).join(" · ")}
                  </span>
                  {meta(a, "error") ? (
                    <span className="ml-2 text-xs text-red-400">{meta(a, "error")}</span>
                  ) : null}
                </div>
                <div className="shrink-0 text-right text-xs text-zinc-500">
                  {meta(a, "durationMs") ? `${meta(a, "durationMs")} ms` : ""}
                  <div>{new Date(a.createdAt).toLocaleTimeString()}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
