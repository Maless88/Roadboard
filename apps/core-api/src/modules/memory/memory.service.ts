import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@roadboard/database';
import { MemoryEntryType } from '@roadboard/domain';
import type { AuthUser } from '../../common/auth-user';
import { AuditService } from '../audit/audit.service';
import { CreateMemoryEntryDto } from './create-memory-entry.dto';
import { UpdateMemoryEntryDto } from './update-memory-entry.dto';


interface FindAllFilters {
  projectId: string;
  type?: MemoryEntryType;
  q?: string;
  take?: number;
}


const AUTHOR_INCLUDE = {
  createdBy: { select: { id: true, username: true, displayName: true } },
  updatedBy: { select: { id: true, username: true, displayName: true } },
} as const;


@Injectable()
export class MemoryService {

  constructor(
    @Inject('PRISMA') private readonly prisma: PrismaClient,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}


  async create(dto: CreateMemoryEntryDto, user: AuthUser) {

    const entry = await this.prisma.memoryEntry.create({
      data: {
        projectId: dto.projectId,
        type: dto.type,
        title: dto.title,
        body: dto.body,
        createdByUserId: user.userId,
        updatedByUserId: user.userId,
      },
      include: AUTHOR_INCLUDE,
    });

    await this.audit.recordForUser(user, 'memory.created', 'memory_entry', entry.id, entry.projectId, {
      title: entry.title,
      type: entry.type,
    });

    return entry;
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
      include: AUTHOR_INCLUDE,
      ...(filters.take ? { take: filters.take } : {}),
    });
  }


  async count(filters: { projectId: string; type?: string; q?: string }): Promise<number> {

    return this.prisma.memoryEntry.count({
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
    });
  }


  async findOne(id: string) {

    const entry = await this.prisma.memoryEntry.findUnique({
      where: { id },
      include: AUTHOR_INCLUDE,
    });

    if (!entry) {
      throw new NotFoundException(`MemoryEntry ${id} not found`);
    }

    return entry;
  }


  async update(id: string, dto: UpdateMemoryEntryDto, user: AuthUser) {

    const existing = await this.findOne(id);

    const entry = await this.prisma.memoryEntry.update({
      where: { id },
      data: {
        projectId: dto.projectId,
        type: dto.type,
        title: dto.title,
        body: dto.body,
        updatedByUserId: user.userId,
      },
      include: AUTHOR_INCLUDE,
    });

    await this.audit.recordForUser(user, 'memory.updated', 'memory_entry', entry.id, entry.projectId, {
      title: entry.title,
      previousTitle: existing.title,
    });

    return entry;
  }


  async delete(id: string, user: AuthUser) {

    const entry = await this.findOne(id);

    const deleted = await this.prisma.memoryEntry.delete({ where: { id } });

    await this.audit.recordForUser(user, 'memory.deleted', 'memory_entry', entry.id, entry.projectId, {
      title: entry.title,
    });

    return deleted;
  }
}
