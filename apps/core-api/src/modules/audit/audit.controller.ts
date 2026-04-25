import { BadRequestException, Body, Controller, ForbiddenException, Get, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import { GrantSubjectType, GrantType, TeamMembershipStatus } from '@roadboard/domain';
import { PrismaClient } from '@roadboard/database';
import { AuthGuard } from '../../common/auth.guard';
import { GrantCheckGuard } from '../../common/grant-check.guard';
import { FindProjectAuditQueryDto, FindRecentAuditQueryDto } from '../../common/query.dto';
import { RequireGrant } from '../../common/require-grant.decorator';
import { CurrentUser } from '../../common/user.decorator';
import type { AuthUser } from '../../common/auth-user';
import { AuditService } from './audit.service';


type ContributorEventType = 'contributor.added' | 'contributor.removed' | 'contributor.left';


interface ContributorEventDto {
  eventType: ContributorEventType;
  targetUserId: string;
  targetUsername?: string;
  targetDisplayName?: string;
}


const CONTRIBUTOR_EVENT_TYPES: ReadonlySet<ContributorEventType> = new Set([
  'contributor.added',
  'contributor.removed',
  'contributor.left',
]);


@UseGuards(AuthGuard, GrantCheckGuard)
@Controller()
export class AuditController {

  constructor(
    @Inject(AuditService) private readonly auditService: AuditService,
    @Inject('PRISMA') private readonly prisma: PrismaClient,
  ) {}


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


  @Post('projects/:projectId/contributor-events')
  async recordContributorEvent(
    @Param('projectId') projectId: string,
    @Body() body: ContributorEventDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ ok: true }> {

    if (!body || !CONTRIBUTOR_EVENT_TYPES.has(body.eventType)) {
      throw new BadRequestException('invalid eventType');
    }

    if (!body.targetUserId) {
      throw new BadRequestException('targetUserId is required');
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, ownerUserId: true },
    });

    if (!project) {
      throw new BadRequestException('project not found');
    }

    const isSelfTarget = body.targetUserId === user.userId;

    if (body.eventType === 'contributor.left') {

      if (!isSelfTarget) {
        throw new ForbiddenException('contributor.left requires targetUserId to match the actor');
      }
    } else {
      const isOwner = await this.isProjectOwner(user.userId, projectId, project.ownerUserId);

      if (!isOwner) {
        throw new ForbiddenException('only project owners can manage contributors');
      }
    }

    const metadata: Record<string, unknown> = {};

    if (body.targetUsername) metadata.username = body.targetUsername;
    if (body.targetDisplayName) metadata.displayName = body.targetDisplayName;

    await this.auditService.recordForUser(
      user,
      body.eventType,
      'user',
      body.targetUserId,
      projectId,
      metadata,
    );

    return { ok: true };
  }


  private async isProjectOwner(userId: string, projectId: string, ownerUserId: string | null): Promise<boolean> {

    if (ownerUserId === userId) return true;

    const userGrant = await this.prisma.projectGrant.findFirst({
      where: {
        projectId,
        subjectType: GrantSubjectType.USER,
        subjectId: userId,
        grantType: GrantType.PROJECT_ADMIN,
      },
      select: { id: true },
    });

    if (userGrant) return true;

    const memberships = await this.prisma.teamMembership.findMany({
      where: { userId, status: TeamMembershipStatus.ACTIVE, role: 'admin' },
      select: { teamId: true },
    });

    if (memberships.length === 0) return false;

    const teamGrant = await this.prisma.projectGrant.findFirst({
      where: {
        projectId,
        subjectType: GrantSubjectType.TEAM,
        subjectId: { in: memberships.map((m) => m.teamId) },
        grantType: GrantType.PROJECT_ADMIN,
      },
      select: { id: true },
    });

    return teamGrant !== null;
  }
}
