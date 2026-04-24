import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@roadboard/database';
import { GrantSubjectType, GrantType, TeamMembershipStatus } from '@roadboard/domain';
import { hasPermission, filterGrantsByTeamRole, EffectiveGrant, TeamRole } from '@roadboard/grants';
import { CreateGrantDto } from './create-grant.dto';
import { CheckPermissionDto } from './check-permission.dto';


@Injectable()
export class GrantsService {

  constructor(@Inject('PRISMA') private readonly prisma: PrismaClient) {}


  async create(dto: CreateGrantDto) {

    return this.prisma.projectGrant.create({
      data: {
        projectId: dto.projectId,
        subjectType: dto.subjectType,
        subjectId: dto.subjectId,
        grantType: dto.grantType,
        grantedByUserId: dto.grantedByUserId,
      },
    });
  }


  async findByProject(projectId: string) {

    return this.prisma.projectGrant.findMany({
      where: { projectId },
    });
  }


  async delete(id: string) {

    const grant = await this.prisma.projectGrant.findUnique({
      where: { id },
    });

    if (!grant) {
      throw new NotFoundException(`Grant ${id} not found`);
    }

    return this.prisma.projectGrant.delete({ where: { id } });
  }


  async checkPermission(dto: CheckPermissionDto): Promise<{ allowed: boolean }> {

    const grants: EffectiveGrant[] = [];

    if (dto.subjectType === GrantSubjectType.USER) {
      const directGrants = await this.prisma.projectGrant.findMany({
        where: {
          projectId: dto.projectId,
          subjectType: GrantSubjectType.USER,
          subjectId: dto.subjectId,
        },
      });

      for (const g of directGrants) {
        grants.push({
          projectId: g.projectId,
          grantType: g.grantType as GrantType,
        });
      }

      const memberships = await this.prisma.teamMembership.findMany({
        where: {
          userId: dto.subjectId,
          status: TeamMembershipStatus.ACTIVE,
        },
        select: { teamId: true, role: true },
      });

      if (memberships.length > 0) {
        const roleByTeam = new Map<string, TeamRole>(
          memberships.map((m) => [m.teamId, (m.role === 'admin' ? 'admin' : 'member') as TeamRole]),
        );
        const teamGrants = await this.prisma.projectGrant.findMany({
          where: {
            projectId: dto.projectId,
            subjectType: GrantSubjectType.TEAM,
            subjectId: { in: memberships.map((m) => m.teamId) },
          },
        });

        const byTeam = new Map<string, EffectiveGrant[]>();

        for (const g of teamGrants) {
          const list = byTeam.get(g.subjectId) ?? [];
          list.push({ projectId: g.projectId, grantType: g.grantType as GrantType });
          byTeam.set(g.subjectId, list);
        }

        for (const [teamId, teamGrantList] of byTeam) {
          const role = roleByTeam.get(teamId) ?? 'member';
          grants.push(...filterGrantsByTeamRole(teamGrantList, role));
        }
      }
    } else {
      const teamGrants = await this.prisma.projectGrant.findMany({
        where: {
          projectId: dto.projectId,
          subjectType: GrantSubjectType.TEAM,
          subjectId: dto.subjectId,
        },
      });

      for (const g of teamGrants) {
        grants.push({
          projectId: g.projectId,
          grantType: g.grantType as GrantType,
        });
      }
    }

    const allowed = hasPermission(
      grants,
      dto.projectId,
      dto.grantType as GrantType,
    );

    return { allowed };
  }
}
