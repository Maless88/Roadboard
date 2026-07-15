import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@roadboard/database';
import { optionalEnv } from '@roadboard/config';
import {
  AgentExecutor,
  type AgentExecConfig,
  type AgentRuntime,
  type ChatMessage,
} from '@roadboard/agent-runtime';

const WS_BASE = optionalEnv('AGENT_WORKSPACES_BASE', '/var/lib/roadboard/agent-workspaces');
const PREVIEW_LEN = 280;


function wsFor(slug: string): string {

  return `${WS_BASE}/${slug}`;
}


function bullets(t: string | null | undefined): string {

  if (!t) return '';

  return t.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => `- ${l}`).join('\n');
}


interface AgentRow {
  name: string;
  description: string | null;
  systemPrompt: string | null;
  doesText: string | null;
  doesNotText: string | null;
}


/**
 * Builds the agent persona system prompt. Mirrors core-api AgentsService so a
 * scheduled run produces the same voice as an interactive chat turn.
 */
function buildAgentContext(a: AgentRow): string {

  const parts: string[] = [`# ${a.name}`];

  if (a.description) parts.push(a.description);

  if (a.systemPrompt) parts.push(a.systemPrompt);

  const does = bullets(a.doesText);

  if (does) parts.push(`## Cosa fa\n${does}`);

  const dont = bullets(a.doesNotText);

  if (dont) parts.push(`## Cosa non fa\n${dont}`);

  parts.push('Rispondi in italiano, conciso e diretto, niente preamboli.');

  return parts.join('\n\n');
}


const BUILTIN_DEFAULT: AgentExecConfig = {
  runtime: 'cli',
  provider: 'claude-code',
  model: 'sonnet',
  systemPrompt:
    "Sei l'assistente del life-OS RoadBoard. Rispondi in modo conciso, pratico e in italiano.",
  workspacePath: `${WS_BASE}/assistant`,
  toolPolicy: 'restricted',
};


interface RunResult {
  ok: boolean;
  outputMessageId: string | null;
  outputPreview: string | null;
  error: string | null;
  durationMs: number;
}


/**
 * Executes one scheduled activity run: resolves the responder agent, streams
 * the promptTemplate through the shared AgentExecutor, persists the reply into
 * the delivery room (auto-creating the agent's direct room when none is set),
 * and records the outcome on the ScheduledActivityRun row.
 */
@Injectable()
export class AgentRunRunner implements OnModuleInit, OnModuleDestroy {

  private readonly logger = new Logger(AgentRunRunner.name);
  private readonly prisma = new PrismaClient();
  private readonly executor = new AgentExecutor();


  async onModuleInit(): Promise<void> {

    await this.prisma.$connect();
  }


  async onModuleDestroy(): Promise<void> {

    await this.prisma.$disconnect();
  }


  async run(activityId: string, runId: string): Promise<void> {

    const started = Date.now();

    await this.prisma.scheduledActivityRun.update({
      where: { id: runId },
      data: { status: 'running' },
    });

    const activity = await this.prisma.scheduledActivity.findUnique({ where: { id: activityId } });

    if (!activity) {

      await this.finish(runId, {
        ok: false,
        outputMessageId: null,
        outputPreview: null,
        error: `activity ${activityId} not found`,
        durationMs: Date.now() - started,
      });
      return;
    }

    try {
      const { slug, config } = await this.resolveAgent(activity.agentSlug, activity.userId);
      const roomId = await this.resolveRoom(activity.deliveryRoomId, activity.userId, slug);

      const messages: ChatMessage[] = [{ role: 'user', content: activity.promptTemplate }];

      let reply = '';

      for await (const chunk of this.executor.stream(config, messages)) {
        reply += chunk;
      }

      let outputMessageId: string | null = null;

      if (reply.length > 0) {
        outputMessageId = await this.appendMessage(roomId, 'agent', slug, reply);
      }

      await this.finish(runId, {
        ok: true,
        outputMessageId,
        outputPreview: reply.slice(0, PREVIEW_LEN) || null,
        error: null,
        durationMs: Date.now() - started,
      });

      this.logger.log(`[agent-run] activity ${activityId} run ${runId} ok (chars=${reply.length})`);
    } catch (err) {

      const message = err instanceof Error ? err.message : String(err);

      await this.finish(runId, {
        ok: false,
        outputMessageId: null,
        outputPreview: null,
        error: message.slice(0, 1000),
        durationMs: Date.now() - started,
      });

      this.logger.error(`[agent-run] activity ${activityId} run ${runId} error: ${message}`);
    }
  }


  private async finish(runId: string, result: RunResult): Promise<void> {

    await this.prisma.scheduledActivityRun.update({
      where: { id: runId },
      data: {
        status: result.ok ? 'ok' : 'error',
        outputMessageId: result.outputMessageId,
        outputPreview: result.outputPreview,
        error: result.error,
        durationMs: result.durationMs,
      },
    });
  }


  /** Resolve the agent's exec config. Mirrors core-api AgentsService.resolveForChat. */
  private async resolveAgent(slug: string, userId: string): Promise<{ slug: string; config: AgentExecConfig }> {

    let row = await this.prisma.agentConfig.findFirst({ where: { slug, enabled: true } });

    if (!row) {
      row = await this.prisma.agentConfig.findFirst({ where: { enabled: true }, orderBy: { createdAt: 'asc' } });
    }

    if (!row) {
      return { slug: 'default', config: BUILTIN_DEFAULT };
    }

    const tier = row.trustTier ?? 'restricted';
    const ownerUserId = row.ownerUserId ?? null;
    const isOwner = !!ownerUserId && !!userId && ownerUserId === userId;
    const toolPolicy = tier !== 'restricted' && isOwner ? tier : 'restricted';

    return {
      slug: row.slug,
      config: {
        runtime: row.runtime as AgentRuntime,
        provider: row.provider,
        model: row.model,
        systemPrompt: buildAgentContext(row),
        workspacePath: wsFor(row.slug),
        toolPolicy,
      },
    };
  }


  private async resolveRoom(deliveryRoomId: string | null, userId: string, slug: string): Promise<string> {

    if (deliveryRoomId) return deliveryRoomId;

    return this.ensureDirectRoom(userId, slug);
  }


  /** Get-or-create the 1:1 direct room for (owner, agent). Mirrors RoomsService.ensureDirectRoom. */
  private async ensureDirectRoom(ownerUserId: string, agentSlug: string): Promise<string> {

    const existing = await this.prisma.chatRoom.findMany({
      where: { ownerUserId, kind: 'direct' },
      include: { participants: true },
    });

    const hit = existing.find((r) => r.participants.some((p) => p.kind === 'agent' && p.refId === agentSlug));

    if (hit) return hit.id;

    const created = await this.prisma.chatRoom.create({
      data: {
        kind: 'direct',
        ownerUserId,
        participants: {
          create: [
            { kind: 'user', refId: ownerUserId },
            { kind: 'agent', refId: agentSlug },
          ],
        },
      },
    });

    return created.id;
  }


  /** Low-level append. Mirrors RoomsService.appendMessage. */
  private async appendMessage(
    roomId: string,
    senderKind: 'user' | 'agent',
    senderId: string,
    content: string,
  ): Promise<string> {

    const msg = await this.prisma.roomMessage.create({
      data: { roomId, senderKind, senderId, content },
    });

    await this.prisma.chatRoom.update({
      where: { id: roomId },
      data: { lastMessageAt: new Date() },
    });

    return msg.id;
  }
}
