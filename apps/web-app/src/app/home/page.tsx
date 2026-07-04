import { redirect } from "next/navigation";
import { getToken } from "@/lib/auth";
import { validateSession, getAgentContacts, getAgentActivity } from "@/lib/api";
import type { AgentContact, AgentActivity } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import { isLifeOsUser } from "@/lib/access";
import { HomeClient } from "./home-client";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const token = await getToken();
  if (!token) redirect("/login");
  const session = await validateSession(token);
  if (!session) redirect("/login");
  if (!isLifeOsUser(session)) redirect("/dashboard");

  const enabled = process.env.AGENTS_ENABLED === "true";
  let contacts: AgentContact[] = [];
  let activity: AgentActivity[] = [];
  if (enabled) {
    try { contacts = await getAgentContacts(token); } catch { contacts = []; }
    try { activity = await getAgentActivity(token); } catch { activity = []; }
  }

  return (
    <AppShell username={session.username} displayName={session.displayName}>
      {enabled ? (
        <HomeClient displayName={session.displayName} contacts={contacts} activity={activity} />
      ) : (
        <div className="mx-auto max-w-2xl p-6 text-sm text-zinc-400">
          L&apos;agentica è disabilitata su questa istanza (AGENTS_ENABLED).
        </div>
      )}
    </AppShell>
  );
}
