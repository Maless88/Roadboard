-- "Pulisci": hide a notification from the bell while keeping it in the /notifications archive.
ALTER TABLE "agent_notifications" ADD COLUMN IF NOT EXISTS "dismissed_at" TIMESTAMP(3);
