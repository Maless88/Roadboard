import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@roadboard/database';
import type { AuthUser } from '../../common/auth-user';
import { AuditService } from '../audit/audit.service';
import { CreatePhaseDto } from './create-phase.dto';
import { UpdatePhaseDto } from './update-phase.dto';


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

    const phase = await this.prisma.phase.create({
      data: {
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

    await this.audit.recordForUser(user, 'phase.created', 'phase', phase.id, phase.projectId, {
      title: phase.title,
    });

    return phase;
  }


  async findAll(projectId: string, decisionId?: string) {

    return this.prisma.phase.findMany({
      where: { projectId, ...(decisionId ? { decisionId } : {}) },
      orderBy: { orderIndex: 'asc' },
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
