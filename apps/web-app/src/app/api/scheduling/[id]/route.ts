import { getToken } from "@/lib/auth";
export const dynamic = "force-dynamic";
const CORE_API = process.env.CORE_API_URL ?? "http://localhost:3001";
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const token = await getToken();
  if (!token) return new Response("unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const body = await req.text();
  const r = await fetch(`${CORE_API}/scheduling/${encodeURIComponent(id)}`, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body });
  return new Response(await r.text(), { status: r.status, headers: { "Content-Type": "application/json" } });
}
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const token = await getToken();
  if (!token) return new Response("unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const r = await fetch(`${CORE_API}/scheduling/${encodeURIComponent(id)}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
  return new Response(await r.text(), { status: r.status, headers: { "Content-Type": "application/json" } });
}
