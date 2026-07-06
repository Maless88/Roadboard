import { Body, Controller, Get, Inject, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../common/auth.guard";
import { CurrentUser } from "../../common/user.decorator";
import type { AuthUser } from "../../common/auth-user";
import { AgentNotificationsService } from "./notifications.service";
import { PushService } from "./push.service";

@UseGuards(AuthGuard)
@Controller("notifications")
export class AgentNotificationsController {
  constructor(
    @Inject(AgentNotificationsService) private readonly svc: AgentNotificationsService,
    @Inject(PushService) private readonly push: PushService,
  ) {}

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body() body: { title?: string; body?: string; level?: string; from?: string },
  ): Promise<{ ok: boolean; error?: string }> {
    const title = (body?.title || "").trim();
    if (!title) return { ok: false, error: "title richiesto" };
    return this.svc.create(user.userId, (body.from || "").trim(), title, body.body || "", body.level || "info");
  }

  /** In-app bell (scope=bell, default) or full archive (scope=all) + unread count. */
  @Get()
  list(@CurrentUser() user: AuthUser, @Query("limit") limit?: string, @Query("scope") scope?: string) {
    return this.svc.listForUser(user.userId, limit ? Number(limit) : 30, scope === "all" ? "all" : "bell");
  }

  /** Mark notifications read. Empty/absent ids => mark all unread as read. */
  @Post("read")
  markRead(@CurrentUser() user: AuthUser, @Body() body: { ids?: string[] }): Promise<{ ok: boolean }> {
    return this.svc.markRead(user.userId, body?.ids);
  }

  /** Clear notifications from the bell (kept in the archive). Empty ids => clear all. */
  @Post("dismiss")
  dismiss(@CurrentUser() user: AuthUser, @Body() body: { ids?: string[] }): Promise<{ ok: boolean }> {
    return this.svc.dismiss(user.userId, body?.ids);
  }

  /** Register the caller device push token (FCM/APNs). Upsert by token. */
  @Post("devices")
  registerDevice(
    @CurrentUser() user: AuthUser,
    @Body() body: { token?: string; platform?: string },
  ): Promise<{ ok: boolean }> {
    return this.push.registerDevice(user.userId, (body?.token || "").trim(), (body?.platform || "android").trim());
  }

  /** Unregister a device push token (e.g. on logout). */
  @Post("devices/remove")
  removeDevice(@CurrentUser() user: AuthUser, @Body() body: { token?: string }): Promise<{ ok: boolean }> {
    return this.push.removeDevice(user.userId, (body?.token || "").trim());
  }
}
