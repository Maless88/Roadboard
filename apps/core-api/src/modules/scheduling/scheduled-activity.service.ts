import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaClient } from "@roadboard/database";
import { parseExpression } from "cron-parser";

export type ScheduleKind = "cron" | "once" | "interval";
export type ActivityStatus = "active" | "paused" | "expired" | "done";

export interface CreateScheduledActivityInput {
  title: string;
  kind: ScheduleKind;
  cronExpr?: string | null;
  runAt?: string | Date | null;
  everyMs?: number | null;
  tz?: string;
  agentSlug: string;
  promptTemplate: string;
  projectId?: string | null;
  deliveryRoomId?: string | null;
  notify?: boolean;
  expiresAt?: string | Date | null;
}

export type UpdateScheduledActivityInput = Partial<CreateScheduledActivityInput>;

export interface ScheduleSpec {
  kind: ScheduleKind;
  cronExpr?: string | null;
  runAt?: Date | null;
  everyMs?: number | null;
  tz: string;
  expiresAt?: Date | null;
}

export interface NextRunResult {
  nextRunAt: Date | null;
  status: ActivityStatus;
}

const DEFAULT_TZ = "Europe/Rome";

/**
 * Pure next-run computation honoring kind (cron|once|interval), tz, and expiry.
 * `mode` distinguishes the first occurrence (initial create/resume) from the
 * occurrence that follows a fire (advance) — only `once` differs between them.
 * Returns the next instant plus the resulting lifecycle status. Throws on an
 * invalid cron expression so callers can surface it.
 */
export function computeNextRunAt(spec: ScheduleSpec, from: Date, mode: "initial" | "advance"): NextRunResult {

  let candidate: Date | null = null;

  if (spec.kind === "cron") {

    if (!spec.cronExpr) throw new BadRequestException("cronExpr required for kind=cron");

    const interval = parseExpression(spec.cronExpr, { currentDate: from, tz: spec.tz });
    candidate = interval.next().toDate();
  } else if (spec.kind === "interval") {

    if (!spec.everyMs || spec.everyMs <= 0) throw new BadRequestException("everyMs must be > 0 for kind=interval");

    candidate = new Date(from.getTime() + spec.everyMs);
  } else {
    // kind === "once"

    if (mode === "initial") {

      if (!spec.runAt) throw new BadRequestException("runAt required for kind=once");

      candidate = spec.runAt;
    } else {
      candidate = null; // a one-shot has no follow-up occurrence
    }
  }

  if (candidate === null) {
    return { nextRunAt: null, status: "done" };
  }

  if (spec.expiresAt && candidate.getTime() > spec.expiresAt.getTime()) {
    return { nextRunAt: null, status: "expired" };
  }

  return { nextRunAt: candidate, status: "active" };
}


function toDate(v: string | Date | null | undefined): Date | null {

  if (v === null || v === undefined) return null;

  const d = v instanceof Date ? v : new Date(v);

  if (Number.isNaN(d.getTime())) throw new BadRequestException("invalid date value");

  return d;
}


/**
 * CRUD over ScheduledActivity + its runs. Owns the lifecycle: computes the
 * first nextRunAt on create/resume, recomputes on schedule edits, and exposes
 * a `claimDue`/`advanceAfterRun` pair the dispatcher uses to fire jobs.
 */
@Injectable()
export class ScheduledActivityService {

  constructor(@Inject("PRISMA") private readonly prisma: PrismaClient) {}

  private specFromInput(input: CreateScheduledActivityInput): ScheduleSpec {
    return {
      kind: input.kind,
      cronExpr: input.cronExpr ?? null,
      runAt: toDate(input.runAt),
      everyMs: input.everyMs ?? null,
      tz: input.tz ?? DEFAULT_TZ,
      expiresAt: toDate(input.expiresAt),
    };
  }

  async create(userId: string, input: CreateScheduledActivityInput): Promise<unknown> {

    if (!input.title || !input.agentSlug || !input.promptTemplate) {
      throw new BadRequestException("title, agentSlug and promptTemplate are required");
    }

    const spec = this.specFromInput(input);
    const { nextRunAt, status } = computeNextRunAt(spec, new Date(), "initial");

    return this.prisma.scheduledActivity.create({
      data: {
        userId,
        projectId: input.projectId ?? null,
        title: input.title,
        kind: input.kind,
        cronExpr: spec.cronExpr,
        runAt: spec.runAt,
        everyMs: spec.everyMs,
        tz: spec.tz,
        agentSlug: input.agentSlug,
        promptTemplate: input.promptTemplate,
        deliveryRoomId: input.deliveryRoomId ?? null,
        notify: input.notify ?? true,
        status,
        nextRunAt,
        expiresAt: spec.expiresAt,
        createdBy: `user:${userId}`,
      },
    });
  }

