import { Body, Controller, Inject, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../common/auth.guard";
import { CurrentUser } from "../../common/user.decorator";
import type { AuthUser } from "../../common/auth-user";
import { AgentNotificationsService } from "./notifications.service";

@UseGuards(AuthGuard)
@Controller("notifications")
export class AgentNotificationsController {
  constructor(@Inject(AgentNotificationsService) private readonly svc: AgentNotificationsService) {}

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body() body: { title?: string; body?: string; level?: string; from?: string },
  ): Promise<{ ok: boolean; error?: string }> {
    const title = (body?.title || "").trim();
    if (!title) return { ok: false, error: "title richiesto" };
    return this.svc.create(user.userId, (body.from || "").trim(), title, body.body || "", body.level || "info");
  }
}
