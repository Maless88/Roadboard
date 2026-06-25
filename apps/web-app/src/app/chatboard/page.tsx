import { redirect } from "next/navigation";
import { getToken } from "@/lib/auth";
import { validateSession } from "@/lib/api";
import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { ChatboardClient } from "./chatboard-client";

export const dynamic = "force-dynamic";

export default async function ChatboardPage() {
  const token = await getToken();
  if (!token) redirect("/login");
  const session = await validateSession(token);
  if (!session) redirect("/login");

  const enabled = process.env.AGENTS_ENABLED === "true";
  return (
    <AppShell username={session.username} displayName={session.displayName}>
      {enabled ? (
        <Suspense fallback={null}>
          <ChatboardClient displayName={session.displayName} />
        </Suspense>
      ) : (
        <div className="mx-auto max-w-2xl p-6 text-sm text-zinc-400">
          L&apos;agentica è disabilitata su questa istanza (AGENTS_ENABLED).
        </div>
      )}
    </AppShell>
  );
}
