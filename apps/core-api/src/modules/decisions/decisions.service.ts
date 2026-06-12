import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@roadboard/database';
import type { AuthUser } from '../../common/auth-user';
import { AuditService } from '../audit/audit.service';
import { CreateDecisionDto } from './create-decision.dto';
import { UpdateDecisionDto } from './update-decision.dto';


interface FindAllFilters {
  projectId: string;
  status?: string;
  updatedSince?: string;
  limit?: number;
  cursor?: string;
}


const AUTHOR_INCLUDE = {
  createdBy: { select: { id: true, username: true, displayName: true } },
  updatedBy: { select: { id: true, username: true, displayName: true } },
} as const;


@Injectable()
export class DecisionsService {

  constructor(
    @Inject('PRISMA') private readonly prisma: PrismaClient,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}


  async create(dto: CreateDecisionDto, user: AuthUser) {

    const existing = dto.id
      ? await this.prisma.decision.findUnique({ where: { id: dto.id } })
      : null;

    if (existing && existing.projectId !== dto.projectId) {
      throw new ConflictException(
        `Decision ${dto.id} already exists in a different project`,
      );
    }

    const decision = existing
      ? await this.prisma.decision.update({
          where: { id: existing.id },
          data: {
            title: dto.title,
            summary: dto.summary,
            rationale: dto.rationale,
            status: dto.status ?? 'open',
            impactLevel: dto.impactLevel ?? 'medium',
            updatedByUserId: user.userId,
          },
          include: AUTHOR_INCLUDE,
        })
      : await this.prisma.decision.create({
          data: {
            id: dto.id,
            projectId: dto.projectId,
            title: dto.title,
            summary: dto.summary,
            rationale: dto.rationale,
            status: dto.status ?? 'open',
            impactLevel: dto.impactLevel ?? 'medium',
            createdByUserId: dto.createdByUserId ?? user.userId,
            updatedByUserId: user.userId,
          },
          include: AUTHOR_INCLUDE,
        });

    await this.audit.recordForUser(
      user,
      existing ? 'decision.updated' : 'decision.created',
      'decision',
      decision.id,
      decision.projectId,
      { title: decision.title, impactLevel: decision.impactLevel },
    );

    return decision;
  }


  async findAll(filters: FindAllFilters) {

    const where: Record<string, unknown> = { projectId: filters.projectId };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.updatedSince) {
      where.updatedAt = { gt: new Date(filters.updatedSince) };
    }

    const orderBy = filters.updatedSince
      ? [{ updatedAt: 'asc' as const }, { id: 'asc' as const }]
      : { createdAt: 'desc' as const };

    if (filters.limit !== undefined) {
      const limit = filters.limit;
      const items = await this.prisma.decision.findMany({
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

    return this.prisma.decision.findMany({
      where,
      orderBy,
      include: AUTHOR_INCLUDE,
    });
  }


  async findOne(id: string) {

    const decision = await this.prisma.decision.findUnique({
      where: { id },
      include: AUTHOR_INCLUDE,
    });

    if (!decision) {
      throw new NotFoundException(`Decision ${id} not found`);
    }

    return decision;
  }


  async update(id: string, dto: UpdateDecisionDto, user: AuthUser) {

    const existing = await this.findOne(id);

    const statusChanged = dto.status !== undefined && dto.status !== existing.status;

    const resolvedAt = dto.resolvedAt
      ?? (dto.status && ['accepted', 'rejected', 'superseded'].includes(dto.status)
        ? new Date()
        : undefined);

    const decision = await this.prisma.decision.update({
      where: { id },
      data: {
        title: dto.title,
        summary: dto.summary,
        rationale: dto.rationale,
        outcome: dto.outcome,
        status: dto.status,
        impactLevel: dto.impactLevel,
        resolvedAt,
        updatedByUserId: user.userId,
      },
      include: AUTHOR_INCLUDE,
    });

    if (statusChanged) {
      await this.audit.recordForUser(user, 'decision.status_changed', 'decision', decision.id, decision.projectId, {
        from: existing.status,
        to: decision.status,
      });
    } else {
      await this.audit.recordForUser(user, 'decision.updated', 'decision', decision.id, decision.projectId);
    }

    return decision;
  }


  async delete(id: string, user: AuthUser) {

    const decision = await this.findOne(id);

    const deleted = await this.prisma.decision.delete({ where: { id } });

    await this.audit.recordForUser(user, 'decision.deleted', 'decision', decision.id, decision.projectId, {
      title: decision.title,
    });

    return deleted;
  }
}
