import { Inject, Injectable } from "@nestjs/common";
import type { ChatMessage } from "../chatbot/providers";
import { AgentExecutorService, type AgentExecConfig } from "./agent-executor.service";
import { AgentsService } from "./agents.service";

const ROUTER: AgentExecConfig = {
  runtime: "cli",
  provider: "claude-code",
  model: "sonnet",
  systemPrompt:
    "Sei un router di agenti. Rispondi SOLO con lo slug dell'agente piu adatto, niente altro testo.",
};

interface AgentRow {
  slug: string;
  capability: string;
  name: string;
}

@Injectable()
export class CoordinatorService {

  constructor(
    @Inject(AgentExecutorService) private readonly executor: AgentExecutorService,
    @Inject(AgentsService) private readonly agents: AgentsService,
  ) {}

  async route(message: string): Promise<{ slug: string; reason: string }> {

    const list = (await this.agents.list()) as AgentRow[];
    const candidates = list.filter((a) => a.slug !== "coordinator");
    if (candidates.length === 0) return { slug: "default", reason: "no agents" };

    const menu = candidates.map((a) => `${a.slug} (${a.capability})`).join(", ");
    const prompt = `Agenti disponibili: ${menu}.\nMessaggio utente: "${message}".\nRispondi SOLO con lo slug piu adatto.`;

    let out = "";
    try {
      for await (const ch of this.executor.stream(ROUTER, [{ role: "user", content: prompt } as ChatMessage])) {
        out += ch;
      }
    } catch {
      /* fallback sotto */
    }

    const lower = out.toLowerCase();
    const picked = candidates.find((a) => lower.includes(a.slug.toLowerCase()));
    return { slug: (picked ?? candidates[0]).slug, reason: out.trim().slice(0, 120) };
  }
}
