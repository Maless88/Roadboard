import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@roadboard/database';
import { optionalEnv } from '@roadboard/config';

import { CreateRepositoryDto } from './dto/create-repository.dto';
import { UpdateRepositoryDto } from './dto/update-repository.dto';


@Injectable()
export class CodeflowService {

  private readonly useOutbox: boolean;

  constructor(@Inject('PRISMA') private readonly prisma: PrismaClient) {
    this.useOutbox = optionalEnv('GRAPH_SYNC_USE_OUTBOX', 'false') === 'true';
  }


  async createRepository(dto: CreateRepositoryDto) {

    const data = {
      projectId: dto.projectId,
      name: dto.name,
      repoUrl: dto.repoUrl,
      provider: dto.provider ?? 'manual',
      defaultBranch: dto.defaultBranch ?? 'main',
      scanIntervalH: dto.scanIntervalH,
    };

    if (this.useOutbox) {
      return this.prisma.$transaction(async (tx) => {
        const repo = await tx.codeRepository.create({ data });
        await tx.graphSyncEvent.create({
          data: {
            projectId: repo.projectId,
            entityType: 'repository',
            entityId: repo.id,
            op: 'upsert',
            payload: {
              id: repo.id, projectId: repo.projectId, name: repo.name,
              repoUrl: repo.repoUrl, provider: repo.provider, defaultBranch: repo.defaultBranch,
            },
          },
        });
        return repo;
      });
    }

    return this.prisma.codeRepository.create({ data });
  }


  async listRepositories(projectId: string) {

    return this.prisma.codeRepository.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }


  async getRepository(id: string) {

    const repo = await this.prisma.codeRepository.findUnique({ where: { id } });

    if (!repo) {
      throw new NotFoundException(`CodeRepository ${id} not found`);
    }

    return repo;
  }


  async updateRepository(id: string, dto: UpdateRepositoryDto) {

    await this.getRepository(id);

    return this.prisma.codeRepository.update({
      where: { id },
      data: {
        name: dto.name,
        repoUrl: dto.repoUrl,
        provider: dto.provider,
        defaultBranch: dto.defaultBranch,
        scanIntervalH: dto.scanIntervalH,
      },
    });
  }


  async deleteRepository(id: string) {

    const repo = await this.getRepository(id);

    if (this.useOutbox) {
      return this.prisma.$transaction(async (tx) => {
        const deleted = await tx.codeRepository.delete({ where: { id } });
        await tx.graphSyncEvent.create({
          data: {
            projectId: repo.projectId,
            entityType: 'repository',
            entityId: id,
            op: 'delete',
            payload: { id, projectId: repo.projectId },
          },
        });
        return deleted;
      });
    }

    return this.prisma.codeRepository.delete({ where: { id } });
  }


  async listSnapshots(repositoryId: string) {

    return this.prisma.architectureSnapshot.findMany({
      where: { repositoryId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }
}