  list(userId: string, projectId?: string): Promise<unknown> {
    return this.prisma.scheduledActivity.findMany({
      where: { userId, ...(projectId ? { projectId } : {}) },
      orderBy: [{ nextRunAt: "asc" }, { createdAt: "desc" }],
    });
  }

  private async assertOwned(userId: string, id: string) {

    const activity = await this.prisma.scheduledActivity.findUnique({ where: { id } });

    if (!activity) throw new NotFoundException("scheduled activity not found");

    if (activity.userId !== userId) throw new ForbiddenException("not the owner");

    return activity;
  }

  async get(userId: string, id: string): Promise<unknown> {
    return this.assertOwned(userId, id);
  }

  async update(userId: string, id: string, input: UpdateScheduledActivityInput): Promise<unknown> {

    const current = await this.assertOwned(userId, id);

    // Merge requested fields over the current row to build the effective spec.
    const merged: CreateScheduledActivityInput = {
      title: input.title ?? current.title,
      kind: (input.kind ?? current.kind) as ScheduleKind,
      cronExpr: input.cronExpr !== undefined ? input.cronExpr : current.cronExpr,
      runAt: input.runAt !== undefined ? input.runAt : current.runAt,
      everyMs: input.everyMs !== undefined ? input.everyMs : current.everyMs,
      tz: input.tz ?? current.tz,
      agentSlug: input.agentSlug ?? current.agentSlug,
      promptTemplate: input.promptTemplate ?? current.promptTemplate,
      projectId: input.projectId !== undefined ? input.projectId : current.projectId,
      deliveryRoomId: input.deliveryRoomId !== undefined ? input.deliveryRoomId : current.deliveryRoomId,
      notify: input.notify ?? current.notify,
      expiresAt: input.expiresAt !== undefined ? input.expiresAt : current.expiresAt,
    };

    const scheduleTouched =
      input.kind !== undefined ||
      input.cronExpr !== undefined ||
      input.runAt !== undefined ||
      input.everyMs !== undefined ||
      input.tz !== undefined ||
      input.expiresAt !== undefined;

    const spec = this.specFromInput(merged);

    // Recompute nextRunAt/status only while active and only if the schedule changed.
    let recompute: NextRunResult | null = null;

    if (scheduleTouched && current.status === "active") {
      recompute = computeNextRunAt(spec, new Date(), "initial");
    }

    return this.prisma.scheduledActivity.update({
      where: { id },
      data: {
        title: merged.title,
        kind: merged.kind,
        cronExpr: spec.cronExpr,
        runAt: spec.runAt,
        everyMs: spec.everyMs,
        tz: spec.tz,
        agentSlug: merged.agentSlug,
        promptTemplate: merged.promptTemplate,
        projectId: merged.projectId ?? null,
        deliveryRoomId: merged.deliveryRoomId ?? null,
        notify: merged.notify,
        expiresAt: spec.expiresAt,
        ...(recompute ? { nextRunAt: recompute.nextRunAt, status: recompute.status } : {}),
      },
    });
  }

  async pause(userId: string, id: string): Promise<unknown> {
    await this.assertOwned(userId, id);
    return this.prisma.scheduledActivity.update({
      where: { id },
      data: { status: "paused", nextRunAt: null },
    });
  }

  async resume(userId: string, id: string): Promise<unknown> {

    const current = await this.assertOwned(userId, id);
    const spec: ScheduleSpec = {
      kind: current.kind as ScheduleKind,
      cronExpr: current.cronExpr,
      runAt: current.runAt,
      everyMs: current.everyMs,
      tz: current.tz,
      expiresAt: current.expiresAt,
    };
    const { nextRunAt, status } = computeNextRunAt(spec, new Date(), "initial");

    return this.prisma.scheduledActivity.update({
      where: { id },
      data: { status, nextRunAt },
    });
  }

  async remove(userId: string, id: string): Promise<{ id: string }> {
    await this.assertOwned(userId, id);
    await this.prisma.scheduledActivity.delete({ where: { id } });
    return { id };
  }

  async listRuns(userId: string, id: string): Promise<unknown> {
    await this.assertOwned(userId, id);
    return this.prisma.scheduledActivityRun.findMany({
      where: { activityId: id },
      orderBy: { firedAt: "desc" },
      take: 200,
    });
  }
}
