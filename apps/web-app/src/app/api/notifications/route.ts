import { getToken } from "@/lib/auth";
export const dynamic = "force-dynamic";
const CORE_API = process.env.CORE_API_URL ?? "http://localhost:3001";

export async function GET(req: Request): Promise<Response> {
  const empty = JSON.stringify({ items: [], unread: 0 });
  if (process.env.AGENTS_ENABLED !== "true") return new Response(empty, { status: 200, headers: { "Content-Type": "application/json" } });
  const token = await getToken();
  if (!token) return new Response(empty, { status: 200, headers: { "Content-Type": "application/json" } });
  const sp = new URL(req.url).searchParams;
  const limit = sp.get("limit") ?? "30";
  const scope = sp.get("scope") === "all" ? "&scope=all" : "";
  const r = await fetch(`${CORE_API}/notifications?limit=${encodeURIComponent(limit)}${scope}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  return new Response(await r.text(), { status: r.status, headers: { "Content-Type": "application/json" } });
}
