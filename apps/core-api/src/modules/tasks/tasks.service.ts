import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@roadboard/database';
import { TaskStatus } from '@roadboard/domain';
import type { AuthUser } from '../../common/auth-user';
import { AuditService } from '../audit/audit.service';
import { CreateTaskDto } from './create-task.dto';
import { UpdateTaskDto } from './update-task.dto';


interface FindAllFilters {
  projectId: string;
  phaseId?: string;
  status?: TaskStatus;
}


const AUTHOR_INCLUDE = {
  createdBy: { select: { id: true, username: true, displayName: true } },
  updatedBy: { select: { id: true, username: true, displayName: true } },
} as const;


@Injectable()
export class TasksService {

  constructor(
    @Inject('PRISMA') private readonly prisma: PrismaClient,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}


  async create(dto: CreateTaskDto, user: AuthUser) {

    const task = await this.prisma.task.create({
      data: {
        projectId: dto.projectId,
        phaseId: dto.phaseId,
        title: dto.title,
        description: dto.description,
        status: dto.status,
        priority: dto.priority,
        assigneeId: dto.assigneeId,
        dueDate: dto.dueDate,
        createdByUserId: user.userId,
        updatedByUserId: user.userId,
      },
      include: AUTHOR_INCLUDE,
    });

    await this.audit.recordForUser(user, 'task.created', 'task', task.id, task.projectId, {
      title: task.title,
      phaseId: task.phaseId,
    });

    await this.recomputePhaseStatus(task.phaseId);
    await this.recomputeProjectStatus(task.projectId);

    return task;
  }


  async findAll(filters: FindAllFilters) {

    const where: Record<string, unknown> = { projectId: filters.projectId };

    if (filters.phaseId) {
      where.phaseId = filters.phaseId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    return this.prisma.task.findMany({ where, include: AUTHOR_INCLUDE });
  }


  async findOne(id: string) {

    const task = await this.prisma.task.findUnique({
      where: { id },
      include: AUTHOR_INCLUDE,
    });

    if (!task) {
      throw new NotFoundException(`Task ${id} not found`);
    }

    return task;
  }


  async update(id: string, dto: UpdateTaskDto, user: AuthUser) {

    const existing = await this.findOne(id);

    const isClosing = dto.status === TaskStatus.DONE && existing.status !== TaskStatus.DONE;
    const statusChanged = dto.status !== undefined && dto.status !== existing.status;

    const task = await this.prisma.task.update({
      where: { id },
      data: {
        phaseId: dto.phaseId,
        title: dto.title,
        description: dto.description,
        status: dto.status,
        priority: dto.priority,
        assigneeId: dto.assigneeId,
        dueDate: dto.dueDate,
        completionNotes: dto.completionNotes,
        completedAt: isClosing ? new Date() : undefined,
        updatedByUserId: user.userId,
      },
      include: AUTHOR_INCLUDE,
    });

    if (statusChanged) {
      await this.audit.recordForUser(user, 'task.status_changed', 'task', task.id, task.projectId, {
        from: existing.status,
        to: task.status,
      });
    } else {
      await this.audit.recordForUser(user, 'task.updated', 'task', task.id, task.projectId);
    }

    const phasesToRecompute = new Set<string>([task.phaseId]);

    if (dto.phaseId && dto.phaseId !== existing.phaseId) {
      phasesToRecompute.add(existing.phaseId);
    }

    for (const phaseId of phasesToRecompute) {
      await this.recomputePhaseStatus(phaseId);
    }

    await this.recomputeProjectStatus(task.projectId);

    return task;
  }


  async delete(id: string, user: AuthUser) {

    const task = await this.findOne(id);

    await this.prisma.task.delete({ where: { id } });

    await this.audit.recordForUser(user, 'task.deleted', 'task', task.id, task.projectId, {
      title: task.title,
    });

    await this.recomputePhaseStatus(task.phaseId);
    await this.recomputeProjectStatus(task.projectId);
  }


  private async recomputePhaseStatus(phaseId: string): Promise<void> {

    const tasks = await this.prisma.task.findMany({
      where: { phaseId },
      select: { status: true },
    });

    if (tasks.length === 0) return;

    let status: string;
    const statuses = tasks.map((t) => t.status);

    if (statuses.every((s) => s === 'done' || s === 'cancelled')) {
      status = 'completed';
    } else if (statuses.some((s) => s === 'blocked')) {
      status = 'blocked';
    } else if (statuses.some((s) => s === 'in_progress')) {
      status = 'in_progress';
    } else {
      status = 'planned';
    }

    await this.prisma.phase.update({ where: { id: phaseId }, data: { status } });
  }


  private async recomputeProjectStatus(projectId: string): Promise<void> {

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { status: true },
    });

    if (!project || project.status === 'archived' || project.status === 'paused') return;

    const phases = await this.prisma.phase.findMany({
      where: { projectId },
      select: { status: true },
    });

    if (phases.length === 0) return;

    const allCompleted = phases.every((p) => p.status === 'completed');

    if (allCompleted) {
      await this.prisma.project.update({ where: { id: projectId }, data: { status: 'completed' } });
    } else if (project.status === 'completed') {
      await this.prisma.project.update({ where: { id: projectId }, data: { status: 'active' } });
    }
  }
}
