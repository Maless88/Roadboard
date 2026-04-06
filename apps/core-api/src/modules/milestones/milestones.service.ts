import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@roadboard/database';
import { CreateMilestoneDto } from './create-milestone.dto';
import { UpdateMilestoneDto } from './update-milestone.dto';


interface FindAllFilters {
  projectId: string;
  phaseId?: string;
}


@Injectable()
export class MilestonesService {

  constructor(@Inject('PRISMA') private readonly prisma: PrismaClient) {}


  async create(dto: CreateMilestoneDto) {

    return this.prisma.milestone.create({
      data: {
        projectId: dto.projectId,
        phaseId: dto.phaseId,
        title: dto.title,
        description: dto.description,
        dueDate: dto.dueDate,
        status: dto.status,
        orderIndex: dto.orderIndex,
      },
    });
  }


  async findAll(filters: FindAllFilters) {

    const where: Record<string, unknown> = { projectId: filters.projectId };

    if (filters.phaseId) {
      where.phaseId = filters.phaseId;
    }

    return this.prisma.milestone.findMany({
      where,
      orderBy: { orderIndex: 'asc' },
    });
  }


  async findOne(id: string) {

    const milestone = await this.prisma.milestone.findUnique({ where: { id } });

    if (!milestone) {
      throw new NotFoundException(`Milestone ${id} not found`);
    }

    return milestone;
  }


  async update(id: string, dto: UpdateMilestoneDto) {

    await this.findOne(id);

    return this.prisma.milestone.update({
      where: { id },
      data: {
        projectId: dto.projectId,
        phaseId: dto.phaseId,
        title: dto.title,
        description: dto.description,
        dueDate: dto.dueDate,
        status: dto.status,
        orderIndex: dto.orderIndex,
      },
    });
  }


  async delete(id: string) {

    await this.findOne(id);

    return this.prisma.milestone.delete({ where: { id } });
  }
}
