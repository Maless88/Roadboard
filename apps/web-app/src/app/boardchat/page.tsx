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

  return (
    <AppShell username={session.username} displayName={session.displayName}>
      <BoardChatClient />
    </AppShell>
  );
}
