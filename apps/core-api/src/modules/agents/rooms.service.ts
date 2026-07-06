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
    // Only surface user-facing agents: hide internal/disabled ones (e.g. the
    // routing coordinator), consistent with the contacts/roster filter.
    const visible = await this.prisma.agentConfig.findMany({
      where: { enabled: true, capability: { not: "routing" } },
      select: { slug: true },
    });
    const visibleSlugs = new Set(visible.map((a) => a.slug));
    return rooms
      .map((r) => ({
        id: r.id,
        kind: r.kind,
        title: r.title,
        projectId: r.projectId,
        lastMessageAt: r.lastMessageAt,
        agents: r.participants
          .filter((p) => p.kind === "agent" && visibleSlugs.has(p.refId))
          .map((p) => p.refId),
        lastMessage: r.messages[0]?.content?.slice(0, 80) ?? null,
      }))
      // Drop rooms left with no visible agent (e.g. the coordinator-only room).
      .filter((r) => r.agents.length > 0);
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

  /** Messaggi paginati: ultimi `limit` o quelli prima del cursore `before` (id messaggio). */
  async listRoomMessages(ownerUserId: string, roomId: string, before: string | undefined, limit: number): Promise<unknown> {
    await this.assertMember(ownerUserId, roomId);
    const take = Math.min(Math.max(limit || 50, 1), 100);
    let beforeDate: Date | undefined;
    if (before) {
      const cur = await this.prisma.roomMessage.findUnique({ where: { id: before } });
      if (cur) beforeDate = cur.createdAt;
    }
    const rows = await this.prisma.roomMessage.findMany({
      where: { roomId, ...(beforeDate ? { createdAt: { lt: beforeDate } } : {}) },
      orderBy: { createdAt: "desc" },
      take: take + 1,
    });
    const hasMore = rows.length > take;
    const page = rows.slice(0, take).reverse();
    return {
      hasMore,
      messages: page.map((m) => ({ id: m.id, senderKind: m.senderKind, senderId: m.senderId, content: m.content, createdAt: m.createdAt })),
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

  /** Resolve the linked git repo URL for a project (CodeRepository), or null. */
  async getProjectRepoUrl(projectId: string): Promise<string | null> {
    if (!projectId) return null;
    const repo = await this.prisma.codeRepository.findFirst({
      where: { projectId, repoUrl: { not: null } },
      select: { repoUrl: true },
    });
    return repo?.repoUrl ?? null;
  }

  /** Get-or-create the shared 'Workspace' group room with all enabled non-router agents. */
  async ensureWorkspaceRoom(ownerUserId: string): Promise<unknown> {
    const found = await this.prisma.chatRoom.findFirst({
      where: { ownerUserId, kind: "group", title: "Workspace" },
      include: { participants: true },
    });
    if (found) return found;
    const agents = await this.prisma.agentConfig.findMany({ where: { enabled: true }, select: { slug: true, capability: true } });
    const slugs = agents.filter((a) => (a.capability ?? "").toLowerCase() !== "routing").map((a) => a.slug);
    return this.createRoom(ownerUserId, { kind: "group", title: "Workspace", agentSlugs: slugs });
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
    const p = await this.prisma.chatParticipant.upsert({
      where: { roomId_kind_refId: { roomId, kind: "agent", refId: agentSlug } },
      update: {},
      create: { roomId, kind: "agent", refId: agentSlug },
    });
    // a room with more than one agent is a group
    const agentCount = await this.prisma.chatParticipant.count({ where: { roomId, kind: "agent" } });
    if (agentCount > 1) await this.prisma.chatRoom.update({ where: { id: roomId }, data: { kind: "group" } });
    return p;
  }


  async deleteRoom(ownerUserId: string, roomId: string): Promise<unknown> {
    await this.assertMember(ownerUserId, roomId);

    // Cascade in schema.prisma removes participants and messages.
    await this.prisma.chatRoom.delete({ where: { id: roomId } });
    return { ok: true, id: roomId };
  }


  async clearMessages(ownerUserId: string, roomId: string): Promise<unknown> {
    await this.assertMember(ownerUserId, roomId);

    const result = await this.prisma.roomMessage.deleteMany({ where: { roomId } });
    await this.prisma.chatRoom.update({ where: { id: roomId }, data: { lastMessageAt: null } });
    return { ok: true, deleted: result.count };
  }
}
