import { Body, Controller, Get, Inject, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../common/auth.guard";
import { CurrentUser } from "../../common/user.decorator";
import type { AuthUser } from "../../common/auth-user";
import { AgentCredentialsService } from "./credentials.service";

@UseGuards(AuthGuard)
@Controller("agents/credentials")
export class AgentCredentialsController {

  constructor(@Inject(AgentCredentialsService) private readonly creds: AgentCredentialsService) {}

  @Get("status")
  status(
    @CurrentUser() user: AuthUser,
    @Query("provider") provider = "cloudflare",
  ): Promise<{ configured: boolean; accountId?: string }> {
    return this.creds.status(user.userId, provider);
  }

  @Post()
  async set(
    @CurrentUser() user: AuthUser,
    @Body() body: { provider?: string; accountId?: string; token?: string },
  ): Promise<{ ok: boolean; error?: string }> {
    const provider = (body.provider || "cloudflare").trim();
    const accountId = (body.accountId || "").trim();
    const token = (body.token || "").trim();
    if (!accountId || !token) return { ok: false, error: "accountId e token sono richiesti" };
    await this.creds.set(user.userId, provider, accountId, token);
    return { ok: true };
  }
}
