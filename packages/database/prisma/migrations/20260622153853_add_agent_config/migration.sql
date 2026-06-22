-- CreateTable
CREATE TABLE "agent_configs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "capability" TEXT NOT NULL,
    "runtime" TEXT NOT NULL DEFAULT 'api',
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "system_prompt" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "owner_team_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_configs_slug_key" ON "agent_configs"("slug");

-- CreateIndex
CREATE INDEX "agent_configs_owner_team_id_idx" ON "agent_configs"("owner_team_id");

-- AddForeignKey
ALTER TABLE "agent_configs" ADD CONSTRAINT "agent_configs_owner_team_id_fkey" FOREIGN KEY ("owner_team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
