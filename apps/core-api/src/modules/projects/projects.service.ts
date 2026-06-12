import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@roadboard/database';
import { GrantSubjectType, GrantType, ProjectStatus } from '@roadboard/domain';
import { isInheritableByTeamMember } from '@roadboard/grants';
import { optionalEnv } from '@roadboard/config';
import type { AuthUser } from '../../common/auth-user';
import { AuditService } from '../audit/audit.service';
import { CreateProjectDto } from './create-project.dto';
import { UpdateProjectDto } from './update-project.dto';


@Injectable()
export class ProjectsService {

  private readonly logger = new Logger(ProjectsService.name);
  private readonly recentlyEnqueued = new Map<string, number>();


  constructor(
    @Inject('PRISMA') private readonly prisma: PrismaClient,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}


  private maybeEnqueueRefresh(project: { id: string; homeUrl: string | null; thumbnailExpiresAt: Date | null }): void {

    if (!project.homeUrl) return;

    const now = Date.now();
    const expiresAt = project.thumbnailExpiresAt ? project.thumbnailExpiresAt.getTime() : 0;

    if (expiresAt > now) return;

    // De-dupe enqueue within a 60s window per project (in-memory; per-instance).
    const last = this.recentlyEnqueued.get(project.id) ?? 0;

    if (now - last < 60_000) return;

    this.recentlyEnqueued.set(project.id, now);

    const workerHost = optionalEnv('WORKER_JOBS_HOST', 'localhost');
    const workerPort = optionalEnv('WORKER_JOBS_PORT', '3003');
    const url = `http://${workerHost}:${workerPort}/jobs/thumbnail-refresh`;

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: project.id }),
    }).catch((err) => this.logger.warn(`enqueue thumbnail-refresh failed: ${(err as Error).message}`));
  }


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


  async create(dto: CreateProjectDto, user?: AuthUser) {

    const ownerTeamId = await this.resolveOwnerTeamId(dto);
    const createdByUserId = user?.userId;

    const existing = dto.id
      ? await this.prisma.project.findUnique({ where: { id: dto.id } })
      : null;

    if (existing && existing.ownerTeamId !== ownerTeamId) {
      throw new ConflictException(
        `Project ${dto.id} already exists under a different owner team`,
      );
    }

    if (existing) {
      const updated = await this.prisma.project.update({
        where: { id: existing.id },
        data: {
          name: dto.name,
          slug: dto.slug,
          description: dto.description,
          status: dto.status,
        },
      });

      if (user) {
        await this.audit.recordForUser(user, 'project.updated', 'project', updated.id, updated.id, {
          name: updated.name,
          slug: updated.slug,
          ownerTeamId,
          status: updated.status,
        });
      }

      return updated;
    }

    const project = await this.prisma.project.create({
      data: {
        id: dto.id,
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

    if (user) {
      await this.audit.recordForUser(user, 'project.created', 'project', project.id, project.id, {
        name: project.name,
        slug: project.slug,
        ownerTeamId,
        status: project.status,
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

    const OWNER_TEAM_INCLUDE = {
      ownerTeam: { select: { id: true, name: true, slug: true } },
    } as const;

    if (!userId) {
      const where = status ? { status } : {};
      const projects = await this.prisma.project.findMany({ where, include: OWNER_TEAM_INCLUDE });

      for (const p of projects) this.maybeEnqueueRefresh(p);

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

    const projects = await this.prisma.project.findMany({ where, include: OWNER_TEAM_INCLUDE });

    for (const p of projects) this.maybeEnqueueRefresh(p);

    return this.decorateWithArchivedForMe(projects, userId);
  }


  async archiveForUser(projectId: string, user: AuthUser) {

    await this.findOne(projectId);

    await this.prisma.projectUserArchive.upsert({
      where: { projectId_userId: { projectId, userId: user.userId } },
      update: {},
      create: { projectId, userId: user.userId },
    });

    await this.audit.recordForUser(user, 'project.archived', 'project', projectId, projectId, {
      scope: 'per_user',
    });

    return { projectId, userId: user.userId, archivedForMe: true };
  }


  async unarchiveForUser(projectId: string, user: AuthUser) {

    await this.findOne(projectId);

    await this.prisma.projectUserArchive.deleteMany({
      where: { projectId, userId: user.userId },
    });

    await this.audit.recordForUser(user, 'project.unarchived', 'project', projectId, projectId, {
      scope: 'per_user',
    });

    return { projectId, userId: user.userId, archivedForMe: false };
  }


  async findOne(id: string) {

    const project = await this.prisma.project.findUnique({
      where: { id },
      include: { ownerTeam: { select: { id: true, name: true, slug: true } } },
    });

    if (!project) {
      throw new NotFoundException(`Project ${id} not found`);
    }

    return project;
  }


  async update(id: string, dto: UpdateProjectDto, user?: AuthUser) {

    const current = await this.findOne(id);

    const data: Record<string, unknown> = {
      name: dto.name,
      slug: dto.slug,
      description: dto.description,
      ownerTeamId: dto.ownerTeamId,
      status: dto.status,
    };

    if (dto.homeUrl !== undefined) {
      const next = dto.homeUrl.trim();
      const normalized = next.length === 0 ? null : next;
      data.homeUrl = normalized;

      // If homeUrl changed, invalidate the auto-screenshot thumbnail.
      // Manual uploads (thumbnailManualUpload=true) are preserved unless homeUrl was set,
      // because going URL→manual or manual→URL is a deliberate switch.
      if (current.homeUrl !== normalized) {

        if (current.thumbnailManualUpload && normalized !== null) {
          // Switching from manual upload back to auto URL — clear the manual thumb
          data.thumbnailUrl = null;
          data.thumbnailUpdatedAt = null;
          data.thumbnailExpiresAt = null;
          data.thumbnailManualUpload = false;
        } else if (!current.thumbnailManualUpload) {
          // Auto URL changed — expire the auto thumbnail so the worker regenerates it
          data.thumbnailExpiresAt = new Date(0);
        }
      }
    }

    const updated = await this.prisma.project.update({ where: { id }, data });

    if (user) {
      const changedFields: Record<string, { from: unknown; to: unknown }> = {};
      const trackedKeys = ['name', 'slug', 'description', 'ownerTeamId', 'status', 'homeUrl'] as const;

      for (const key of trackedKeys) {
        const before = (current as Record<string, unknown>)[key];
        const after = (updated as Record<string, unknown>)[key];

        if (dto[key as keyof UpdateProjectDto] !== undefined && before !== after) {
          changedFields[key] = { from: before ?? null, to: after ?? null };
        }
      }

      if (Object.keys(changedFields).length > 0) {
        await this.audit.recordForUser(user, 'project.updated', 'project', updated.id, updated.id, {
          changed: changedFields,
        });
      }
    }

    return updated;
  }


  async delete(id: string, user?: AuthUser) {

    const project = await this.findOne(id);
    const requestingUserId = user?.userId;

    if (project.ownerUserId && requestingUserId && project.ownerUserId !== requestingUserId) {
      throw new ForbiddenException('Only the project owner can delete this project');
    }

    const deleted = await this.prisma.project.delete({ where: { id } });

    if (user) {
      await this.audit.recordForUser(user, 'project.deleted', 'project', project.id, project.id, {
        name: project.name,
        slug: project.slug,
      });
    }

    return deleted;
  }
}
