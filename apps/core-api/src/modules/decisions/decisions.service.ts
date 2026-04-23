import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@roadboard/database';
import type { AuthUser } from '../../common/auth-user';
import { AuditService } from '../audit/audit.service';
import { CreateDecisionDto } from './create-decision.dto';
import { UpdateDecisionDto } from './update-decision.dto';


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

    const decision = await this.prisma.decision.create({
      data: {
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

    await this.audit.recordForUser(user, 'decision.created', 'decision', decision.id, decision.projectId, {
      title: decision.title,
      impactLevel: decision.impactLevel,
    });

    return decision;
  }


  async findAll(projectId: string, status?: string) {

    const where: Record<string, unknown> = { projectId };

    if (status) {
      where.status = status;
    }

    return this.prisma.decision.findMany({
      where,
      orderBy: { createdAt: 'desc' },
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
