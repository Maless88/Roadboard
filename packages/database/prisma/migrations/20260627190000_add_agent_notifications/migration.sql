CREATE TABLE IF NOT EXISTS "agent_notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "agent_slug" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "level" TEXT NOT NULL DEFAULT 'info',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),
    CONSTRAINT "agent_notifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "agent_notifications_status_created_idx" ON "agent_notifications"("status","created_at");
