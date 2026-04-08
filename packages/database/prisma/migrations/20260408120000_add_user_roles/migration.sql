-- AlterTable: add role and manager_id to users
ALTER TABLE "users" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'developer';
ALTER TABLE "users" ADD COLUMN "manager_id" TEXT;

-- Set alessio as admin
UPDATE "users" SET "role" = 'admin' WHERE "username" = 'alessio';

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
