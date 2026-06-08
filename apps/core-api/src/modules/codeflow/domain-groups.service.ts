import { Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaClient } from '@roadboard/database';
import { GraphDbClient } from '@roadboard/graph-db';
import { CreateDomainGroupDto } from './dto/create-domain-group.dto';
import { UpdateDomainGroupDto } from './dto/update-domain-group.dto';


@Injectable()
export class DomainGroupsService {

  constructor(
    @Inject('PRISMA') private readonly prisma: PrismaClient,
    @Optional() @Inject('GRAPH_DB_CLIENT') private readonly graph?: GraphDbClient,
  ) {}


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

    const group = await this.findOrThrow(projectId, id);

    // Unset the domain-group association on all nodes belonging to this group.
    // Memgraph nodes carry the group NAME as the `domainGroup` property
    // (see GraphService.createNodeInMemgraph); clear it for every node in the
    // project that references this group.
    await this.requireGraph().run(
      `MATCH (n {projectId: $projectId, domainGroup: $name})
       WHERE NOT n:Link AND NOT n:Annotation
       SET n.domainGroup = null`,
      { projectId, name: group.name },
      { mode: 'write' },
    );

    return this.prisma.domainGroup.delete({ where: { id } });
  }


  async assignNode(projectId: string, nodeId: string, domainGroupId: string | null): Promise<unknown> {

    let groupName: string | null = null;

    if (domainGroupId !== null) {
      const group = await this.findOrThrow(projectId, domainGroupId);

      if (group.projectId !== projectId) {
        throw new NotFoundException(`DomainGroup ${domainGroupId} not found`);
      }

      groupName = group.name;
    }

    const records = await this.requireGraph().run<{ id: string }>(
      `MATCH (n {id: $nodeId, projectId: $projectId})
       WHERE NOT n:Link AND NOT n:Annotation
       SET n.domainGroup = $groupName
       RETURN n.id AS id`,
      { nodeId, projectId, groupName },
      { mode: 'write' },
    );

    if (records.length === 0) {
      throw new NotFoundException(`ArchitectureNode ${nodeId} not found`);
    }

    return { id: nodeId, projectId, domainGroup: groupName };
  }


  private requireGraph(): GraphDbClient {

    if (!this.graph) {
      throw new Error('GraphDbClient is not available');
    }

    return this.graph;
  }


  private async findOrThrow(projectId: string, id: string) {

    const group = await this.prisma.domainGroup.findUnique({ where: { id } });

    if (!group || group.projectId !== projectId) {
      throw new NotFoundException(`DomainGroup ${id} not found`);
    }

    return group;
  }
}
