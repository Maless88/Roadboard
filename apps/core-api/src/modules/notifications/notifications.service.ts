import { Inject, Injectable } from "@nestjs/common";
import { PrismaClient } from "@roadboard/database";

export interface PendingNotification { id: string; user_id: string; agent_slug: string; title: string; body: string; level: string; }

/** Agent -> user notification hub. Agents emit (via the `notify` MCP tool); a
 *  dispatcher delivers pending rows to Telegram. Raw SQL (table created by migration). */
@Injectable()
export class AgentNotificationsService {
  constructor(@Inject("PRISMA") private readonly prisma: PrismaClient) {}

  async create(userId: string, agentSlug: string, title: string, body: string, level: string): Promise<{ ok: boolean }> {
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "agent_notifications" ("id","user_id","agent_slug","title","body","level","status","created_at")
       VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,'pending',now())`,
      userId, agentSlug || "", title, body || "", ["info", "warn", "alert"].includes(level) ? level : "info",
    );
    return { ok: true };
  }

  listPending(limit = 50): Promise<PendingNotification[]> {
    return this.prisma.$queryRawUnsafe<PendingNotification[]>(
      `SELECT "id","user_id","agent_slug","title","body","level" FROM "agent_notifications" WHERE "status"='pending' ORDER BY "created_at" ASC LIMIT ${Number(limit) || 50}`,
    );
  }

  async mark(ids: string[], status: "sent" | "failed"): Promise<void> {
    const safe = ids.filter((x) => /^[a-z0-9-]+$/i.test(x));
    if (!safe.length) return;
    const list = safe.map((x) => `'${x}'`).join(",");
    const sentAt = status === "sent" ? ", \"sent_at\"=now()" : "";
    await this.prisma.$executeRawUnsafe(`UPDATE "agent_notifications" SET "status"='${status}'${sentAt} WHERE "id" IN (${list})`);
  }
}
