-- AlterTable
ALTER TABLE "architecture_nodes" ADD COLUMN     "domain_group_id" TEXT;

-- CreateTable
CREATE TABLE "domain_groups" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "domain_groups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "domain_groups_project_id_idx" ON "domain_groups"("project_id");

-- CreateIndex
CREATE INDEX "architecture_nodes_domain_group_id_idx" ON "architecture_nodes"("domain_group_id");

-- AddForeignKey
ALTER TABLE "domain_groups" ADD CONSTRAINT "domain_groups_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "architecture_nodes" ADD CONSTRAINT "architecture_nodes_domain_group_id_fkey" FOREIGN KEY ("domain_group_id") REFERENCES "domain_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
