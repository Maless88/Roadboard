import { redirect } from "next/navigation";
import { getToken } from "@/lib/auth";
import { validateSession } from "@/lib/api";
import { AppShell } from "@/components/app-shell";
import { isLifeOsUser } from "@/lib/access";
import { SchedulingClient } from "./scheduling-client";

export const dynamic = "force-dynamic";

export default async function SchedulingPage() {
  const token = await getToken();
  if (!token) redirect("/login");
  const session = await validateSession(token);
  if (!session) redirect("/login");
  if (!isLifeOsUser(session)) redirect("/dashboard");
  return (
    <AppShell username={session.username} displayName={session.displayName}>
      <SchedulingClient />
    </AppShell>
  );
}
