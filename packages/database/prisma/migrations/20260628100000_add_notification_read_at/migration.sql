-- In-app notification bell: track per-notification read state (independent of Telegram delivery status).
ALTER TABLE "agent_notifications" ADD COLUMN IF NOT EXISTS "read_at" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "agent_notifications_user_read_idx" ON "agent_notifications" ("user_id", "read_at");
