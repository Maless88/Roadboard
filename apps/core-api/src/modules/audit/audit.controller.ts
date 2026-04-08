import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { GrantType } from '@roadboard/domain';
import { AuthGuard } from '../../common/auth.guard';
import { GrantCheckGuard } from '../../common/grant-check.guard';
import { RequireGrant } from '../../common/require-grant.decorator';
import { AuditService } from './audit.service';


@UseGuards(AuthGuard, GrantCheckGuard)
@Controller()
export class AuditController {

  constructor(private readonly auditService: AuditService) {}


  @RequireGrant(GrantType.PROJECT_READ)
  @Get('projects/:projectId/audit')
  findByProject(
    @Param('projectId') projectId: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ): Promise<{ events: unknown[]; total: number; take: number; skip: number }> {

    return this.auditService.findByProject(
      projectId,
      take ? parseInt(take, 10) : 50,
      skip ? parseInt(skip, 10) : 0,
    ) as Promise<{ events: unknown[]; total: number; take: number; skip: number }>;
  }


  @RequireGrant(GrantType.PROJECT_READ)
  @Get('audit/recent')
  findRecent(@Query('take') take?: string): Promise<unknown[]> {

    return this.auditService.findRecent(take ? parseInt(take, 10) : 20) as Promise<unknown[]>;
  }
}
