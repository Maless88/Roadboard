import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@roadboard/database';
import { ProjectStatus } from '@roadboard/domain';
import { CreateProjectDto } from './create-project.dto';
import { UpdateProjectDto } from './update-project.dto';


@Injectable()
export class ProjectsService {

  constructor(@Inject('PRISMA') private readonly prisma: PrismaClient) {}


  async create(dto: CreateProjectDto) {

    return this.prisma.project.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        ownerTeamId: dto.ownerTeamId,
        status: dto.status,
      },
    });
  }


  async findAll(status?: ProjectStatus) {

    const where = status ? { status } : {};

    return this.prisma.project.findMany({ where });
  }


  async findOne(id: string) {

    const project = await this.prisma.project.findUnique({ where: { id } });

    if (!project) {
      throw new NotFoundException(`Project ${id} not found`);
    }

    return project;
  }


  async update(id: string, dto: UpdateProjectDto) {

    await this.findOne(id);

    return this.prisma.project.update({
      where: { id },
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        ownerTeamId: dto.ownerTeamId,
        status: dto.status,
      },
    });
  }


  async delete(id: string) {

    await this.findOne(id);

    return this.prisma.project.delete({ where: { id } });
  }
}
