import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@roadboard/database';
import { CreateDecisionDto } from './create-decision.dto';
import { UpdateDecisionDto } from './update-decision.dto';


@Injectable()
export class DecisionsService {

  constructor(@Inject('PRISMA') private readonly prisma: PrismaClient) {}


  async create(dto: CreateDecisionDto) {

    return this.prisma.decision.create({
      data: {
        projectId: dto.projectId,
        title: dto.title,
        summary: dto.summary,
        rationale: dto.rationale,
        status: dto.status ?? 'open',
        impactLevel: dto.impactLevel ?? 'medium',
        createdByUserId: dto.createdByUserId,
      },
    });
  }


  async findAll(projectId: string, status?: string) {

    const where: Record<string, unknown> = { projectId };

    if (status) {
      where.status = status;
    }

    return this.prisma.decision.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }


  async findOne(id: string) {

    const decision = await this.prisma.decision.findUnique({ where: { id } });

    if (!decision) {
      throw new NotFoundException(`Decision ${id} not found`);
    }

    return decision;
  }


  async update(id: string, dto: UpdateDecisionDto) {

    await this.findOne(id);

    return this.prisma.decision.update({
      where: { id },
      data: {
        title: dto.title,
        summary: dto.summary,
        rationale: dto.rationale,
        status: dto.status,
        impactLevel: dto.impactLevel,
      },
    });
  }


  async delete(id: string) {

    await this.findOne(id);

    return this.prisma.decision.delete({ where: { id } });
  }
}
