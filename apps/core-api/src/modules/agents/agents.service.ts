import { Inject, Injectable } from "@nestjs/common";
import { PrismaClient } from "@roadboard/database";
import type { AgentExecConfig, AgentRuntime } from "./agent-executor.service";

const BUILTIN_DEFAULT: AgentExecConfig = {
  runtime: "cli",
  provider: "claude-code",
  model: "sonnet",
  systemPrompt:
    "Sei l'assistente del life-OS RoadBoard. Rispondi in modo conciso, pratico e in italiano.",
};

@Injectable()
export class AgentsService {

  constructor(@Inject("PRISMA") private readonly prisma: PrismaClient) {}

  list(): Promise<unknown> {
    return this.prisma.agentConfig.findMany({
      where: { enabled: true },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        capability: true,
        runtime: true,
        provider: true,
        model: true,
      },
    });
  }

  async resolveForChat(slug?: string): Promise<{ slug: string; config: AgentExecConfig }> {

    let row = null;

    if (slug) {
      row = await this.prisma.agentConfig.findFirst({ where: { slug, enabled: true } });
    }
    if (!row) {
      row = await this.prisma.agentConfig.findFirst({
        where: { enabled: true },
        orderBy: { createdAt: "asc" },
      });
    }
    if (!row) {
      return { slug: "default", config: BUILTIN_DEFAULT };
    }

    return {
      slug: row.slug,
      config: {
        runtime: row.runtime as AgentRuntime,
        provider: row.provider,
        model: row.model,
        systemPrompt: row.systemPrompt,
      },
    };
  }
}
