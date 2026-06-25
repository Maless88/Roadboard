import { Inject, Injectable } from "@nestjs/common";
import { AgentsService } from "./agents.service";

interface AgentRow { slug: string; capability: string; name: string }

/**
 * Intent -> capability. Capabilities are matched against each agent's
 * `capability` field via the registry, never against fixed slugs, so adding
 * or renaming an agent needs no code change here.
 */
const CAPABILITY_HINTS: Record<string, string[]> = {
  research: ["cerca", "ricerc", "notizie", "fonti", "web", "google", "aggiorn", "prezzo", "trova", "link"],
  code: ["codice", "code", "bug", "refactor", "implementa", "funzione", "repo", "commit", "compila", "build", "test"],
  ops: ["server", "deploy", "systemctl", "docker", "log", "riavvia", "restart", "disco", "processo", "container", "ssh"],
  image: ["immagine", "immagini", "disegna", "disegno", "avatar", "logo", "grafic", "illustr", "render"],
};

const ROUTER_CAPABILITY = "routing"; // the coordinator itself
const FALLBACK_CAPABILITY = "general";

@Injectable()
export class CoordinatorService {

  constructor(@Inject(AgentsService) private readonly agents: AgentsService) {}

  /** capability -> agents registry, built live from enabled agents (router excluded). */
  private async registry(): Promise<Map<string, AgentRow[]>> {
    const list = (await this.agents.list()) as AgentRow[];
    const reg = new Map<string, AgentRow[]>();
    for (const a of list) {
      const cap = (a.capability ?? "").toLowerCase() || FALLBACK_CAPABILITY;
      if (cap === ROUTER_CAPABILITY) continue;
      const bucket = reg.get(cap);
      if (bucket) bucket.push(a); else reg.set(cap, [a]);
    }
    return reg;
  }

  /**
   * Resolve a requested capability/role to a concrete agent via the registry.
   * Used by free-text routing and by agent-initiated handoffs. null = unmet.
   */
  async resolveCapability(capability: string): Promise<{ slug: string; reason: string } | null> {
    const cap = (capability ?? "").toLowerCase();
    if (!cap) return null;
    const bucket = (await this.registry()).get(cap);
    if (bucket && bucket.length) return { slug: bucket[0].slug, reason: `capability:${cap}` };
    return null;
  }

  /** Map a free-text message to a capability (heuristic, no LLM call). */
  capabilityForMessage(message: string): string {
    const m = (message ?? "").toLowerCase();
    for (const [cap, hints] of Object.entries(CAPABILITY_HINTS)) {
      if (hints.some((k) => m.includes(k))) return cap;
    }
    return FALLBACK_CAPABILITY;
  }

  /** Fast capability routing for the coordinator (heuristic, no LLM call). */
  async route(message: string): Promise<{ slug: string; reason: string }> {
    const reg = await this.registry();
    if (reg.size === 0) return { slug: "default", reason: "no agents" };

    const cap = this.capabilityForMessage(message);
    const hit = reg.get(cap);
    if (hit && hit.length) return { slug: hit[0].slug, reason: `capability:${cap}` };

    const general = reg.get(FALLBACK_CAPABILITY);
    if (general && general.length) return { slug: general[0].slug, reason: "fallback:general" };

    const first = [...reg.values()][0][0];
    return { slug: first.slug, reason: "fallback:first" };
  }
}
