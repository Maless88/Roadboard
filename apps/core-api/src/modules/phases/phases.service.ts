import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@roadboard/database';
import { CreatePhaseDto } from './create-phase.dto';
import { UpdatePhaseDto } from './update-phase.dto';


@Injectable()
export class PhasesService {

  constructor(@Inject('PRISMA') private readonly prisma: PrismaClient) {}


  async create(dto: CreatePhaseDto) {

    return this.prisma.phase.create({
      data: {
        projectId: dto.projectId,
        decisionId: dto.decisionId,
        title: dto.title,
        description: dto.description,
        orderIndex: dto.orderIndex,
        status: dto.status,
        startDate: dto.startDate,
        endDate: dto.endDate,
      },
    });
  }


  async findAll(projectId: string, decisionId?: string) {

    return this.prisma.phase.findMany({
      where: { projectId, ...(decisionId ? { decisionId } : {}) },
      orderBy: { orderIndex: 'asc' },
    });
  }


  async findOne(id: string) {

    const phase = await this.prisma.phase.findUnique({ where: { id } });

    if (!phase) {
      throw new NotFoundException(`Phase ${id} not found`);
    }

    return phase;
  }


  async update(id: string, dto: UpdatePhaseDto) {

    await this.findOne(id);

    return this.prisma.phase.update({
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
      },
    });
  }


  async delete(id: string) {

    await this.findOne(id);

    return this.prisma.phase.delete({ where: { id } });
  }
}
