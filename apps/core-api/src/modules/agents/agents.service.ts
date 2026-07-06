import { Inject, Injectable } from "@nestjs/common";
import { PrismaClient } from "@roadboard/database";
import { optionalEnv } from "@roadboard/config";
import type { AgentExecConfig, AgentRuntime } from "./agent-executor.service";
import { AgentCredentialsService } from "./credentials.service";
import { AgentSkillsService } from "./skills.service";

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
  parts.push(
    "## Regole (anti-allucinazione)\n" +
    "- Non affermare MAI di aver eseguito un'azione (creato/aggiornato task, memory, decisioni, file, commit, o chiamato un tool) se non l'hai davvero eseguita: ogni affermazione di azione deve corrispondere a una chiamata di tool realmente avvenuta in questo turno.\n" +
    "- Riporta solo risultati provenienti da output reali dei tool. Se un tool fallisce o non restituisce dati, dillo; non simulare il successo e non inventare l'output.\n" +
    "- Non inventare ID, nomi, percorsi, valori, conteggi o citazioni. Se non hai il dato, recuperalo con un tool; se non lo trovi, dichiara che non lo sai.\n" +
    "- Non inventare nomi o firme di tool/campi: in caso di dubbio verifica la fonte (es. initial_instructions per i tool RoadBoard).\n" +
    "- Distingui sempre ciò che hai fatto da ciò che proponi o che andrebbe fatto. In caso di incertezza, chiedi invece di indovinare.",
  );
  parts.push("Puoi consultare altri agenti del team: scrivi su una riga separata ESATTAMENTE [[ASK:<slug>]] seguito dalla domanda (es. [[ASK:dev]] quanti progetti ho?). Emetti UNA sola [[ASK]] per volta: dopo che l'agente risponde verrai richiamato AUTOMATICAMENTE per consultarne un altro o dare la risposta finale — NON serve che l'utente ti solleciti e NON devi chiederglielo. Porta a termine l'intera richiesta in autonomia (tutte le consultazioni necessarie), poi rispondi all'utente in modo conciso. Usa le consultazioni solo quando servono davvero.");
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
    @Inject(AgentSkillsService) private readonly skills: AgentSkillsService,
  ) {}

  list(): Promise<unknown> {
    return this.prisma.agentConfig.findMany({
      // Router (Ermes/coordinator) is an internal routing brain, not a user-facing
      // chat agent — exclude it here, consistent with rooms.service participant filter.
      where: { enabled: true, capability: { not: "routing" } },
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

    const skills = await this.skills.attachedFor(slug).catch(() => []);

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
    let hasRealTokens = false;
    const tokens = completed.reduce((acc, e) => {
      const total = num(e, "tokensTotal");
      if (Number.isFinite(total)) { hasRealTokens = true; return acc + total; }
      const c = num(e, "chars");
      return acc + (Number.isFinite(c) ? Math.round(c / 4) : 0);
    }, 0);

    // resolve roomId -> human label for the recent activity rows
    const roomIds = [...new Set(events.map((e) => (e.metadata as Record<string, unknown> | null)?.roomId).filter(Boolean))] as string[];
    const roomLabel: Record<string, string> = {};
    if (roomIds.length) {
      const rooms = await this.prisma.chatRoom.findMany({ where: { id: { in: roomIds } }, include: { participants: true } }).catch(() => []);
      const slugs = [...new Set(rooms.flatMap((r) => r.participants.filter((p) => p.kind === "agent").map((p) => p.refId)))];
      const cfgs = slugs.length ? await this.prisma.agentConfig.findMany({ where: { slug: { in: slugs } }, select: { slug: true, name: true } }) : [];
      const nm = new Map(cfgs.map((c) => [c.slug, c.name]));
      for (const r of rooms) {
        const agentNames = r.participants.filter((p) => p.kind === "agent").map((p) => nm.get(p.refId) ?? p.refId);
        roomLabel[r.id] = r.kind === "group" ? (r.title ?? `Gruppo: ${agentNames.join(", ")}`) : "Chat diretta";
      }
    }

    return {
      name: a.name, slug: a.slug, capability: a.capability,
      trustTier: (a as { trustTier?: string }).trustTier ?? "restricted",
      ownerUserId: (a as { ownerUserId?: string | null }).ownerUserId ?? null,
      runtime: a.runtime, provider: a.provider, model: a.model,
      description: a.description, avatarUrl: a.avatarUrl,
      doesText: a.doesText, doesNotText: a.doesNotText,
      skills,
      workspacePath: wsFor(a.slug),
      stats: {
        runsToday: events.filter((e) => e.createdAt >= todayStart).length,
        avgLatencyMs: avg,
        lastRun: completed[0]?.createdAt ?? null,
        tokensApprox: tokens,
        tokensHaveReal: hasRealTokens,
      },
      recent: events.slice(0, 8).map((e) => {
        const rid = (e.metadata as Record<string, unknown> | null)?.roomId as string | undefined;
        return { eventType: e.eventType, createdAt: e.createdAt, metadata: e.metadata, roomId: rid ?? null, roomLabel: rid ? (roomLabel[rid] ?? null) : null };
      }),
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
