import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@roadboard/database';
import { GrantSubjectType, GrantType, ProjectStatus } from '@roadboard/domain';
import { isInheritableByTeamMember } from '@roadboard/grants';
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


  private async decorateWithArchivedForMe<T extends { id: string }>(
    projects: T[],
    userId?: string,
  ): Promise<Array<T & { archivedForMe: boolean }>> {

    if (!userId || projects.length === 0) {
      return projects.map((p) => ({ ...p, archivedForMe: false }));
    }

    const archives = await this.prisma.projectUserArchive.findMany({
      where: { userId, projectId: { in: projects.map((p) => p.id) } },
      select: { projectId: true },
    });

    const archivedSet = new Set(archives.map((a) => a.projectId));

    return projects.map((p) => ({ ...p, archivedForMe: archivedSet.has(p.id) }));
  }


  async findAll(status?: ProjectStatus, userId?: string) {

    if (!userId) {
      const where = status ? { status } : {};
      const projects = await this.prisma.project.findMany({ where });
      return this.decorateWithArchivedForMe(projects, userId);
    }

    // Collect team memberships (teamId + role) the user belongs to
    const memberships = await this.prisma.teamMembership.findMany({
      where: { userId, status: 'active' },
      select: { teamId: true, role: true },
    });

    const teamIds = memberships.map((m) => m.teamId);

    // Find projects where the user has a direct grant
    const directGrants = await this.prisma.projectGrant.findMany({
      where: { subjectType: 'user', subjectId: userId },
      select: { projectId: true },
      distinct: ['projectId'],
    });

    const projectIdSet = new Set<string>(directGrants.map((g) => g.projectId));

    // For team grants, honor the team_role gating: a member-only team with a
    // project.admin grant still grants visibility (downgraded to read+write),
    // but a team grant of only token.manage / codeflow.scan on a project does
    // not make the project visible to a plain member.
    if (teamIds.length > 0) {
      const teamGrants = await this.prisma.projectGrant.findMany({
        where: { subjectType: 'team', subjectId: { in: teamIds } },
        select: { projectId: true, subjectId: true, grantType: true },
      });

      const roleByTeam = new Map<string, 'admin' | 'member'>(
        memberships.map((m) => [m.teamId, m.role === 'admin' ? 'admin' : 'member']),
      );

      for (const g of teamGrants) {

        const role = roleByTeam.get(g.subjectId) ?? 'member';

        if (role === 'admin') {
          projectIdSet.add(g.projectId);
          continue;
        }

        // Member: inherits only if downgraded grant set is non-empty.
        // project.admin → downgrades to read+write+… so visibility is granted.
        const inherits =
          g.grantType === 'project.admin'
          || isInheritableByTeamMember(g.grantType as GrantType);

        if (inherits) projectIdSet.add(g.projectId);
      }
    }

    if (projectIdSet.size === 0) {
      return [];
    }

    const where = {
      id: { in: Array.from(projectIdSet) },
      ...(status ? { status } : {}),
    };

    const projects = await this.prisma.project.findMany({ where });
    return this.decorateWithArchivedForMe(projects, userId);
  }


  async archiveForUser(projectId: string, userId: string) {

    await this.findOne(projectId);

    await this.prisma.projectUserArchive.upsert({
      where: { projectId_userId: { projectId, userId } },
      update: {},
      create: { projectId, userId },
    });

    return { projectId, userId, archivedForMe: true };
  }


  async unarchiveForUser(projectId: string, userId: string) {

    await this.findOne(projectId);

    await this.prisma.projectUserArchive.deleteMany({
      where: { projectId, userId },
    });

    return { projectId, userId, archivedForMe: false };
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
