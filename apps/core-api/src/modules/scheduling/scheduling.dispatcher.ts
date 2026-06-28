import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { PrismaClient } from "@roadboard/database";
import { computeNextRunAt, type ScheduleKind, type ScheduleSpec } from "./scheduled-activity.service";
import { QUEUE_AGENT_RUN, type AgentRunJobData } from "./scheduling.constants";
import { AgentNotificationsService } from "../notifications/notifications.service";

/** Sentinel agentSlug for reminders: deliver `promptTemplate` straight to the user, no agent run. */
const REMINDER_AGENT_SLUG = "__reminder__";

/**
 * Polls for due scheduled activities every 60s. For each due activity it claims
 * the run with an UPDATE guarded on (status=active AND nextRunAt<=now): the same
 * statement advances nextRunAt (or marks done/expired), so an overlapping tick
 * cannot re-claim the same occurrence. On a winning claim it creates a pending
 * ScheduledActivityRun and enqueues an `agent-run` BullMQ job.
 */
@Injectable()
export class SchedulingDispatcher {

  private readonly logger = new Logger(SchedulingDispatcher.name);

  constructor(
    @Inject("PRISMA") private readonly prisma: PrismaClient,
    @InjectQueue(QUEUE_AGENT_RUN) private readonly queue: Queue<AgentRunJobData>,
    private readonly notifications: AgentNotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick(): Promise<void> {

    const now = new Date();
    const due = await this.prisma.scheduledActivity.findMany({
      where: { status: "active", nextRunAt: { lte: now } },
      orderBy: { nextRunAt: "asc" },
      take: 100,
    });

    if (due.length === 0) return;

    for (const activity of due) {

      try {
        await this.fire(activity, now);
      } catch (err) {
        this.logger.error(
          `[scheduling] failed to fire activity ${activity.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  private async fire(
    activity: {
      id: string;
      kind: string;
      cronExpr: string | null;
      runAt: Date | null;
      everyMs: number | null;
      tz: string;
      expiresAt: Date | null;
      userId: string;
      agentSlug: string;
      title: string;
      promptTemplate: string;
    },
    now: Date,
  ): Promise<void> {

    const spec: ScheduleSpec = {
      kind: activity.kind as ScheduleKind,
      cronExpr: activity.cronExpr,
      runAt: activity.runAt,
      everyMs: activity.everyMs,
      tz: activity.tz,
      expiresAt: activity.expiresAt,
    };

    const { nextRunAt, status } = computeNextRunAt(spec, now, "advance");

    // Atomic claim: only one tick can match (status=active AND nextRunAt<=now),
    // because this update moves nextRunAt forward / changes status.
    const claim = await this.prisma.scheduledActivity.updateMany({
      where: { id: activity.id, status: "active", nextRunAt: { lte: now } },
      data: { nextRunAt, status, lastRunAt: now },
    });

    if (claim.count !== 1) return; // lost the race to another tick

    // Reminder: deliver the text straight to the user via the notification hub. No agent run, no cost.
    if (activity.agentSlug === REMINDER_AGENT_SLUG) {
      // agent_slug="reminder" lets the notification dispatcher render it as a ⏰ Promemoria.
      await this.notifications.create(activity.userId, "reminder", activity.promptTemplate, "", "info");
      await this.prisma.scheduledActivityRun.create({
        data: { activityId: activity.id, status: "ok", outputPreview: activity.promptTemplate.slice(0, 280) },
      });
      this.logger.log(`[scheduling] fired reminder ${activity.id} (nextRunAt=${nextRunAt?.toISOString() ?? "none"}, status=${status})`);
      return;
    }

    const run = await this.prisma.scheduledActivityRun.create({
      data: { activityId: activity.id, status: "pending" },
    });

    await this.queue.add(
      "run",
      { activityId: activity.id, runId: run.id },
      { removeOnComplete: true, removeOnFail: 100 },
    );

    this.logger.log(`[scheduling] fired activity ${activity.id} run ${run.id} (nextRunAt=${nextRunAt?.toISOString() ?? "none"}, status=${status})`);
  }
}
