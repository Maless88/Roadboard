-- CreateTable
CREATE TABLE "code_repositories" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "repo_url" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'manual',
    "default_branch" TEXT NOT NULL DEFAULT 'main',
    "scan_interval_h" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "code_repositories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "architecture_snapshots" (
    "id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "commit_hash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "scan_type" TEXT NOT NULL DEFAULT 'manual',
    "error_message" TEXT,
    "node_count" INTEGER NOT NULL DEFAULT 0,
    "edge_count" INTEGER NOT NULL DEFAULT 0,
    "triggered_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "architecture_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "architecture_nodes" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    "snapshot_id" TEXT,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT,
    "description" TEXT,
    "domain_group" TEXT,
    "is_manual" BOOLEAN NOT NULL DEFAULT false,
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "owner_user_id" TEXT,
    "owner_team_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "architecture_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "architecture_edges" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "snapshot_id" TEXT,
    "from_node_id" TEXT NOT NULL,
    "to_node_id" TEXT NOT NULL,
    "edge_type" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "is_manual" BOOLEAN NOT NULL DEFAULT false,
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "architecture_edges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "architecture_annotations" (
    "id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "architecture_annotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "architecture_links" (
    "id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "link_type" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "architecture_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "impact_analyses" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "snapshot_id" TEXT NOT NULL,
    "trigger_node_id" TEXT NOT NULL,
    "direct_node_ids" JSONB NOT NULL DEFAULT '[]',
    "indirect_node_ids" JSONB NOT NULL DEFAULT '[]',
    "remote_node_ids" JSONB NOT NULL DEFAULT '[]',
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "impact_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "architecture_snapshots_project_id_status_idx" ON "architecture_snapshots"("project_id", "status");

-- CreateIndex
CREATE INDEX "architecture_snapshots_repository_id_created_at_idx" ON "architecture_snapshots"("repository_id", "created_at");

-- CreateIndex
CREATE INDEX "architecture_nodes_project_id_is_current_idx" ON "architecture_nodes"("project_id", "is_current");

-- CreateIndex
CREATE INDEX "architecture_nodes_project_id_type_idx" ON "architecture_nodes"("project_id", "type");

-- CreateIndex
CREATE INDEX "architecture_nodes_repository_id_path_idx" ON "architecture_nodes"("repository_id", "path");

-- CreateIndex
CREATE INDEX "architecture_edges_project_id_is_current_idx" ON "architecture_edges"("project_id", "is_current");

-- CreateIndex
CREATE INDEX "architecture_edges_from_node_id_idx" ON "architecture_edges"("from_node_id");

-- CreateIndex
CREATE INDEX "architecture_edges_to_node_id_idx" ON "architecture_edges"("to_node_id");

-- CreateIndex
CREATE INDEX "architecture_annotations_node_id_idx" ON "architecture_annotations"("node_id");

-- CreateIndex
CREATE INDEX "architecture_links_node_id_idx" ON "architecture_links"("node_id");

-- CreateIndex
CREATE INDEX "architecture_links_project_id_entity_type_entity_id_idx" ON "architecture_links"("project_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "impact_analyses_project_id_idx" ON "impact_analyses"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "impact_analyses_snapshot_id_trigger_node_id_key" ON "impact_analyses"("snapshot_id", "trigger_node_id");

-- AddForeignKey
ALTER TABLE "code_repositories" ADD CONSTRAINT "code_repositories_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "architecture_snapshots" ADD CONSTRAINT "architecture_snapshots_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "code_repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "architecture_nodes" ADD CONSTRAINT "architecture_nodes_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "architecture_nodes" ADD CONSTRAINT "architecture_nodes_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "code_repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "architecture_nodes" ADD CONSTRAINT "architecture_nodes_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "architecture_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "architecture_edges" ADD CONSTRAINT "architecture_edges_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "architecture_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "architecture_edges" ADD CONSTRAINT "architecture_edges_from_node_id_fkey" FOREIGN KEY ("from_node_id") REFERENCES "architecture_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "architecture_edges" ADD CONSTRAINT "architecture_edges_to_node_id_fkey" FOREIGN KEY ("to_node_id") REFERENCES "architecture_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "architecture_annotations" ADD CONSTRAINT "architecture_annotations_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "architecture_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "architecture_links" ADD CONSTRAINT "architecture_links_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "architecture_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impact_analyses" ADD CONSTRAINT "impact_analyses_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "architecture_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impact_analyses" ADD CONSTRAINT "impact_analyses_trigger_node_id_fkey" FOREIGN KEY ("trigger_node_id") REFERENCES "architecture_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
