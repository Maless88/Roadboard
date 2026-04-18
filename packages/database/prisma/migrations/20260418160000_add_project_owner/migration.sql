-- Add owner_user_id to projects
ALTER TABLE "projects" ADD COLUMN "owner_user_id" TEXT;

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_owner_user_id_fkey"
  FOREIGN KEY ("owner_user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
