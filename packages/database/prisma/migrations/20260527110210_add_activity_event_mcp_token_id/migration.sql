-- AlterTable
ALTER TABLE "activity_events" ADD COLUMN     "mcp_token_id" TEXT;

-- CreateIndex
CREATE INDEX "activity_events_mcp_token_id_idx" ON "activity_events"("mcp_token_id");
