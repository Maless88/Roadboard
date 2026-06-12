import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@roadboard/database';
import type { AuthUser } from '../../common/auth-user';
import { AuditService } from '../audit/audit.service';
import { CreatePhaseDto } from './create-phase.dto';
import { UpdatePhaseDto } from './update-phase.dto';


interface FindAllFilters {
  projectId: string;
  decisionId?: string;
  updatedSince?: string;
  limit?: number;
  cursor?: string;
}


const AUTHOR_INCLUDE = {
  createdBy: { select: { id: true, username: true, displayName: true } },
  updatedBy: { select: { id: true, username: true, displayName: true } },
} as const;


@Injectable()
export class PhasesService {

  constructor(
    @Inject('PRISMA') private readonly prisma: PrismaClient,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}


  async create(dto: CreatePhaseDto, user: AuthUser) {

    const existing = dto.id
      ? await this.prisma.phase.findUnique({ where: { id: dto.id } })
      : null;

    if (existing && existing.projectId !== dto.projectId) {
      throw new ConflictException(
        `Phase ${dto.id} already exists in a different project`,
      );
    }

    const phase = existing
      ? await this.prisma.phase.update({
          where: { id: existing.id },
          data: {
            decisionId: dto.decisionId,
            title: dto.title,
            description: dto.description,
            orderIndex: dto.orderIndex,
            status: dto.status,
            startDate: dto.startDate,
            endDate: dto.endDate,
            updatedByUserId: user.userId,
          },
          include: AUTHOR_INCLUDE,
        })
      : await this.prisma.phase.create({
          data: {
            id: dto.id,
            projectId: dto.projectId,
            decisionId: dto.decisionId,
            title: dto.title,
            description: dto.description,
            orderIndex: dto.orderIndex,
            status: dto.status,
            startDate: dto.startDate,
            endDate: dto.endDate,
            createdByUserId: user.userId,
            updatedByUserId: user.userId,
          },
          include: AUTHOR_INCLUDE,
        });

    await this.audit.recordForUser(
      user,
      existing ? 'phase.updated' : 'phase.created',
      'phase',
      phase.id,
      phase.projectId,
      { title: phase.title },
    );

    return phase;
  }


  async findAll(filters: FindAllFilters) {

    const where: Record<string, unknown> = { projectId: filters.projectId };

    if (filters.decisionId) {
      where.decisionId = filters.decisionId;
    }

    if (filters.updatedSince) {
      where.updatedAt = { gt: new Date(filters.updatedSince) };
    }

    const orderBy = filters.updatedSince
      ? [{ updatedAt: 'asc' as const }, { id: 'asc' as const }]
      : { createdAt: 'desc' as const };

    if (filters.limit !== undefined) {
      const limit = filters.limit;
      const items = await this.prisma.phase.findMany({
        where,
        orderBy,
        include: AUTHOR_INCLUDE,
        take: limit + 1,
        ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
      });

      const hasMore = items.length > limit;
      const page = hasMore ? items.slice(0, limit) : items;
      const nextCursor = hasMore ? page[page.length - 1].id : null;
      return { items: page, nextCursor };
    }

    return this.prisma.phase.findMany({
      where,
      orderBy,
      include: AUTHOR_INCLUDE,
    });
  }


  async findOne(id: string) {

    const phase = await this.prisma.phase.findUnique({
      where: { id },
      include: AUTHOR_INCLUDE,
    });

    if (!phase) {
      throw new NotFoundException(`Phase ${id} not found`);
    }

    return phase;
  }


  async update(id: string, dto: UpdatePhaseDto, user: AuthUser) {

    const existing = await this.findOne(id);

    const statusChanged = dto.status !== undefined && dto.status !== existing.status;

    const phase = await this.prisma.phase.update({
      where: { id },
      data: {
        projectId: dto.projectId,
        decisionId: dto.decisionId,
        title: dto.title,
        description: dto.description,
        orderIndex: dto.orderIndex,
        status: dto.status,
        startDate: dto.startDate,
        endDate: dto.endDate,
        updatedByUserId: user.userId,
      },
      include: AUTHOR_INCLUDE,
    });

    if (statusChanged) {
      await this.audit.recordForUser(user, 'phase.status_changed', 'phase', phase.id, phase.projectId, {
        from: existing.status,
        to: phase.status,
      });
    } else {
      await this.audit.recordForUser(user, 'phase.updated', 'phase', phase.id, phase.projectId);
    }

    return phase;
  }


  async delete(id: string, user: AuthUser) {

    const phase = await this.findOne(id);

    const deleted = await this.prisma.phase.delete({ where: { id } });

    await this.audit.recordForUser(user, 'phase.deleted', 'phase', phase.id, phase.projectId, {
      title: phase.title,
    });

    return deleted;
  }
}
