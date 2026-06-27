import { Inject, Injectable } from "@nestjs/common";
import { PrismaClient } from "@roadboard/database";

/**
 * Agent Skills catalog + per-agent attachments.
 *
 * `skills_catalog` mirrors the SKILL.md files on the host (synced via `sync` /
 * the MCP tool `sync_skills_catalog`). `agent_skills` is the curated
 * agent<->skill relation surfaced in the agent profile card and managed via
 * the RoadBoard MCP tools (single source of truth). Raw SQL so it works
 * regardless of Prisma client regeneration; the tables are created by their
 * migration at bootstrap.
 */
@Injectable()
export class AgentSkillsService {

  constructor(@Inject("PRISMA") private readonly prisma: PrismaClient) {}

  /** Full catalog of known skills. */
  async catalog(): Promise<{ name: string; description: string }[]> {
    const rows = await this.prisma.$queryRawUnsafe<{ name: string; description: string }[]>(
      `SELECT "name","description" FROM "skills_catalog" ORDER BY "name" ASC`,
    );
    return rows.map((r) => ({ name: r.name, description: r.description ?? "" }));
  }

  /** Catalog with an `attached` flag for the given agent slug. */
  async forAgent(slug: string): Promise<{ name: string; description: string; attached: boolean }[]> {
    const rows = await this.prisma.$queryRawUnsafe<{ name: string; description: string; attached: boolean }[]>(
      `SELECT c."name", c."description",
              (s."skill_name" IS NOT NULL) AS attached
         FROM "skills_catalog" c
         LEFT JOIN "agent_skills" s
           ON s."skill_name" = c."name" AND s."agent_slug" = $1
        ORDER BY c."name" ASC`,
      slug,
    );
    return rows.map((r) => ({ name: r.name, description: r.description ?? "", attached: !!r.attached }));
  }

  /** Skills attached to an agent (with descriptions) — used by the profile card. */
  async attachedFor(slug: string): Promise<{ name: string; description: string }[]> {
    const rows = await this.prisma.$queryRawUnsafe<{ name: string; description: string }[]>(
      `SELECT c."name", COALESCE(c."description", '') AS description
         FROM "agent_skills" s
         JOIN "skills_catalog" c ON c."name" = s."skill_name"
        WHERE s."agent_slug" = $1
        ORDER BY c."name" ASC`,
      slug,
    );
    return rows.map((r) => ({ name: r.name, description: r.description ?? "" }));
  }

  async attach(slug: string, skillName: string): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "agent_skills" ("agent_slug","skill_name","created_at")
       VALUES ($1, $2, now())
       ON CONFLICT ("agent_slug","skill_name") DO NOTHING`,
      slug, skillName,
    );
  }

  async detach(slug: string, skillName: string): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM "agent_skills" WHERE "agent_slug" = $1 AND "skill_name" = $2`,
      slug, skillName,
    );
  }

  /** Upsert catalog entries from the host SKILL.md frontmatters. */
  async sync(skills: { name: string; description?: string }[]): Promise<{ upserted: number }> {
    let n = 0;
    for (const s of skills) {
      const name = (s.name || "").trim();
      if (!name) continue;
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO "skills_catalog" ("name","description","updated_at")
         VALUES ($1, $2, now())
         ON CONFLICT ("name")
         DO UPDATE SET "description" = EXCLUDED."description", "updated_at" = now()`,
        name, (s.description || "").trim(),
      );
      n++;
    }
    return { upserted: n };
  }
}
