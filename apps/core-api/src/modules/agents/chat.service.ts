import { Inject, Injectable } from "@nestjs/common";
import { PrismaClient } from "@roadboard/database";

@Injectable()
export class ChatService {

  constructor(@Inject("PRISMA") private readonly prisma: PrismaClient) {}

  async getOrCreateThread(ownerUserId: string, agentSlug: string): Promise<{ id: string }> {
    return this.prisma.chatThread.upsert({
      where: { ownerUserId_agentSlug: { ownerUserId, agentSlug } },
      update: {},
      create: { ownerUserId, agentSlug },
      select: { id: true },
    });
  }

  async appendMessage(threadId: string, role: string, content: string): Promise<void> {
    await this.prisma.chatMessage.create({ data: { threadId, role, content } });
    await this.prisma.chatThread.update({
      where: { id: threadId },
      data: { lastMessageAt: new Date() },
    });
  }

  async listMessages(ownerUserId: string, agentSlug: string): Promise<unknown> {
    const t = await this.prisma.chatThread.findUnique({
      where: { ownerUserId_agentSlug: { ownerUserId, agentSlug } },
      select: { id: true },
    });
    if (!t) return [];
    return this.prisma.chatMessage.findMany({
      where: { threadId: t.id },
      orderBy: { createdAt: "asc" },
      take: 200,
      select: { id: true, role: true, content: true, createdAt: true },
    });
  }

  async contacts(ownerUserId: string): Promise<unknown> {
    const agents = await this.prisma.agentConfig.findMany({
      where: { enabled: true },
      orderBy: { createdAt: "asc" },
      select: { name: true, slug: true, capability: true, provider: true, model: true },
    });
    const threads = await this.prisma.chatThread.findMany({
      where: { ownerUserId },
      select: {
        agentSlug: true,
        lastMessageAt: true,
        messages: { orderBy: { createdAt: "desc" }, take: 1, select: { content: true } },
      },
    });
    const bySlug = new Map(threads.map((t) => [t.agentSlug, t]));
    return agents.map((a) => {
      const t = bySlug.get(a.slug);
      const last = t?.messages?.[0]?.content ?? null;
      return {
        ...a,
        lastMessage: last ? last.slice(0, 60) : null,
        lastMessageAt: t?.lastMessageAt ?? null,
      };
    });
  }
}
