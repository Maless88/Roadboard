import { getToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

const CORE_API = process.env.CORE_API_URL ?? "http://localhost:3001";

export async function GET(req: Request): Promise<Response> {
  if (process.env.AGENTS_ENABLED !== "true") {
    return new Response(JSON.stringify({ configured: false }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  const token = await getToken();
  if (!token) return new Response("unauthorized", { status: 401 });
  const provider = new URL(req.url).searchParams.get("provider") ?? "cloudflare";
  const r = await fetch(`${CORE_API}/agents/credentials/status?provider=${encodeURIComponent(provider)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return new Response(await r.text(), { status: r.status, headers: { "Content-Type": "application/json" } });
}
