-- CreateTable
CREATE TABLE "project_user_archives" (
    "project_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "archived_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_user_archives_pkey" PRIMARY KEY ("project_id","user_id")
);

-- CreateIndex
CREATE INDEX "project_user_archives_user_id_idx" ON "project_user_archives"("user_id");

-- AddForeignKey
ALTER TABLE "project_user_archives" ADD CONSTRAINT "project_user_archives_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_user_archives" ADD CONSTRAINT "project_user_archives_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DataMigration: convert existing globally-archived projects into per-user archives.
-- For projects with status='archived' and a known ownerUserId, create a ProjectUserArchive row
-- so the project remains visually archived for the owner. Projects without an owner cannot
-- be migrated to a per-user archive and will simply be reset to status='active'.
INSERT INTO "project_user_archives" ("project_id", "user_id", "archived_at")
SELECT "id", "owner_user_id", CURRENT_TIMESTAMP
FROM "projects"
WHERE "status" = 'archived' AND "owner_user_id" IS NOT NULL
ON CONFLICT ("project_id", "user_id") DO NOTHING;

UPDATE "projects" SET "status" = 'active' WHERE "status" = 'archived';
