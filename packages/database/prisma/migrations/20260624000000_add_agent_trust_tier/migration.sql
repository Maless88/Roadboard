ALTER TABLE "agent_configs" ADD COLUMN "trust_tier" TEXT NOT NULL DEFAULT 'restricted';
ALTER TABLE "agent_configs" ADD COLUMN "owner_user_id" TEXT;
