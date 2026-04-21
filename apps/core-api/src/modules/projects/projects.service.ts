import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@roadboard/database';
import { GrantSubjectType, GrantType, ProjectStatus } from '@roadboard/domain';
import { CreateProjectDto } from './create-project.dto';
import { UpdateProjectDto } from './update-project.dto';


@Injectable()
export class ProjectsService {

  constructor(@Inject('PRISMA') private readonly prisma: PrismaClient) {}


  private async resolveOwnerTeamId(dto: CreateProjectDto): Promise<string> {

    if (dto.ownerTeamId) {
      return dto.ownerTeamId;
    }

    if (!dto.ownerTeamSlug) {
      throw new BadRequestException('Either ownerTeamId or ownerTeamSlug must be provided');
    }

    const team = await this.prisma.team.findUnique({ where: { slug: dto.ownerTeamSlug } });

    if (!team) {
      throw new NotFoundException(`Team with slug "${dto.ownerTeamSlug}" not found`);
    }

    return team.id;
  }


  async create(dto: CreateProjectDto, createdByUserId?: string) {

    const ownerTeamId = await this.resolveOwnerTeamId(dto);

    const project = await this.prisma.project.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        ownerTeamId,
        status: dto.status,
        ownerUserId: createdByUserId ?? null,
      },
    });

    await this.prisma.projectGrant.create({
      data: {
        projectId: project.id,
        subjectType: GrantSubjectType.TEAM,
        subjectId: ownerTeamId,
        grantType: GrantType.PROJECT_ADMIN,
        grantedByUserId: createdByUserId ?? null,
      },
    });

    if (createdByUserId) {
      await this.prisma.projectGrant.create({
        data: {
          projectId: project.id,
          subjectType: GrantSubjectType.USER,
          subjectId: createdByUserId,
          grantType: GrantType.PROJECT_ADMIN,
          grantedByUserId: createdByUserId,
        },
      });
    }

    return project;
  }


  async findAll(status?: ProjectStatus, userId?: string) {

    if (!userId) {
      const where = status ? { status } : {};
      return this.prisma.project.findMany({ where });
    }

    // Collect team IDs the user belongs to
    const memberships = await this.prisma.teamMembership.findMany({
      where: { userId, status: 'active' },
      select: { teamId: true },
    });

    const teamIds = memberships.map((m) => m.teamId);

    // Find projects where the user has a direct grant OR a team grant
    const grants = await this.prisma.projectGrant.findMany({
      where: {
        OR: [
          { subjectType: 'user', subjectId: userId },
          ...(teamIds.length ? [{ subjectType: 'team', subjectId: { in: teamIds } }] : []),
        ],
      },
      select: { projectId: true },
      distinct: ['projectId'],
    });

    const projectIds = grants.map((g) => g.projectId);

    if (projectIds.length === 0) {
      return [];
    }

    const where = {
      id: { in: projectIds },
      ...(status ? { status } : {}),
    };

    return this.prisma.project.findMany({ where });
  }


  async findOne(id: string) {

    const project = await this.prisma.project.findUnique({ where: { id } });

    if (!project) {
      throw new NotFoundException(`Project ${id} not found`);
    }

    return project;
  }


  async update(id: string, dto: UpdateProjectDto) {

    await this.findOne(id);

    return this.prisma.project.update({
      where: { id },
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        ownerTeamId: dto.ownerTeamId,
        status: dto.status,
      },
    });
  }


  async delete(id: string, requestingUserId?: string) {

    const project = await this.findOne(id);

    if (project.ownerUserId && requestingUserId && project.ownerUserId !== requestingUserId) {
      throw new ForbiddenException('Only the project owner can delete this project');
    }

    return this.prisma.project.delete({ where: { id } });
  }
}
