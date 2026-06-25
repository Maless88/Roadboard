-- CreateEnum
CREATE TYPE "ScheduleKind" AS ENUM ('cron', 'once', 'interval');

-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('active', 'paused', 'expired', 'done');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('pending', 'running', 'ok', 'error', 'skipped');

-- CreateTable
CREATE TABLE "scheduled_activities" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "project_id" TEXT,
    "title" TEXT NOT NULL,
    "kind" "ScheduleKind" NOT NULL,
    "cron_expr" TEXT,
    "run_at" TIMESTAMP(3),
    "every_ms" INTEGER,
    "tz" TEXT NOT NULL DEFAULT 'Europe/Rome',
    "agent_slug" TEXT NOT NULL,
    "prompt_template" TEXT NOT NULL,
    "delivery_room_id" TEXT,
    "notify" BOOLEAN NOT NULL DEFAULT true,
    "status" "ActivityStatus" NOT NULL DEFAULT 'active',
    "next_run_at" TIMESTAMP(3),
    "last_run_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_activity_runs" (
    "id" TEXT NOT NULL,
    "activity_id" TEXT NOT NULL,
    "fired_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "RunStatus" NOT NULL DEFAULT 'pending',
    "output_message_id" TEXT,
    "output_preview" TEXT,
    "error" TEXT,
    "duration_ms" INTEGER,

    CONSTRAINT "scheduled_activity_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scheduled_activities_status_next_run_at_idx" ON "scheduled_activities"("status", "next_run_at");

-- CreateIndex
CREATE INDEX "scheduled_activities_user_id_idx" ON "scheduled_activities"("user_id");

-- CreateIndex
CREATE INDEX "scheduled_activity_runs_activity_id_fired_at_idx" ON "scheduled_activity_runs"("activity_id", "fired_at");

-- AddForeignKey
ALTER TABLE "scheduled_activity_runs" ADD CONSTRAINT "scheduled_activity_runs_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "scheduled_activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

