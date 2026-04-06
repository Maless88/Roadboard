import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@roadboard/database';
import { TaskStatus } from '@roadboard/domain';
import { CreateTaskDto } from './create-task.dto';
import { UpdateTaskDto } from './update-task.dto';


interface FindAllFilters {
  projectId: string;
  phaseId?: string;
  milestoneId?: string;
  status?: TaskStatus;
}


@Injectable()
export class TasksService {

  constructor(@Inject('PRISMA') private readonly prisma: PrismaClient) {}


  async create(dto: CreateTaskDto) {

    return this.prisma.task.create({
      data: {
        projectId: dto.projectId,
        phaseId: dto.phaseId,
        milestoneId: dto.milestoneId,
        title: dto.title,
        description: dto.description,
        status: dto.status,
        priority: dto.priority,
        assigneeId: dto.assigneeId,
        dueDate: dto.dueDate,
      },
    });
  }


  async findAll(filters: FindAllFilters) {

    const where: Record<string, unknown> = { projectId: filters.projectId };

    if (filters.phaseId) {
      where.phaseId = filters.phaseId;
    }

    if (filters.milestoneId) {
      where.milestoneId = filters.milestoneId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    return this.prisma.task.findMany({ where });
  }


  async findOne(id: string) {

    const task = await this.prisma.task.findUnique({ where: { id } });

    if (!task) {
      throw new NotFoundException(`Task ${id} not found`);
    }

    return task;
  }


  async update(id: string, dto: UpdateTaskDto) {

    await this.findOne(id);

    return this.prisma.task.update({
      where: { id },
      data: {
        projectId: dto.projectId,
        phaseId: dto.phaseId,
        milestoneId: dto.milestoneId,
        title: dto.title,
        description: dto.description,
        status: dto.status,
        priority: dto.priority,
        assigneeId: dto.assigneeId,
        dueDate: dto.dueDate,
      },
    });
  }


  async delete(id: string) {

    await this.findOne(id);

    return this.prisma.task.delete({ where: { id } });
  }
}
