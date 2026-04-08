import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { GrantType } from '@roadboard/domain';
import { AuthGuard } from '../../common/auth.guard';
import { GrantCheckGuard } from '../../common/grant-check.guard';
import { RequireGrant } from '../../common/require-grant.decorator';
import { DashboardsService } from './dashboards.service';


@UseGuards(AuthGuard, GrantCheckGuard)
@Controller('projects/:projectId/dashboard')
export class DashboardsController {

  constructor(private readonly dashboardsService: DashboardsService) {}


  @RequireGrant(GrantType.DASHBOARD_READ)
  @Get()
  getSnapshot(@Param('projectId') projectId: string) {

    return this.dashboardsService.getSnapshot(projectId);
  }


  @RequireGrant(GrantType.DASHBOARD_READ)
  @Get('tasks-summary')
  getTasksSummary(@Param('projectId') projectId: string) {

    return this.dashboardsService.getTasksSummary(projectId);
  }


  @RequireGrant(GrantType.DASHBOARD_READ)
  @Get('milestone-progress')
  getMilestoneProgress(@Param('projectId') projectId: string) {

    return this.dashboardsService.getMilestoneProgress(projectId);
  }
}
