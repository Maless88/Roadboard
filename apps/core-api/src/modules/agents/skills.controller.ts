import { Body, Controller, Get, Inject, Param, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../common/auth.guard";
import { LifeOsGuard } from "../../common/lifeos.guard";
import { AgentSkillsService } from "./skills.service";

/**
 * Agent skills endpoints. Reached both by the web-app (session token) and by
 * the RoadBoard MCP service (per-user token) — both flow through AuthGuard.
 */
@UseGuards(AuthGuard, LifeOsGuard)
@Controller("agents/skills")
export class AgentSkillsController {

  constructor(@Inject(AgentSkillsService) private readonly skills: AgentSkillsService) {}

  @Get("catalog")
  catalog(): Promise<{ name: string; description: string }[]> {
    return this.skills.catalog();
  }

  @Get("agent/:slug")
  forAgent(@Param("slug") slug: string): Promise<{ name: string; description: string; attached: boolean }[]> {
    return this.skills.forAgent(slug);
  }

  @Post("agent/:slug/attach")
  async attach(@Param("slug") slug: string, @Body() body: { name?: string }): Promise<{ ok: boolean; error?: string }> {
    const name = (body?.name || "").trim();
    if (!name) return { ok: false, error: "name richiesto" };
    await this.skills.attach(slug, name);
    return { ok: true };
  }

  @Post("agent/:slug/detach")
  async detach(@Param("slug") slug: string, @Body() body: { name?: string }): Promise<{ ok: boolean; error?: string }> {
    const name = (body?.name || "").trim();
    if (!name) return { ok: false, error: "name richiesto" };
    await this.skills.detach(slug, name);
    return { ok: true };
  }

  @Post("sync")
  sync(@Body() body: { skills?: { name: string; description?: string }[] }): Promise<{ upserted: number }> {
    return this.skills.sync(Array.isArray(body?.skills) ? body.skills : []);
  }
}
