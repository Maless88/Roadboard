-- AlterTable
ALTER TABLE "projects"
  ADD COLUMN "home_url" TEXT,
  ADD COLUMN "thumbnail_url" TEXT,
  ADD COLUMN "thumbnail_updated_at" TIMESTAMP(3),
  ADD COLUMN "thumbnail_expires_at" TIMESTAMP(3),
  ADD COLUMN "thumbnail_manual_upload" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "projects_thumbnail_expires_at_idx" ON "projects"("thumbnail_expires_at");
