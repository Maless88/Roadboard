import { getToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

const CORE_API = process.env.CORE_API_URL ?? "http://localhost:3001";

export async function GET(): Promise<Response> {
  if (process.env.AGENTS_ENABLED !== "true") {
    return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
  }
  const token = await getToken();
  if (!token) return new Response("unauthorized", { status: 401 });
  const r = await fetch(`${CORE_API}/agents/rooms`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return new Response(await r.text(), { status: r.status, headers: { "Content-Type": "application/json" } });
}

export async function POST(req: Request): Promise<Response> {
  if (process.env.AGENTS_ENABLED !== "true") return new Response("agents disabled", { status: 403 });
  const token = await getToken();
  if (!token) return new Response("unauthorized", { status: 401 });
  const body = await req.text();
  const r = await fetch(`${CORE_API}/agents/rooms`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body,
  });
  return new Response(await r.text(), { status: r.status, headers: { "Content-Type": "application/json" } });
}
