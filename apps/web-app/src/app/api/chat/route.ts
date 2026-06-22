import { getToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

const CORE_API = process.env.CORE_API_URL ?? "http://localhost:3001";

export async function GET(req: Request): Promise<Response> {

  if (process.env.AGENTS_ENABLED !== "true") {
    return new Response("agents disabled", { status: 403 });
  }

  const token = await getToken();
  if (!token) return new Response("unauthorized", { status: 401 });

  const message = new URL(req.url).searchParams.get("message") ?? "";

  const upstream = await fetch(
    `${CORE_API}/agents/chat?message=${encodeURIComponent(message)}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" } },
  );

  if (!upstream.ok || !upstream.body) {
    return new Response("chat error", { status: upstream.status || 502 });
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  let eventLines: string[] = [];

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line === "") {
            if (eventLines.length > 0) {
              const payload = eventLines.join("\n");
              eventLines = [];
              if (payload === "[DONE]") {
                controller.close();
                return;
              }
              controller.enqueue(encoder.encode(payload));
            }
            continue;
          }
          if (line.startsWith("data:")) {
            eventLines.push(line.slice(5).replace(/^ /, ""));
          }
        }
        return;
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
