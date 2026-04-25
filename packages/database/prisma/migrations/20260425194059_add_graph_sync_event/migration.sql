-- CreateTable
CREATE TABLE "graph_sync_events" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "op" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "next_attempt_at" TIMESTAMP(3),

    CONSTRAINT "graph_sync_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "graph_sync_events_status_next_attempt_at_idx" ON "graph_sync_events"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "graph_sync_events_project_id_status_idx" ON "graph_sync_events"("project_id", "status");

-- CreateIndex
CREATE INDEX "graph_sync_events_entity_type_entity_id_idx" ON "graph_sync_events"("entity_type", "entity_id");
