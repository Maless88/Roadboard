/*
  Warnings:

  - You are about to drop the column `milestone_id` on the `tasks` table. All the data in the column will be lost.
  - You are about to drop the `milestones` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "milestones" DROP CONSTRAINT "milestones_phase_id_fkey";

-- DropForeignKey
ALTER TABLE "milestones" DROP CONSTRAINT "milestones_project_id_fkey";

-- DropForeignKey
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_milestone_id_fkey";

-- AlterTable
ALTER TABLE "tasks" DROP COLUMN "milestone_id";

-- DropTable
DROP TABLE "milestones";
