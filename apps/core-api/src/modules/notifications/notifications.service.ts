import { Inject, Injectable } from "@nestjs/common";
import { PrismaClient } from "@roadboard/database";

export interface PendingNotification { id: string; user_id: string; agent_slug: string; title: string; body: string; level: string; }
export interface UserNotification { id: string; agent_slug: string; title: string; body: string; level: string; status: string; created_at: Date; read_at: Date | null; }

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

  /** In-app bell: recent non-dismissed notifications + unread count.
   *  scope="all" => the full archive (incl. dismissed), for the /notifications page. */
  async listForUser(userId: string, limit = 30, scope: "bell" | "all" = "bell"): Promise<{ items: UserNotification[]; unread: number }> {
    const lim = Math.max(1, Math.min(200, Number(limit) || 30));
    const notDismissed = scope === "all" ? "" : ` AND "dismissed_at" IS NULL`;
    const items = await this.prisma.$queryRawUnsafe<UserNotification[]>(
      `SELECT "id","agent_slug","title","body","level","status","created_at","read_at"
       FROM "agent_notifications" WHERE "user_id"=$1${notDismissed} ORDER BY "created_at" DESC LIMIT ${lim}`,
      userId,
    );
    const rows = await this.prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT count(*)::int AS count FROM "agent_notifications" WHERE "user_id"=$1 AND "read_at" IS NULL AND "dismissed_at" IS NULL`,
      userId,
    );
    return { items, unread: Number(rows[0]?.count ?? 0) };
  }

  /** "Pulisci": hide notifications from the bell (and mark them read) but keep them in the archive. */
  async dismiss(userId: string, ids?: string[]): Promise<{ ok: boolean }> {
    const safe = (ids || []).filter((x) => /^[a-z0-9-]+$/i.test(x));
    if (ids && ids.length && !safe.length) return { ok: true };
    const idClause = safe.length ? ` AND "id" IN (${safe.map((x) => `'${x}'`).join(",")})` : "";
    await this.prisma.$executeRawUnsafe(
      `UPDATE "agent_notifications" SET "dismissed_at"=now(), "read_at"=COALESCE("read_at", now()) WHERE "user_id"=$1 AND "dismissed_at" IS NULL${idClause}`,
      userId,
    );
    return { ok: true };
  }

  /** Mark the user's notifications read. Empty ids => mark all unread as read. */
  async markRead(userId: string, ids?: string[]): Promise<{ ok: boolean }> {
    const safe = (ids || []).filter((x) => /^[a-z0-9-]+$/i.test(x));
    if (ids && ids.length && !safe.length) return { ok: true };
    const idClause = safe.length ? ` AND "id" IN (${safe.map((x) => `'${x}'`).join(",")})` : "";
    await this.prisma.$executeRawUnsafe(
      `UPDATE "agent_notifications" SET "read_at"=now() WHERE "user_id"=$1 AND "read_at" IS NULL${idClause}`,
      userId,
    );
    return { ok: true };
  }
}
