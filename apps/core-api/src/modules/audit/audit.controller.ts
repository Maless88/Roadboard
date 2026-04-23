import { Controller, Get, Inject, Param, Query, UseGuards } from '@nestjs/common';
import { GrantType } from '@roadboard/domain';
import { AuthGuard } from '../../common/auth.guard';
import { GrantCheckGuard } from '../../common/grant-check.guard';
import { FindProjectAuditQueryDto, FindRecentAuditQueryDto } from '../../common/query.dto';
import { RequireGrant } from '../../common/require-grant.decorator';
import { AuditService } from './audit.service';


@UseGuards(AuthGuard, GrantCheckGuard)
@Controller()
export class AuditController {

  constructor(@Inject(AuditService) private readonly auditService: AuditService) {}


  @RequireGrant(GrantType.PROJECT_READ)
  @Get('projects/:projectId/audit')
  findByProject(
    @Param('projectId') projectId: string,
    @Query() query: FindProjectAuditQueryDto,
  ): Promise<{ events: unknown[]; total: number; take: number; skip: number }> {

    return this.auditService.findByProject(
      projectId,
      query.take ?? 50,
      query.skip ?? 0,
      {
        eventType: query.eventType,
        actorUserId: query.actorUserId,
        targetType: query.targetType,
      },
    ) as Promise<{ events: unknown[]; total: number; take: number; skip: number }>;
  }


  @RequireGrant(GrantType.PROJECT_READ)
  @Get('projects/:projectId/activity')
  findActivity(
    @Param('projectId') projectId: string,
    @Query() query: FindProjectAuditQueryDto,
  ): Promise<{ events: unknown[]; total: number; take: number; skip: number }> {

    return this.auditService.findByProject(
      projectId,
      query.take ?? 50,
      query.skip ?? 0,
      {
        eventType: query.eventType,
        actorUserId: query.actorUserId,
        targetType: query.targetType,
      },
    ) as Promise<{ events: unknown[]; total: number; take: number; skip: number }>;
  }


  @RequireGrant(GrantType.PROJECT_READ)
  @Get('audit/recent')
  findRecent(@Query() query: FindRecentAuditQueryDto): Promise<unknown[]> {

    return this.auditService.findRecent(query.take ?? 20) as Promise<unknown[]>;
  }
}
