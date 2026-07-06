import { Test } from "@nestjs/testing";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { RoomsService } from "./rooms.service";

function makePrismaMock() {
  return {
    chatRoom: {
      create: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    roomMessage: {
      create: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
    },
    chatParticipant: {
      upsert: vi.fn(),
    },
    agentConfig: {
      findMany: vi.fn(),
    },
  };
}

const USER = "user-1";

describe("RoomsService", () => {

  let svc: RoomsService;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    const module = await Test.createTestingModule({
      providers: [RoomsService, { provide: "PRISMA", useValue: prisma }],
    }).compile();
    svc = module.get(RoomsService);
  });

  it("creates a direct room for one agent and a group for many, deduping slugs", async () => {
    prisma.chatRoom.create.mockResolvedValue({ id: "r1" });

    await svc.createRoom(USER, { agentSlugs: ["researcher"] });
    expect(prisma.chatRoom.create.mock.calls[0][0].data.kind).toBe("direct");

    await svc.createRoom(USER, { agentSlugs: ["researcher", "dev", "researcher"] });
    const data = prisma.chatRoom.create.mock.calls[1][0].data;
    expect(data.kind).toBe("group");
    // owner user + 2 unique agents
    expect(data.participants.create).toHaveLength(3);
    expect(data.participants.create.filter((p: { kind: string }) => p.kind === "agent")).toHaveLength(2);
  });

  it("honors an explicit kind override", async () => {
    prisma.chatRoom.create.mockResolvedValue({ id: "r1" });
    await svc.createRoom(USER, { kind: "group", agentSlugs: ["researcher"] });
    expect(prisma.chatRoom.create.mock.calls[0][0].data.kind).toBe("group");
  });

  it("listRooms projects agents and last message", async () => {
    prisma.agentConfig.findMany.mockResolvedValue([{ slug: "researcher" }, { slug: "dev" }]);
    prisma.chatRoom.findMany.mockResolvedValue([
      {
        id: "r1", kind: "group", title: "T", projectId: null, lastMessageAt: null,
        participants: [
          { kind: "user", refId: USER },
          { kind: "agent", refId: "researcher" },
          { kind: "agent", refId: "dev" },
        ],
        messages: [{ content: "ciao" }],
      },
    ]);
    const rooms = (await svc.listRooms(USER)) as Array<{ agents: string[]; lastMessage: string }>;
    expect(rooms[0].agents).toEqual(["researcher", "dev"]);
    expect(rooms[0].lastMessage).toBe("ciao");
  });

  it("enforces membership on getRoom", async () => {
    prisma.chatRoom.findUnique.mockResolvedValue(null);
    await expect(svc.getRoom(USER, "missing")).rejects.toBeInstanceOf(NotFoundException);

    prisma.chatRoom.findUnique.mockResolvedValue({ id: "r1", ownerUserId: "someone-else", participants: [] });
    await expect(svc.getRoom(USER, "r1")).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("postMessage appends and bumps lastMessageAt", async () => {
    prisma.chatRoom.findUnique.mockResolvedValue({ id: "r1", ownerUserId: USER, participants: [] });
    prisma.roomMessage.create.mockResolvedValue({ id: "m1" });
    await svc.postMessage(USER, "r1", "hello");
    expect(prisma.roomMessage.create).toHaveBeenCalledWith({
      data: { roomId: "r1", senderKind: "user", senderId: USER, content: "hello" },
    });
    expect(prisma.chatRoom.update).toHaveBeenCalled();
  });

  it("appendMessage supports agent senders without auth", async () => {
    prisma.roomMessage.create.mockResolvedValue({ id: "m2" });
    await svc.appendMessage("r1", "agent", "researcher", "found it");
    expect(prisma.roomMessage.create).toHaveBeenCalledWith({
      data: { roomId: "r1", senderKind: "agent", senderId: "researcher", content: "found it" },
    });
    expect(prisma.chatRoom.findUnique).not.toHaveBeenCalled();
  });

  it("deleteRoom removes the room after checking membership", async () => {
    prisma.chatRoom.findUnique.mockResolvedValue({ id: "r1", ownerUserId: USER, participants: [] });
    prisma.chatRoom.delete.mockResolvedValue({ id: "r1" });

    const result = await svc.deleteRoom(USER, "r1");

    expect(prisma.chatRoom.delete).toHaveBeenCalledWith({ where: { id: "r1" } });
    expect(result).toEqual({ ok: true, id: "r1" });
  });

  it("deleteRoom rejects a non-owner", async () => {
    prisma.chatRoom.findUnique.mockResolvedValue({ id: "r1", ownerUserId: "someone-else", participants: [] });

    await expect(svc.deleteRoom(USER, "r1")).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.chatRoom.delete).not.toHaveBeenCalled();
  });

  it("deleteRoom rejects a missing room", async () => {
    prisma.chatRoom.findUnique.mockResolvedValue(null);

    await expect(svc.deleteRoom(USER, "missing")).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.chatRoom.delete).not.toHaveBeenCalled();
  });

  it("clearMessages deletes messages and resets lastMessageAt", async () => {
    prisma.chatRoom.findUnique.mockResolvedValue({ id: "r1", ownerUserId: USER, participants: [] });
    prisma.roomMessage.deleteMany.mockResolvedValue({ count: 3 });

    const result = await svc.clearMessages(USER, "r1");

    expect(prisma.roomMessage.deleteMany).toHaveBeenCalledWith({ where: { roomId: "r1" } });
    expect(prisma.chatRoom.update).toHaveBeenCalledWith({ where: { id: "r1" }, data: { lastMessageAt: null } });
    expect(result).toEqual({ ok: true, deleted: 3 });
  });

  it("clearMessages rejects a non-owner", async () => {
    prisma.chatRoom.findUnique.mockResolvedValue({ id: "r1", ownerUserId: "someone-else", participants: [] });

    await expect(svc.clearMessages(USER, "r1")).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.roomMessage.deleteMany).not.toHaveBeenCalled();
  });

  it("clearMessages rejects a missing room", async () => {
    prisma.chatRoom.findUnique.mockResolvedValue(null);

    await expect(svc.clearMessages(USER, "missing")).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.roomMessage.deleteMany).not.toHaveBeenCalled();
  });
});
