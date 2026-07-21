# Scheduled Activities + Calendar — Design & Plan

Status: DRAFT (approved direction: B+C, 2026-06-25)
Owner: Alessio. Drafted by Mia4.

## Goal

Let users (and agents, via a tool) schedule recurring or one-shot activities on
RoadBoard — e.g. "ogni mattina alle 09:00 proponimi una miglioria" — that:

1. Actually run on time (server-side, survive restarts).
2. Are visible/editable in a **calendar view**.
3. Deliver their output reliably (in-app room + notification), modelled on the
   OpenClaw cron UX (schedule + payload + delivery).

This replaces today's broken behaviour where an agent *claims* to have scheduled
something (hallucination) because no scheduler exists.

## Current building blocks (already present)

- **Prisma + Postgres**, shared schema in `packages/database/prisma/schema.prisma`
  (models: chatRoom, roomMessage, agentConfig, chatParticipant).
- **BullMQ** (`@nestjs/bullmq`) with queue `agent-run` and a **stub**
  `apps/worker-jobs/src/jobs/processors/agent-run.processor.ts`
  (`TODO Wave 2: capability -> executor -> ActivityEvent -> result`).
- **AgentExecutorService.stream()** (core-api) — runs an agent (api/local/cli).
- **RoomsService.appendMessage()** — persists an agent message into a room.

