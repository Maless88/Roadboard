import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@roadboard/database';
import { CreateProjectRepositoryDto } from './create-project-repository.dto';
import { UpdateProjectRepositoryDto } from './update-project-repository.dto';


function deriveNameFromUrl(url: string): string {

  try {
    const pathname = new URL(url).pathname;
    const segment = pathname.split('/').filter(Boolean).pop() ?? url;
    return segment.replace(/\.git$/, '');
  } catch {
    return url;
  }
}


@Injectable()
export class ProjectRepositoriesService {

  constructor(@Inject('PRISMA') private readonly prisma: PrismaClient) {}


  async list(projectId: string) {

    return this.prisma.codeRepository.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }


  async create(projectId: string, dto: CreateProjectRepositoryDto) {

    const name = dto.name?.trim() || deriveNameFromUrl(dto.repoUrl);

    return this.prisma.codeRepository.create({
      data: {
        projectId,
        name,
        repoUrl: dto.repoUrl,
        provider: dto.provider,
        defaultBranch: dto.defaultBranch ?? 'main',
      },
    });
  }


  async update(repoId: string, projectId: string, dto: UpdateProjectRepositoryDto) {

    const existing = await this.prisma.codeRepository.findFirst({
      where: { id: repoId, projectId },
    });

    if (!existing) {
      throw new NotFoundException(`Repository ${repoId} not found in project ${projectId}`);
    }

    return this.prisma.codeRepository.update({
      where: { id: repoId },
      data: {
        ...(dto.provider !== undefined && { provider: dto.provider }),
        ...(dto.repoUrl !== undefined && { repoUrl: dto.repoUrl }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.defaultBranch !== undefined && { defaultBranch: dto.defaultBranch }),
      },
    });
  }


  async remove(repoId: string, projectId: string) {

    const existing = await this.prisma.codeRepository.findFirst({
      where: { id: repoId, projectId },
    });

    if (!existing) {
      throw new NotFoundException(`Repository ${repoId} not found in project ${projectId}`);
    }

    return this.prisma.codeRepository.delete({ where: { id: repoId } });
  }
}
