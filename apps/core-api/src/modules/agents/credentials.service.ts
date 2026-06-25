import { Inject, Injectable } from "@nestjs/common";
import { PrismaClient } from "@roadboard/database";
import { decryptSecret, encryptSecret } from "../../common/crypto.util";

/**
 * Per-user provider credentials (e.g. a Cloudflare API token for image generation).
 * Tokens are stored AES-256-GCM encrypted. Uses raw SQL so it works regardless of
 * Prisma client regeneration; the table is created by its migration at bootstrap.
 */
@Injectable()
export class AgentCredentialsService {

  constructor(@Inject("PRISMA") private readonly prisma: PrismaClient) {}

  async set(userId: string, provider: string, accountId: string, token: string): Promise<void> {
    const encToken = encryptSecret(token);
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "agent_user_credentials" ("id","user_id","provider","account_id","enc_token","created_at","updated_at")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, now(), now())
       ON CONFLICT ("user_id","provider")
       DO UPDATE SET "account_id" = EXCLUDED."account_id", "enc_token" = EXCLUDED."enc_token", "updated_at" = now()`,
      userId, provider, accountId, encToken,
    );
  }

  async status(userId: string, provider: string): Promise<{ configured: boolean; accountId?: string }> {
    const rows = await this.prisma.$queryRawUnsafe<{ account_id: string }[]>(
      `SELECT "account_id" FROM "agent_user_credentials" WHERE "user_id" = $1 AND "provider" = $2 LIMIT 1`,
      userId, provider,
    );
    return rows.length ? { configured: true, accountId: rows[0].account_id } : { configured: false };
  }

  /** Returns decrypted credentials for runtime use (G2 image generation). null if unset. */
  async get(userId: string, provider: string): Promise<{ accountId: string; token: string } | null> {
    const rows = await this.prisma.$queryRawUnsafe<{ account_id: string; enc_token: string }[]>(
      `SELECT "account_id","enc_token" FROM "agent_user_credentials" WHERE "user_id" = $1 AND "provider" = $2 LIMIT 1`,
      userId, provider,
    );
    if (!rows.length) return null;
    return { accountId: rows[0].account_id, token: decryptSecret(rows[0].enc_token) };
  }
}
