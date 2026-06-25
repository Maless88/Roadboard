import { computeNextRunAt, type ScheduleSpec } from "./scheduled-activity.service";

const FROM = new Date("2026-06-25T08:30:00.000Z");


describe("computeNextRunAt", () => {

  it("once (initial) schedules at runAt", () => {

    const runAt = new Date("2026-07-01T09:00:00.000Z");
    const spec: ScheduleSpec = { kind: "once", runAt, tz: "Europe/Rome" };
    const res = computeNextRunAt(spec, FROM, "initial");

    expect(res.status).toBe("active");
    expect(res.nextRunAt?.toISOString()).toBe(runAt.toISOString());
  });

  it("once (advance) has no follow-up and is marked done", () => {

    const spec: ScheduleSpec = { kind: "once", runAt: new Date(), tz: "Europe/Rome" };
    const res = computeNextRunAt(spec, FROM, "advance");

    expect(res.status).toBe("done");
    expect(res.nextRunAt).toBeNull();
  });

  it("interval adds everyMs to the from instant", () => {

    const spec: ScheduleSpec = { kind: "interval", everyMs: 60_000, tz: "Europe/Rome" };
    const res = computeNextRunAt(spec, FROM, "advance");

    expect(res.status).toBe("active");
    expect(res.nextRunAt?.getTime()).toBe(FROM.getTime() + 60_000);
  });

  it("cron computes the next occurrence honoring tz", () => {

    // 09:00 Europe/Rome (CEST = UTC+2 in June) → 07:00 UTC.
    const spec: ScheduleSpec = { kind: "cron", cronExpr: "0 9 * * *", tz: "Europe/Rome" };
    const res = computeNextRunAt(spec, FROM, "advance");

    expect(res.status).toBe("active");
    expect(res.nextRunAt?.toISOString()).toBe("2026-06-26T07:00:00.000Z");
  });

  it("marks expired when the next occurrence is past expiresAt", () => {

    const spec: ScheduleSpec = {
      kind: "interval",
      everyMs: 60_000,
      tz: "Europe/Rome",
      expiresAt: new Date(FROM.getTime() + 10_000),
    };
    const res = computeNextRunAt(spec, FROM, "advance");

    expect(res.status).toBe("expired");
    expect(res.nextRunAt).toBeNull();
  });
});
