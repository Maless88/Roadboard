import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@roadboard/database';
import { CreateDomainGroupDto } from './dto/create-domain-group.dto';
import { UpdateDomainGroupDto } from './dto/update-domain-group.dto';


@Injectable()
export class DomainGroupsService {

  constructor(@Inject('PRISMA') private readonly prisma: PrismaClient) {}


  async create(projectId: string, dto: CreateDomainGroupDto) {

    return this.prisma.domainGroup.create({
      data: {
        projectId,
        name: dto.name,
        color: dto.color,
      },
    });
  }


  async list(projectId: string) {

    return this.prisma.domainGroup.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });
  }


  async update(projectId: string, id: string, dto: UpdateDomainGroupDto) {

    await this.findOrThrow(projectId, id);

    return this.prisma.domainGroup.update({
      where: { id },
      data: {
        name: dto.name,
        color: dto.color,
      },
    });
  }


  async remove(projectId: string, id: string) {

    await this.findOrThrow(projectId, id);

    // Unset domainGroupId on all nodes belonging to this group.
    // Prisma onDelete: SetNull handles this via FK, but we do it explicitly
    // for clarity and to ensure Prisma client reflects the state.
    await this.prisma.architectureNode.updateMany({
      where: { domainGroupId: id, projectId },
      data: { domainGroupId: null },
    });

    return this.prisma.domainGroup.delete({ where: { id } });
  }


  async assignNode(projectId: string, nodeId: string, domainGroupId: string | null): Promise<unknown> {

    const node = await this.prisma.architectureNode.findUnique({ where: { id: nodeId } });

    if (!node || node.projectId !== projectId) {
      throw new NotFoundException(`ArchitectureNode ${nodeId} not found`);
    }

    if (domainGroupId !== null) {
      const group = await this.findOrThrow(projectId, domainGroupId);

      if (group.projectId !== projectId) {
        throw new NotFoundException(`DomainGroup ${domainGroupId} not found`);
      }
    }

    return this.prisma.architectureNode.update({
      where: { id: nodeId },
      data: { domainGroupId },
    });
  }


  private async findOrThrow(projectId: string, id: string) {

    const group = await this.prisma.domainGroup.findUnique({ where: { id } });

    if (!group || group.projectId !== projectId) {
      throw new NotFoundException(`DomainGroup ${id} not found`);
    }

    return group;
  }
}
