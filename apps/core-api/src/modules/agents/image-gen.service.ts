import { Inject, Injectable } from "@nestjs/common";
import { AgentCredentialsService } from "./credentials.service";

export type ImageResult = { ok: true; b64: string } | { ok: false; error: string };

/**
 * Generates images via Cloudflare Workers AI (FLUX.1-schnell) using the requesting
 * user's stored credentials. Returns a base64 PNG. Used by the room orchestrator
 * for agents with capability "image" (Grafico).
 */
@Injectable()
export class ImageGenService {

  constructor(@Inject(AgentCredentialsService) private readonly creds: AgentCredentialsService) {}

  async generate(userId: string, prompt: string): Promise<ImageResult> {
    const c = await this.creds.get(userId, "cloudflare");
    if (!c) return { ok: false, error: "no-credentials" };
    const url = `https://api.cloudflare.com/client/v4/accounts/${c.accountId}/ai/run/@cf/black-forest-labs/flux-1-schnell`;
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: (prompt || "").slice(0, 2000) }),
      });
      if (!r.ok) return { ok: false, error: `cloudflare ${r.status}` };
      const j = (await r.json()) as { result?: { image?: string } };
      const b64 = j.result?.image;
      if (!b64) return { ok: false, error: "no-image-in-response" };
      return { ok: true, b64 };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
}
