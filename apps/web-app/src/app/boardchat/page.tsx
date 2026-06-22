import { redirect } from "next/navigation";
import { getToken } from "@/lib/auth";
import { validateSession } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import { BoardChatClient } from "./board-chat-client";

export const dynamic = "force-dynamic";

export default async function BoardchatPage() {

  const token = await getToken();
  if (!token) redirect("/login");

  const session = await validateSession(token);
  if (!session) redirect("/login");

  const enabled = process.env.AGENTS_ENABLED === "true";

  return (
    <AppShell username={session.username} displayName={session.displayName}>
      {enabled ? (
        <BoardChatClient />
      ) : (
        <div className="mx-auto max-w-2xl p-6 text-sm text-zinc-400">
          L&apos;agentica e disabilitata su questa istanza (AGENTS_ENABLED).
        </div>
      )}
    </AppShell>
  );
}
