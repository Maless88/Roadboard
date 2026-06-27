-- Agent skills catalog + per-agent attachment relation.
CREATE TABLE IF NOT EXISTS "skills_catalog" (
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "skills_catalog_pkey" PRIMARY KEY ("name")
);

CREATE TABLE IF NOT EXISTS "agent_skills" (
    "agent_slug" TEXT NOT NULL,
    "skill_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_skills_pkey" PRIMARY KEY ("agent_slug", "skill_name")
);

CREATE INDEX IF NOT EXISTS "agent_skills_skill_name_idx" ON "agent_skills"("skill_name");
