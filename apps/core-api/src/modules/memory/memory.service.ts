import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@roadboard/database';
import { MemoryEntryType } from '@roadboard/domain';
import { CreateMemoryEntryDto } from './create-memory-entry.dto';
import { UpdateMemoryEntryDto } from './update-memory-entry.dto';


interface FindAllFilters {
  projectId: string;
  type?: MemoryEntryType;
  q?: string;
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

    return this.prisma.memoryEntry.findMany({
      where: {
        projectId: filters.projectId,
        ...(filters.type ? { type: filters.type } : {}),
        ...(filters.q
          ? {
              OR: [
                { title: { contains: filters.q, mode: 'insensitive' } },
                { body: { contains: filters.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
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
