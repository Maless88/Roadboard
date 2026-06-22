import { redirect } from "next/navigation";
import { getToken } from "@/lib/auth";
import { validateSession, getAgentContacts } from "@/lib/api";
import type { AgentContact } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import { BoardChatClient } from "./board-chat-client";

export const dynamic = "force-dynamic";

export default async function BoardchatPage() {

  const token = await getToken();
  if (!token) redirect("/login");

  const session = await validateSession(token);
  if (!session) redirect("/login");

  const enabled = process.env.AGENTS_ENABLED === "true";
  let contacts: AgentContact[] = [];
  if (enabled) {
    try {
      contacts = await getAgentContacts(token);
    } catch {
      contacts = [];
    }
  }

  return (
    <AppShell username={session.username} displayName={session.displayName}>
      {enabled ? (
        <BoardChatClient initialContacts={contacts} />
      ) : (
        <div className="mx-auto max-w-2xl p-6 text-sm text-zinc-400">
          L&apos;agentica e disabilitata su questa istanza (AGENTS_ENABLED).
        </div>
      )}
    </AppShell>
  );
}