Implemented (2026-07): recurring scheduler (`apps/core-api/src/modules/scheduling/`
+ `SchedulingDispatcher`, BullMQ `agent-run` queue), activity persistence
(Prisma `ScheduledActivity` / `ScheduledActivityRun`), agent self-scheduling
tool (MCP `create_scheduled_activity`, `list_scheduled_activities`,
`pause_scheduled_activity`, `delete_scheduled_activity` in
`apps/mcp-service/src/main.ts`), the calendar UI
(`apps/web-app/src/app/scheduling/page.tsx` + `scheduling-client.tsx`, route
`/scheduling`, week/month grid), and the run delivery path: `agent-run.processor.ts`
is no longer a stub — it injects `AgentRunRunner` and consumes BullMQ payload
`{ activityId, runId }`; `AgentRunRunner.run()` (`apps/worker-jobs/src/jobs/agent-run.runner.ts`)
resolves the responder agent, streams the `promptTemplate` through the shared
`AgentExecutor`, appends the reply into the delivery room (auto-creating the
agent's direct room when `deliveryRoomId` is null), and records the outcome
(`ok`/`error`, `outputMessageId`, `outputPreview`) on `ScheduledActivityRun`.

Missing: external push delivery (Telegram/OpenClaw bridge polling `notify=true`
runs, per P1b) and the anti-hallucination guardrail (P4). In-app room delivery
(the P1 processor above) is implemented; only the outbound Telegram/OpenClaw
notification hop described in P1b remains unbuilt — no OpenClaw/Telegram
reference found anywhere in the current tree.

## Locked decisions (2026-06-25)

1. **Delivery**: in-app room (always) + Telegram push **via the OpenClaw bridge
   (Mia, Pi4) for now**. Future = dedicated per-agent Telegram bots (see P5).
2. **Agents may self-schedule** via a tool (`create_scheduled_activity`). Required
   for the chat use-case. Guarded by C.
3. **Calendar scope**: global per user, with optional per-project filter.

## Data model (Prisma)

```prisma
enum ScheduleKind { cron once interval }
enum ActivityStatus { active paused expired done }
enum RunStatus { pending running ok error skipped }

model ScheduledActivity {
  id            String   @id @default(cuid())
  userId        String
  projectId     String?
  title         String
  kind          ScheduleKind
  cronExpr      String?          // kind=cron (5-field, tz-aware)
  runAt         DateTime?        // kind=once
  everyMs       Int?             // kind=interval
  tz            String   @default("Europe/Rome")
  agentSlug     String           // responder
  promptTemplate String          // what to ask the agent each run
  deliveryRoomId String?         // room to append into (auto/direct if null)
  notify        Boolean  @default(true) // push via OpenClaw bridge
  status        ActivityStatus @default(active)
  nextRunAt     DateTime?
  lastRunAt     DateTime?
  expiresAt     DateTime?
  createdBy     String           // "user:<id>" | "agent:<slug>"
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  runs          ScheduledActivityRun[]
  @@index([status, nextRunAt])
  @@index([userId])
}

model ScheduledActivityRun {
  id              String   @id @default(cuid())
  activityId      String
  activity        ScheduledActivity @relation(fields: [activityId], references: [id], onDelete: Cascade)
  firedAt         DateTime @default(now())
  status          RunStatus @default(pending)
  outputMessageId String?          // roomMessage produced
  outputPreview   String?          // first ~280 chars, for calendar/notif
  error           String?
  durationMs      Int?
  @@index([activityId, firedAt])
}
```

## Components

### P1 — Backend engine (end-to-end, testable with a 1-min schedule)
- Prisma models + migration (`packages/database`).
- core-api module `scheduling/`: service (CRUD + nextRunAt calc via `cron-parser`),
  controller (REST: list/create/update/pause/delete + runs).
- **Dispatcher**: `@nestjs/schedule` tick every 60s → find due
  (`status=active AND nextRunAt<=now`) → enqueue `agent-run` BullMQ job with
  `{activityId}` → recompute `nextRunAt` (or mark `done`/`expired`) → create a
  `ScheduledActivityRun(pending)`.
- **agent-run.processor** (implement the TODO): load activity+run, resolve agent,
  `executor.stream` the `promptTemplate` against minimal context, `appendMessage`
  into the delivery room, update run (ok/error, outputMessageId, preview), emit
  ActivityEvent.
- **Idempotency**: dispatcher claims a run atomically (update where nextRunAt) to
  avoid double-fire on overlapping ticks.

### P1b — Delivery via OpenClaw bridge (Mia side, Pi4)
- core-api exposes `GET /scheduling/runs?since=...&notify=true` (or reuse runs API).
- OpenClaw cron on Pi4 polls new `ok` runs with `notify=true` and DMs the
  `outputPreview` (+ link) to Maless on Telegram. Decoupled; no roadboard→TG coupling yet.

### P2 — Calendar view (web-app)
- Page/tab `/calendar`: month/week grid of activities + run markers (ok/error).
- Create/edit modal (kind, schedule, agent, prompt, project, notify).
- Pause/resume/delete. Per-project filter. Past runs drawer with output preview.

### P3 — Agent self-scheduling tool
- Tool `create_scheduled_activity(kind, cronExpr|runAt|everyMs, agentSlug, prompt,
  projectId?, title)` exposed to agents (via CLI-bridge toolPolicy / function-calling).
- Wire into chat: when user asks "ogni mattina alle 9…", the responder calls the
  tool and confirms with the **real** created activity (id + nextRunAt).
- AuthZ: agent can only schedule for the requesting user; respects toolPolicy.

### P4 — Guardrail (C)
- Global system-prompt clause for all agents: never claim to have scheduled,
  persisted, remembered, or queued anything unless a tool call returned success;
  if unable, say so plainly. Applied in agent system-prompt assembly.

### P5 — (future) Dedicated per-agent Telegram bots
- Each agent gets its own bot token; delivery goes direct agent→user, bypassing
  Mia. Pattern: like PI3_notifier. Touches OpenClaw channel config + token mgmt.
  Independent of the scheduling engine; layered on top of delivery.

## Open / to confirm during build
- ActivityEvent schema reuse vs new.
- Room used for delivery when `deliveryRoomId` null (auto-create per-agent direct).
- cron-parser dependency add (or rrule for richer recurrence).

## Test plan
- Unit: nextRunAt calc (cron/once/interval, tz, expiry), idempotent claim.
- Integration: create activity (1-min cron) → dispatcher fires → processor
  produces a room message + run(ok) → notify poller picks it up.
- Guardrail: agent asked to schedule with tool disabled → must refuse, not fake.
