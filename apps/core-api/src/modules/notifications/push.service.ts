import { Inject, Injectable, Logger } from "@nestjs/common";
import { PrismaClient } from "@roadboard/database";
import { optionalEnv } from "@roadboard/config";
import { readFileSync } from "node:fs";
import { createSign } from "node:crypto";

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
  token_uri?: string;
}

/** Native push (FCM HTTP v1, covers Android + iOS-via-APNs). Zero external deps:
 *  service-account JWT signed with node:crypto. Dormant (no-op) until
 *  FCM_SERVICE_ACCOUNT_FILE points to a valid service-account JSON, so the
 *  service builds and runs before Firebase credentials exist. Device tokens live
 *  in the raw "device_tokens" table (see migration), same pattern as agent_notifications. */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private sa: ServiceAccount | null = null;
  private saLoaded = false;
  private accessToken: string | null = null;
  private accessTokenExp = 0;

  constructor(@Inject("PRISMA") private readonly prisma: PrismaClient) {}

  private loadServiceAccount(): ServiceAccount | null {
    if (this.saLoaded) return this.sa;
    this.saLoaded = true;
    const file = optionalEnv("FCM_SERVICE_ACCOUNT_FILE", "");
    if (!file) {
      this.logger.log("push disabled (FCM_SERVICE_ACCOUNT_FILE not set)");
      return null;
    }
    try {
      const parsed = JSON.parse(readFileSync(file, "utf8")) as ServiceAccount;
      if (!parsed.client_email || !parsed.private_key || !parsed.project_id) {
        throw new Error("service account missing client_email/private_key/project_id");
      }
      this.sa = parsed;
      this.logger.log(`push enabled (FCM project ${parsed.project_id})`);
    } catch (e) {
      this.logger.warn(`push disabled (cannot read service account: ${(e as Error).message})`);
      this.sa = null;
    }
    return this.sa;
  }

  get enabled(): boolean {
    return !!this.loadServiceAccount();
  }

  // ── device tokens (raw SQL) ────────────────────────────────────────────────
  async registerDevice(userId: string, token: string, platform: string): Promise<{ ok: boolean }> {
    const t = (token || "").trim();
    if (!t) return { ok: false };
    const plat = ["android", "ios", "web"].includes(platform) ? platform : "android";
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "device_tokens" ("id","user_id","token","platform","created_at","last_seen_at")
       VALUES (gen_random_uuid()::text,$1,$2,$3,now(),now())
       ON CONFLICT ("token") DO UPDATE SET "user_id"=EXCLUDED."user_id","platform"=EXCLUDED."platform","last_seen_at"=now()`,
      userId, t, plat,
    );
    return { ok: true };
  }

  async removeDevice(userId: string, token: string): Promise<{ ok: boolean }> {
    const t = (token || "").trim();
    if (!t) return { ok: true };
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM "device_tokens" WHERE "user_id"=$1 AND "token"=$2`,
      userId, t,
    );
    return { ok: true };
  }

  private listTokens(userId: string): Promise<{ token: string; platform: string }[]> {
    return this.prisma.$queryRawUnsafe<{ token: string; platform: string }[]>(
      `SELECT "token","platform" FROM "device_tokens" WHERE "user_id"=$1`,
      userId,
    );
  }

  private async pruneToken(token: string): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(`DELETE FROM "device_tokens" WHERE "token"=$1`, token);
    } catch {
      /* best-effort */
    }
  }

  // ── FCM HTTP v1 auth (service-account JWT -> OAuth access token) ────────────
  private b64url(input: Buffer | string): string {
    return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  private async getAccessToken(sa: ServiceAccount): Promise<string | null> {
    const now = Math.floor(Date.now() / 1000);
    if (this.accessToken && now < this.accessTokenExp - 60) return this.accessToken;
    const aud = sa.token_uri || "https://oauth2.googleapis.com/token";
    const header = this.b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claim = this.b64url(JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud,
      iat: now,
      exp: now + 3600,
    }));
    const signer = createSign("RSA-SHA256");
    signer.update(`${header}.${claim}`);
    const signature = this.b64url(signer.sign(sa.private_key));
    const jwt = `${header}.${claim}.${signature}`;
    try {
      const r = await fetch(aud, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
      });
      const j = (await r.json()) as { access_token?: string; expires_in?: number };
      if (!r.ok || !j.access_token) {
        this.logger.warn(`fcm oauth error ${r.status}`);
        return null;
      }
      this.accessToken = j.access_token;
      this.accessTokenExp = now + (Number(j.expires_in) || 3600);
      return this.accessToken;
    } catch (e) {
      this.logger.warn(`fcm oauth fetch failed: ${(e as Error).message}`);
      return null;
    }
  }

  // ── send ────────────────────────────────────────────────────────────────────
  async sendToUser(userId: string, title: string, body: string, data?: Record<string, string>): Promise<void> {
    const sa = this.loadServiceAccount();
    if (!sa) return;
    const tokens = await this.listTokens(userId);
    if (!tokens.length) return;
    const access = await this.getAccessToken(sa);
    if (!access) return;
    const url = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
    for (const { token } of tokens) {
      const message: Record<string, unknown> = { token, notification: { title, body: body || "" } };
      if (data) message.data = data;
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
        });
        if (!r.ok) {
          const txt = await r.text();
          if (r.status === 404 || /UNREGISTERED|NOT_FOUND|INVALID_ARGUMENT/i.test(txt)) {
            await this.pruneToken(token);
          }
          this.logger.warn(`fcm send ${r.status} for user ${userId}`);
        }
      } catch (e) {
        this.logger.warn(`fcm send failed: ${(e as Error).message}`);
      }
    }
  }
}
