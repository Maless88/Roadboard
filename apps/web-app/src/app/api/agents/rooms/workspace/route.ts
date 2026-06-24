import { getToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

const CORE_API = process.env.CORE_API_URL ?? "http://localhost:3001";

export async function POST(): Promise<Response> {
  if (process.env.AGENTS_ENABLED !== "true") return new Response("agents disabled", { status: 403 });
  const token = await getToken();
  if (!token) return new Response("unauthorized", { status: 401 });
  const r = await fetch(`${CORE_API}/agents/rooms/workspace`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  return new Response(await r.text(), { status: r.status, headers: { "Content-Type": "application/json" } });
}
