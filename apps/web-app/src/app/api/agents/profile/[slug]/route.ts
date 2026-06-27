import { getToken } from "@/lib/auth";
export const dynamic = "force-dynamic";
const CORE_API = process.env.CORE_API_URL ?? "http://localhost:3001";
export async function GET(
  _req: Request,
  context: { params: Promise<{ slug: string }> },
): Promise<Response> {
  if (process.env.AGENTS_ENABLED !== "true") return new Response("null", { status: 200, headers: { "Content-Type": "application/json" } });
  const token = await getToken();
  if (!token) return new Response("unauthorized", { status: 401 });
  const { slug } = await context.params;
  const r = await fetch(`${CORE_API}/agents/profile/${encodeURIComponent(slug)}`, {
    headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
  });
  return new Response(await r.text(), { status: r.status, headers: { "Content-Type": "application/json" } });
}
