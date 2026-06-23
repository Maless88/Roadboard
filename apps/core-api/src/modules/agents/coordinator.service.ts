import { Inject, Injectable } from "@nestjs/common";
import { AgentsService } from "./agents.service";

interface AgentRow { slug: string; capability: string; name: string }

const RESEARCH_HINTS = ["cerca", "ricerc", "notizie", "fonti", "web", "google", "aggiorn", "prezzo", "trova", "link"];

@Injectable()
export class CoordinatorService {

  constructor(@Inject(AgentsService) private readonly agents: AgentsService) {}

  /** Fast capability routing (heuristic, no LLM call). */
  async route(message: string): Promise<{ slug: string; reason: string }> {
    const list = (await this.agents.list()) as AgentRow[];
    const candidates = list.filter((a) => a.slug !== "coordinator");
    if (candidates.length === 0) return { slug: "default", reason: "no agents" };

    const m = (message ?? "").toLowerCase();
    const researcher = candidates.find((a) => a.slug === "researcher" || a.capability === "research");
    if (researcher && RESEARCH_HINTS.some((k) => m.includes(k))) {
      return { slug: researcher.slug, reason: "research keywords" };
    }
    const assistant = candidates.find((a) => a.slug === "assistant" || a.capability === "general") ?? candidates[0];
    return { slug: assistant.slug, reason: "default" };
  }
}
