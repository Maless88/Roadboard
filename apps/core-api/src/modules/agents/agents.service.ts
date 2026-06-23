import { Inject, Injectable } from "@nestjs/common";
import { PrismaClient } from "@roadboard/database";
import { optionalEnv } from "@roadboard/config";
import type { AgentExecConfig, AgentRuntime } from "./agent-executor.service";

const WS_BASE = optionalEnv("AGENT_WORKSPACES_BASE", "/home/alessio/agent-workspaces");
function wsFor(slug: string): string { return `${WS_BASE}/${slug}`; }

function bullets(t: string | null | undefined): string {
  if (!t) return "";
  return t.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => `- ${l}`).join("\n");
}

interface AgentRow {
  name: string; slug: string; description: string | null;
  systemPrompt: string | null; doesText: string | null; doesNotText: string | null;
}

export function buildAgentContext(a: AgentRow): string {
  const parts: string[] = [`# ${a.name}`];
  if (a.description) parts.push(a.description);
  if (a.systemPrompt) parts.push(a.systemPrompt);
  const does = bullets(a.doesText);
  if (does) parts.push(`## Cosa fa\n${does}`);
  const dont = bullets(a.doesNotText);
  if (dont) parts.push(`## Cosa non fa\n${dont}`);
  parts.push("Rispondi in italiano, conciso e diretto, niente preamboli.");
  return parts.join("\n\n");
}

const BUILTIN_DEFAULT: AgentExecConfig = {
  runtime: "cli",
  provider: "claude-code",
  model: "sonnet",
  systemPrompt:
    "Sei l'assistente del life-OS RoadBoard. Rispondi in modo conciso, pratico e in italiano.",
  workspacePath: `${WS_BASE}/assistant`,
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
        systemPrompt: buildAgentContext(row as unknown as AgentRow),
        workspacePath: wsFor(row.slug),
      },
    };
  }
}
