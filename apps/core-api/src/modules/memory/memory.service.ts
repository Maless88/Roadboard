import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@roadboard/database';
import { MemoryEntryType } from '@roadboard/domain';
import { CreateMemoryEntryDto } from './create-memory-entry.dto';
import { UpdateMemoryEntryDto } from './update-memory-entry.dto';


interface FindAllFilters {
  projectId: string;
  type?: MemoryEntryType;
}


@Injectable()
export class MemoryService {

  constructor(@Inject('PRISMA') private readonly prisma: PrismaClient) {}


  async create(dto: CreateMemoryEntryDto) {

    return this.prisma.memoryEntry.create({
      data: {
        projectId: dto.projectId,
        type: dto.type,
        title: dto.title,
        body: dto.body,
      },
    });
  }


  async findAll(filters: FindAllFilters) {

    const where: Record<string, unknown> = { projectId: filters.projectId };

    if (filters.type) {
      where.type = filters.type;
    }

    return this.prisma.memoryEntry.findMany({ where });
  }


  async findOne(id: string) {

    const entry = await this.prisma.memoryEntry.findUnique({ where: { id } });

    if (!entry) {
      throw new NotFoundException(`MemoryEntry ${id} not found`);
    }

    return entry;
  }


  async update(id: string, dto: UpdateMemoryEntryDto) {

    await this.findOne(id);

    return this.prisma.memoryEntry.update({
      where: { id },
      data: {
        projectId: dto.projectId,
        type: dto.type,
        title: dto.title,
        body: dto.body,
      },
    });
  }


  async delete(id: string) {

    await this.findOne(id);

    return this.prisma.memoryEntry.delete({ where: { id } });
  }
}
