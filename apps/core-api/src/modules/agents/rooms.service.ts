import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaClient } from "@roadboard/database";

export interface CreateRoomInput {
  kind?: "direct" | "group";
  title?: string;
  projectId?: string;
  agentSlugs: string[];
}

/**
 * Multi-party chat rooms (the "team" model). A room has one owner user plus N
 * agent participants; messages carry an explicit sender. 1:1 chats are just a
 * `direct` room with a single agent. Agent replies are appended by the runtime
 * (Fase 2) via appendMessage().
 */
@Injectable()
export class RoomsService {

  constructor(@Inject("PRISMA") private readonly prisma: PrismaClient) {}

  async createRoom(ownerUserId: string, input: CreateRoomInput): Promise<unknown> {
    const agentSlugs = [...new Set((input.agentSlugs ?? []).filter(Boolean))];
    const kind = input.kind ?? (agentSlugs.length > 1 ? "group" : "direct");
    return this.prisma.chatRoom.create({
      data: {
        kind,
        title: input.title ?? null,
        projectId: input.projectId ?? null,
        ownerUserId,
        participants: {
          create: [
            { kind: "user", refId: ownerUserId },
            ...agentSlugs.map((slug) => ({ kind: "agent", refId: slug })),
          ],
        },
      },
      include: { participants: true },
    });
  }

  async listRooms(ownerUserId: string): Promise<unknown> {
    const rooms = await this.prisma.chatRoom.findMany({
      where: { ownerUserId },
      orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
      include: {
        participants: true,
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
    return rooms.map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      projectId: r.projectId,
      lastMessageAt: r.lastMessageAt,
      agents: r.participants.filter((p) => p.kind === "agent").map((p) => p.refId),
      lastMessage: r.messages[0]?.content?.slice(0, 80) ?? null,
    }));
  }

  private async assertMember(ownerUserId: string, roomId: string) {
    const room = await this.prisma.chatRoom.findUnique({
      where: { id: roomId },
      include: { participants: true },
    });
    if (!room) throw new NotFoundException("room not found");
    if (room.ownerUserId !== ownerUserId) throw new ForbiddenException("not a room member");
    return room;
  }

  async getRoom(ownerUserId: string, roomId: string): Promise<unknown> {
    const room = await this.assertMember(ownerUserId, roomId);
    const messages = await this.prisma.roomMessage.findMany({
      where: { roomId },
      orderBy: { createdAt: "asc" },
      take: 500,
    });
    return {
      id: room.id,
      kind: room.kind,
      title: room.title,
      projectId: room.projectId,
      participants: room.participants.map((p) => ({ kind: p.kind, refId: p.refId })),
      messages: messages.map((m) => ({
        id: m.id, senderKind: m.senderKind, senderId: m.senderId, content: m.content, createdAt: m.createdAt,
      })),
    };
  }

  /** Post a message authored by the owner user (auth-checked). */
  async postMessage(ownerUserId: string, roomId: string, content: string): Promise<unknown> {
    await this.assertMember(ownerUserId, roomId);
    return this.appendMessage(roomId, "user", ownerUserId, content);
  }

  /** Low-level append (no auth check) — used by the agent runtime in Fase 2. */
  async appendMessage(
    roomId: string,
    senderKind: "user" | "agent",
    senderId: string,
    content: string,
  ): Promise<unknown> {
    const msg = await this.prisma.roomMessage.create({
      data: { roomId, senderKind, senderId, content },
    });
    await this.prisma.chatRoom.update({
      where: { id: roomId },
      data: { lastMessageAt: new Date() },
    });
    return msg;
  }

  /** Get-or-create the 1:1 direct room for (owner, agent). Keeps boardchat & Chatboard on one store. */
  async ensureDirectRoom(ownerUserId: string, agentSlug: string): Promise<unknown> {
    const existing = await this.prisma.chatRoom.findMany({
      where: { ownerUserId, kind: "direct" },
      include: { participants: true },
    });
    const hit = existing.find((r) => r.participants.some((p) => p.kind === "agent" && p.refId === agentSlug));
    if (hit) return hit;
    return this.createRoom(ownerUserId, { kind: "direct", agentSlugs: [agentSlug] });
  }

  async addParticipant(ownerUserId: string, roomId: string, agentSlug: string): Promise<unknown> {
    await this.assertMember(ownerUserId, roomId);
    return this.prisma.chatParticipant.upsert({
      where: { roomId_kind_refId: { roomId, kind: "agent", refId: agentSlug } },
      update: {},
      create: { roomId, kind: "agent", refId: agentSlug },
    });
  }
}
