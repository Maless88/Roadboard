import { Inject, Injectable } from "@nestjs/common";
import { PrismaClient } from "@roadboard/database";
import { optionalEnv } from "@roadboard/config";
import type { AgentExecConfig, AgentRuntime } from "./agent-executor.service";
import { AgentCredentialsService } from "./credentials.service";

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
  toolPolicy: "restricted",
};

@Injectable()
export class AgentsService {

  constructor(
    @Inject("PRISMA") private readonly prisma: PrismaClient,
    @Inject(AgentCredentialsService) private readonly creds: AgentCredentialsService,
  ) {}

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

  async profile(slug: string): Promise<unknown> {

    const a = await this.prisma.agentConfig.findFirst({ where: { slug, enabled: true } });
    if (!a) return null;

    const events = await this.prisma.activityEvent.findMany({
      where: { targetId: slug, eventType: { startsWith: "agent." } },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { eventType: true, createdAt: true, metadata: true },
    });

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const completed = events.filter((e) => e.eventType === "agent.run.completed");
    const num = (e: { metadata: unknown }, k: string): number => {
      const m = e.metadata as Record<string, unknown> | null;
      const v = m ? Number(m[k]) : NaN;
      return Number.isFinite(v) ? v : NaN;
    };
    const durations = completed.map((e) => num(e, "durationMs")).filter((n) => Number.isFinite(n));
    const avg = durations.length ? Math.round(durations.reduce((x, y) => x + y, 0) / durations.length) : null;
    const tokens = completed.reduce((acc, e) => {
      const c = num(e, "chars");
      return acc + (Number.isFinite(c) ? Math.round(c / 4) : 0);
    }, 0);

    return {
      name: a.name, slug: a.slug, capability: a.capability,
      trustTier: (a as { trustTier?: string }).trustTier ?? "restricted",
      ownerUserId: (a as { ownerUserId?: string | null }).ownerUserId ?? null,
      runtime: a.runtime, provider: a.provider, model: a.model,
      description: a.description, avatarUrl: a.avatarUrl,
      doesText: a.doesText, doesNotText: a.doesNotText,
      workspacePath: wsFor(a.slug),
      stats: {
        runsToday: events.filter((e) => e.createdAt >= todayStart).length,
        avgLatencyMs: avg,
        lastRun: completed[0]?.createdAt ?? null,
        tokensApprox: tokens,
      },
      recent: events.slice(0, 8).map((e) => ({ eventType: e.eventType, createdAt: e.createdAt, metadata: e.metadata })),
    };
  }

  async resolveForChat(slug?: string, userId?: string): Promise<{ slug: string; config: AgentExecConfig }> {

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

    // owner-gate: elevated tiers only for the agent owner; otherwise downgrade.
    const tier = (row as { trustTier?: string }).trustTier ?? "restricted";
    const ownerUserId = (row as { ownerUserId?: string | null }).ownerUserId ?? null;
    const isOwner = !!ownerUserId && !!userId && ownerUserId === userId;
    const toolPolicy = tier !== "restricted" && isOwner ? tier : "restricted";

    const rbMcp = userId ? await this.creds.get(userId, "roadboard-mcp").catch(() => null) : null;
    return {
      slug: row.slug,
      config: {
        runtime: row.runtime as AgentRuntime,
        provider: row.provider,
        model: row.model,
        systemPrompt: buildAgentContext(row as unknown as AgentRow),
        workspacePath: wsFor(row.slug),
        toolPolicy,
        roadboardMcpUrl: rbMcp?.accountId ?? null,
        roadboardMcpToken: rbMcp?.token ?? null,
      },
    };
  }
}
