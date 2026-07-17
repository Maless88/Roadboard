/**
 * One-shot, idempotent backfill: mirror each existing 1:1 ChatThread into a
 * `direct` ChatRoom (owner user + single agent participant) and copy its
 * messages into RoomMessage with explicit senders.
 *
 * NOT run automatically. Execute at the Chatboard cutover (Fase 3):
 *   pnpm --filter @roadboard/database exec tsx src/backfill-chat-rooms.ts
 *
 * Idempotent: skips threads whose agent already has a direct room for that user.
 */
import { ChatMessage, ChatParticipant, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const threads = await prisma.chatThread.findMany({
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  // Existing direct rooms per (owner, agent) so re-runs are no-ops.
  const directRooms = await prisma.chatRoom.findMany({
    where: { kind: "direct" },
    include: { participants: true },
  });
  const seen = new Set<string>();
  for (const r of directRooms) {
    const agent = r.participants.find((p: ChatParticipant) => p.kind === "agent");
    if (agent) seen.add(`${r.ownerUserId}::${agent.refId}`);
  }

  let created = 0;
  let skipped = 0;
  for (const t of threads) {
    const key = `${t.ownerUserId}::${t.agentSlug}`;
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    await prisma.chatRoom.create({
      data: {
        kind: "direct",
        title: t.title ?? null,
        ownerUserId: t.ownerUserId,
        createdAt: t.createdAt,
        lastMessageAt: t.lastMessageAt ?? null,
        participants: {
          create: [
            { kind: "user", refId: t.ownerUserId },
            { kind: "agent", refId: t.agentSlug },
          ],
        },
        messages: {
          create: t.messages.map((m: ChatMessage) => ({
            senderKind: m.role === "user" ? "user" : "agent",
            senderId: m.role === "user" ? t.ownerUserId : t.agentSlug,
            content: m.content,
            createdAt: m.createdAt,
          })),
        },
      },
    });
    seen.add(key);
    created++;
  }

  console.log(`backfill-chat-rooms: created=${created} skipped=${skipped} threads=${threads.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
