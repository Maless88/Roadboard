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

// Deterministic triage gate: agents in this set only spend an LLM run when a cheap,
// no-LLM check finds something worth it; otherwise the tick is recorded as skipped.
const GATE_TRIAGE_SLUGS = new Set(
  (process.env.GATE_TRIAGE_SLUGS || "cleo").split(",").map((s) => s.trim()).filter(Boolean),
);
const EMAIL_HELPER_URL = process.env.EMAIL_HELPER_URL || "http://host.docker.internal:8789";
const EMAIL_HELPER_TOKEN = process.env.EMAIL_HELPER_TOKEN || "";
const CALENDAR_HELPER_URL = process.env.CALENDAR_HELPER_URL || "http://host.docker.internal:8790";
const CALENDAR_HELPER_TOKEN = process.env.CALENDAR_HELPER_TOKEN || "";
const TRIAGE_TZ = process.env.TRIAGE_TZ || "Europe/Rome";
const QUIET_START_MIN = Number(process.env.TRIAGE_QUIET_START_MIN ?? 23 * 60);   // 23:00
const QUIET_END_MIN = Number(process.env.TRIAGE_QUIET_END_MIN ?? 7 * 60 + 30);   // 07:30
const CAL_LOOKAHEAD_MS = Number(process.env.TRIAGE_CAL_LOOKAHEAD_MS ?? 30 * 60 * 1000);
const TRIAGE_EMAIL_ACCOUNT = process.env.TRIAGE_EMAIL_ACCOUNT || "aruba";

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
      lastRunAt: Date | null;
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

    // Deterministic gate (e.g. Cleo triage): only spend an LLM run when a cheap check trips.
    // activity.lastRunAt here is the PREVIOUS run time (the claim above set it to now in the DB,
    // but this in-memory value is the pre-claim one) — used as the dedup watermark.
    if (GATE_TRIAGE_SLUGS.has(activity.agentSlug)) {
      const decision = await this.triageGate(activity.lastRunAt, now);
      if (!decision.run) {
        await this.prisma.scheduledActivityRun.create({
          data: { activityId: activity.id, status: "skipped", outputPreview: decision.reason.slice(0, 280) },
        });
        this.logger.log(`[scheduling] gate skipped activity ${activity.id}: ${decision.reason}`);
        return;
      }
      this.logger.log(`[scheduling] gate opened activity ${activity.id}: ${decision.reason}`);
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

  /**
   * Cheap, no-LLM triage check. Returns run:true only if something is worth waking the agent for.
   * Order: quiet-hours -> new unread email since last run -> calendar event entering the look-ahead
   * window since last run. Fail-closed: if a helper errors we treat that source as "nothing" (never
   * spend tokens on an error), logging a warning. `since` (lastRunAt) is the dedup watermark.
   */
  private async triageGate(lastRunAt: Date | null, now: Date): Promise<{ run: boolean; reason: string }> {
    // Quiet hours in the local tz: never wake the agent.
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: TRIAGE_TZ, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now);
    const hh = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const mm = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    const minOfDay = hh * 60 + mm;
    const inQuiet = QUIET_START_MIN > QUIET_END_MIN
      ? (minOfDay >= QUIET_START_MIN || minOfDay < QUIET_END_MIN)   // window crosses midnight
      : (minOfDay >= QUIET_START_MIN && minOfDay < QUIET_END_MIN);
    if (inQuiet) return { run: false, reason: "quiet-hours" };

    const since = lastRunAt ?? now; // first run: no backlog spam

    // New unread email since last run.
    try {
      const items = await this.fetchJson(`${EMAIL_HELPER_URL}/inbox?account=${encodeURIComponent(TRIAGE_EMAIL_ACCOUNT)}&limit=20`, EMAIL_HELPER_TOKEN);
      if (Array.isArray(items)) {
        const fresh = items.filter((m: { unread?: boolean; date?: string }) => m?.unread && m?.date && new Date(m.date) > since);
        if (fresh.length > 0) return { run: true, reason: `email:${fresh.length} new` };
      }
    } catch (e) {
      this.logger.warn(`[scheduling] gate email check failed (fail-closed): ${e instanceof Error ? e.message : String(e)}`);
    }

    // Calendar event ENTERING the look-ahead window since last run (dedup: fires once per event).
    try {
      const events = await this.fetchJson(`${CALENDAR_HELPER_URL}/events?days=1`, CALENDAR_HELPER_TOKEN);
      if (Array.isArray(events)) {
        const horizon = now.getTime() + CAL_LOOKAHEAD_MS;
        const prevHorizon = since.getTime() + CAL_LOOKAHEAD_MS;
        const soon = events.filter((ev: { start?: string }) => {
          if (!ev?.start) return false;
          const t = new Date(ev.start).getTime();
          return t <= horizon && t > prevHorizon && t > now.getTime();
        });
        if (soon.length > 0) return { run: true, reason: `calendar:${soon.length} imminent` };
      }
    } catch (e) {
      this.logger.warn(`[scheduling] gate calendar check failed (fail-closed): ${e instanceof Error ? e.message : String(e)}`);
    }

    return { run: false, reason: "nothing new" };
  }

  private async fetchJson(url: string, token: string): Promise<unknown> {
    const r = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
    return r.json();
  }
}
