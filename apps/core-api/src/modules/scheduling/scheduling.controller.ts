import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../../common/auth.guard";
import { LifeOsGuard } from "../../common/lifeos.guard";
import { CurrentUser } from "../../common/user.decorator";
import type { AuthUser } from "../../common/auth-user";
import { ScheduledActivityService } from "./scheduled-activity.service";
import type {
  CreateScheduledActivityInput,
  UpdateScheduledActivityInput,
} from "./scheduled-activity.service";

@UseGuards(AuthGuard, LifeOsGuard)
@Controller("scheduling")
export class SchedulingController {

  constructor(
    @Inject(ScheduledActivityService) private readonly activities: ScheduledActivityService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query("projectId") projectId?: string): Promise<unknown> {
    return this.activities.list(user.userId, projectId);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: CreateScheduledActivityInput): Promise<unknown> {
    return this.activities.create(user.userId, body);
  }

  @Get(":id")
  get(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<unknown> {
    return this.activities.get(user.userId, id);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() body: UpdateScheduledActivityInput,
  ): Promise<unknown> {
    return this.activities.update(user.userId, id, body);
  }

  @Post(":id/pause")
  pause(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<unknown> {
    return this.activities.pause(user.userId, id);
  }

  @Post(":id/resume")
  resume(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<unknown> {
    return this.activities.resume(user.userId, id);
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<{ id: string }> {
    return this.activities.remove(user.userId, id);
  }

  @Get(":id/runs")
  listRuns(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<unknown> {
    return this.activities.listRuns(user.userId, id);
  }
}
