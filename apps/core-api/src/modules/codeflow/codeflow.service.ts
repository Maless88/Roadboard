import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@roadboard/database';

import { CreateRepositoryDto } from './dto/create-repository.dto';
import { UpdateRepositoryDto } from './dto/update-repository.dto';


@Injectable()
export class CodeflowService {

  constructor(@Inject('PRISMA') private readonly prisma: PrismaClient) {}


  async createRepository(dto: CreateRepositoryDto) {

    return this.prisma.codeRepository.create({
      data: {
        projectId: dto.projectId,
        name: dto.name,
        repoUrl: dto.repoUrl,
        provider: dto.provider ?? 'manual',
        defaultBranch: dto.defaultBranch ?? 'main',
        scanIntervalH: dto.scanIntervalH,
      },
    });
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

    await this.getRepository(id);

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
