import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@roadboard/database';
import { optionalEnv } from '@roadboard/config';

import { CreateNodeDto } from './dto/create-node.dto';
import { UpdateNodeDto } from './dto/update-node.dto';
import { CreateEdgeDto } from './dto/create-edge.dto';
import { CreateLinkDto } from './dto/create-link.dto';
import { CreateAnnotationDto } from './dto/create-annotation.dto';
import { GraphSyncService } from './graph-sync.service';


/**
 * Internal helper type for outbox events emitted alongside a Postgres write.
 * The actual `graphSyncEvent` Prisma model is the persistent counterpart.
 */
interface OutboxEventInput {
  projectId: string;
  entityType: 'node' | 'edge' | 'link' | 'annotation' | 'repository' | 'project';
  entityId: string;
  op: 'upsert' | 'delete' | 'reset';
  payload: Record<string, unknown>;
}


@Injectable()
export class GraphService {

  private readonly useOutbox: boolean;

  constructor(
    @Inject('PRISMA') private readonly prisma: PrismaClient,
    @Inject(GraphSyncService) private readonly sync: GraphSyncService,
  ) {

    this.useOutbox = optionalEnv('GRAPH_SYNC_USE_OUTBOX', 'false') === 'true';
  }


  isOutboxMode(): boolean {
    return this.useOutbox;
  }


  // ── Graph ────────────────────────────────────────────

  async listEntityLinks(projectId: string, entityType: string, entityId: string): Promise<unknown> {

    const links = await this.prisma.architectureLink.findMany({
      where: { projectId, entityType, entityId },
      orderBy: { createdAt: 'desc' },
    });

    if (links.length === 0) {
      return { links: [], nodes: [] };
    }

    const nodeIds = [...new Set(links.map((l) => l.nodeId))];
    const nodes = await this.prisma.architectureNode.findMany({
      where: { id: { in: nodeIds } },
      include: {
        annotations: { orderBy: { createdAt: 'desc' }, take: 3 },
      },
    });

    return {
      links: links.map((l) => ({
        id: l.id,
        nodeId: l.nodeId,
        entityType: l.entityType,
        entityId: l.entityId,
        linkType: l.linkType,
        note: l.note,
        createdAt: l.createdAt,
      })),
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.type,
        name: n.name,
        path: n.path,
        domainGroup: n.domainGroup,
        description: n.description,
        annotationsPreview: n.annotations.map((a) => ({ content: a.content, createdAt: a.createdAt })),
      })),
    };
  }


  async resetProject(projectId: string): Promise<{ deletedNodes: number; deletedEdges: number }> {

    // FK-safe order: edges → links → annotations → nodes → snapshots → repositories.
    // Wrap in $transaction so a crash midway leaves Postgres consistent (CF-GDB-03a-2).
    if (this.useOutbox) {
      const result = await this.prisma.$transaction(async (tx) => {
        const edgeRes = await tx.architectureEdge.deleteMany({ where: { projectId } });
        await tx.architectureLink.deleteMany({ where: { projectId } });
        await tx.architectureAnnotation.deleteMany({ where: { projectId } });
        const nodeRes = await tx.architectureNode.deleteMany({ where: { projectId } });
        await tx.architectureSnapshot.deleteMany({ where: { projectId } });
        await tx.codeRepository.deleteMany({ where: { projectId } });
        await tx.graphSyncEvent.create({
          data: {
            projectId,
            entityType: 'project',
            entityId: projectId,
            op: 'reset',
            payload: { projectId },
          },
        });
        return { deletedNodes: nodeRes.count, deletedEdges: edgeRes.count };
      });
      return result;
    }

    const [edgeRes, , , nodeRes] = await this.prisma.$transaction([
      this.prisma.architectureEdge.deleteMany({ where: { projectId } }),
      this.prisma.architectureLink.deleteMany({ where: { projectId } }),
      this.prisma.architectureAnnotation.deleteMany({ where: { projectId } }),
      this.prisma.architectureNode.deleteMany({ where: { projectId } }),
      this.prisma.architectureSnapshot.deleteMany({ where: { projectId } }),
      this.prisma.codeRepository.deleteMany({ where: { projectId } }),
    ]);

    await this.sync.resetProject?.(projectId);

    return { deletedNodes: nodeRes.count, deletedEdges: edgeRes.count };
  }


  async getGraph(projectId: string): Promise<unknown> {

    const [nodes, edges, latestSnapshot] = await Promise.all([
      this.prisma.architectureNode.findMany({
        where: { projectId, isCurrent: true },
        include: {
          _count: { select: { links: true, annotations: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.architectureEdge.findMany({
        where: { projectId, isCurrent: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.architectureSnapshot.findFirst({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const taskCounts = await this.countLinkedEntities(projectId, nodes.map((n) => n.id), 'task');
    const decisionCounts = await this.countLinkedEntities(projectId, nodes.map((n) => n.id), 'decision');

    return {
      snapshotId: latestSnapshot?.id ?? null,
      snapshotStatus: latestSnapshot?.status ?? null,
      lastScannedAt: latestSnapshot?.completedAt ?? null,
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.type,
        name: n.name,
        path: n.path,
        domainGroup: n.domainGroup,
        isManual: n.isManual,
        ownerUserId: n.ownerUserId,
        ownerTeamId: n.ownerTeamId,
        openTaskCount: taskCounts[n.id] ?? 0,
        decisionCount: decisionCounts[n.id] ?? 0,
        annotationCount: n._count.annotations,
        metadata: n.metadata,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        fromNodeId: e.fromNodeId,
        toNodeId: e.toNodeId,
        edgeType: e.edgeType,
        weight: e.weight,
        isManual: e.isManual,
      })),
    };
  }


  private async countLinkedEntities(
    projectId: string,
    nodeIds: string[],
    entityType: string,
  ): Promise<Record<string, number>> {

    if (!nodeIds.length) return {};

    const links = await this.prisma.architectureLink.groupBy({
      by: ['nodeId'],
      where: { projectId, nodeId: { in: nodeIds }, entityType },
      _count: { id: true },
    });

    return Object.fromEntries(links.map((l) => [l.nodeId, l._count.id]));
  }


  // ── Nodes ────────────────────────────────────────────

  async createNode(projectId: string, dto: CreateNodeDto, createdByUserId: string): Promise<unknown> {

    const data = {
      projectId,
      repositoryId: dto.repositoryId,
      type: dto.type,
      name: dto.name,
      path: dto.path,
      description: dto.description,
      domainGroup: dto.domainGroup,
      isManual: dto.isManual ?? true,
      ownerUserId: dto.ownerUserId,
      ownerTeamId: dto.ownerTeamId,
    };

    if (this.useOutbox) {
      return this.prisma.$transaction(async (tx) => {
        const node = await tx.architectureNode.create({ data });
        await tx.graphSyncEvent.create({
          data: {
            projectId: node.projectId,
            entityType: 'node',
            entityId: node.id,
            op: 'upsert',
            payload: this.nodeProjection(node),
          },
        });
        return node;
      });
    }

    const node = await this.prisma.architectureNode.create({ data });
    await this.sync.upsertNode({
      id: node.id,
      projectId: node.projectId,
      type: node.type,
      name: node.name,
      path: node.path,
      domainGroup: node.domainGroup,
    });
    return node;
  }


  private nodeProjection(node: {
    id: string; projectId: string; type: string; name: string;
    path: string | null; domainGroup: string | null;
  }) {
    return {
      id: node.id, projectId: node.projectId, type: node.type, name: node.name,
      path: node.path, domainGroup: node.domainGroup,
    } as const;
  }


  private edgeProjection(edge: {
    id: string; projectId: string; fromNodeId: string; toNodeId: string;
    edgeType: string; weight: number;
  }) {
    return {
      id: edge.id, projectId: edge.projectId, fromNodeId: edge.fromNodeId,
      toNodeId: edge.toNodeId, edgeType: edge.edgeType, weight: edge.weight,
    } as const;
  }


  async getNode(id: string): Promise<unknown> {

    const node = await this.prisma.architectureNode.findUnique({
      where: { id },
      include: {
        annotations: { orderBy: { createdAt: 'desc' } },
        links: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!node) {
      throw new NotFoundException(`ArchitectureNode ${id} not found`);
    }

    return node;
  }


  async updateNode(id: string, dto: UpdateNodeDto): Promise<unknown> {

    await this.getNode(id);

    const data = {
      name: dto.name,
      description: dto.description,
      domainGroup: dto.domainGroup,
      ownerUserId: dto.ownerUserId,
      ownerTeamId: dto.ownerTeamId,
    };

    if (this.useOutbox) {
      return this.prisma.$transaction(async (tx) => {
        const updated = await tx.architectureNode.update({ where: { id }, data });
        await tx.graphSyncEvent.create({
          data: {
            projectId: updated.projectId,
            entityType: 'node',
            entityId: updated.id,
            op: 'upsert',
            payload: this.nodeProjection(updated),
          },
        });
        return updated;
      });
    }

    const updated = await this.prisma.architectureNode.update({ where: { id }, data });
    await this.sync.upsertNode(this.nodeProjection(updated) as Parameters<typeof this.sync.upsertNode>[0]);
    return updated;
  }


  async deleteNode(id: string): Promise<unknown> {

    const node = await this.getNode(id) as { isManual: boolean; projectId: string };

    if (!node.isManual) {
      throw new Error('Cannot delete auto-generated nodes; set isCurrent=false via rescan');
    }

    if (this.useOutbox) {
      return this.prisma.$transaction(async (tx) => {
        const deleted = await tx.architectureNode.delete({ where: { id } });
        await tx.graphSyncEvent.create({
          data: {
            projectId: node.projectId,
            entityType: 'node',
            entityId: id,
            op: 'delete',
            payload: { id, projectId: node.projectId },
          },
        });
        return deleted;
      });
    }

    const deleted = await this.prisma.architectureNode.delete({ where: { id } });
    await this.sync.deleteNode(id, node.projectId);
    return deleted;
  }


  // ── Edges ────────────────────────────────────────────

  async createEdge(projectId: string, dto: CreateEdgeDto): Promise<unknown> {

    const data = {
      projectId,
      fromNodeId: dto.fromNodeId,
      toNodeId: dto.toNodeId,
      edgeType: dto.edgeType,
      weight: dto.weight ?? 1.0,
      isManual: dto.isManual ?? true,
    };

    if (this.useOutbox) {
      return this.prisma.$transaction(async (tx) => {
        const edge = await tx.architectureEdge.create({ data });
        await tx.graphSyncEvent.create({
          data: {
            projectId: edge.projectId,
            entityType: 'edge',
            entityId: edge.id,
            op: 'upsert',
            payload: this.edgeProjection(edge),
          },
        });
        return edge;
      });
    }

    const edge = await this.prisma.architectureEdge.create({ data });
    await this.sync.upsertEdge(this.edgeProjection(edge) as Parameters<typeof this.sync.upsertEdge>[0]);
    return edge;
  }


  async deleteEdge(id: string): Promise<unknown> {

    const edge = await this.prisma.architectureEdge.findUnique({ where: { id } });

    if (!edge) {
      throw new NotFoundException(`ArchitectureEdge ${id} not found`);
    }

    if (!edge.isManual) {
      throw new Error('Cannot delete auto-generated edges; they are replaced on rescan');
    }

    if (this.useOutbox) {
      return this.prisma.$transaction(async (tx) => {
        const deleted = await tx.architectureEdge.delete({ where: { id } });
        await tx.graphSyncEvent.create({
          data: {
            projectId: edge.projectId,
            entityType: 'edge',
            entityId: id,
            op: 'delete',
            payload: { id, projectId: edge.projectId },
          },
        });
        return deleted;
      });
    }

    const deleted = await this.prisma.architectureEdge.delete({ where: { id } });
    await this.sync.deleteEdge(id, edge.projectId);
    return deleted;
  }


  // ── Links ────────────────────────────────────────────

  async createLink(nodeId: string, projectId: string, dto: CreateLinkDto, createdByUserId: string) {

    await this.getNode(nodeId);

    const data = {
      nodeId,
      projectId,
      entityType: dto.entityType,
      entityId: dto.entityId,
      linkType: dto.linkType,
      createdByUserId,
      note: dto.note,
    };

    if (this.useOutbox) {
      return this.prisma.$transaction(async (tx) => {
        const link = await tx.architectureLink.create({ data });
        await tx.graphSyncEvent.create({
          data: {
            projectId: link.projectId,
            entityType: 'link',
            entityId: link.id,
            op: 'upsert',
            payload: {
              id: link.id, projectId: link.projectId, nodeId: link.nodeId,
              entityType: link.entityType, entityId: link.entityId,
              linkType: link.linkType, note: link.note,
            },
          },
        });
        return link;
      });
    }

    return this.prisma.architectureLink.create({ data });
  }


  async listLinks(nodeId: string) {

    await this.getNode(nodeId);

    return this.prisma.architectureLink.findMany({
      where: { nodeId },
      orderBy: { createdAt: 'desc' },
    });
  }


  async deleteLink(id: string) {

    const link = await this.prisma.architectureLink.findUnique({ where: { id } });

    if (!link) {
      throw new NotFoundException(`ArchitectureLink ${id} not found`);
    }

    if (this.useOutbox) {
      return this.prisma.$transaction(async (tx) => {
        const deleted = await tx.architectureLink.delete({ where: { id } });
        await tx.graphSyncEvent.create({
          data: {
            projectId: link.projectId,
            entityType: 'link',
            entityId: id,
            op: 'delete',
            payload: { id, projectId: link.projectId },
          },
        });
        return deleted;
      });
    }

    return this.prisma.architectureLink.delete({ where: { id } });
  }


  // ── Annotations ──────────────────────────────────────

  async createAnnotation(nodeId: string, projectId: string, dto: CreateAnnotationDto, createdByUserId: string) {

    await this.getNode(nodeId);

    const data = {
      nodeId,
      projectId,
      content: dto.content,
      createdByUserId,
    };

    if (this.useOutbox) {
      return this.prisma.$transaction(async (tx) => {
        const ann = await tx.architectureAnnotation.create({ data });
        await tx.graphSyncEvent.create({
          data: {
            projectId: ann.projectId,
            entityType: 'annotation',
            entityId: ann.id,
            op: 'upsert',
            payload: {
              id: ann.id, projectId: ann.projectId, nodeId: ann.nodeId, content: ann.content,
            },
          },
        });
        return ann;
      });
    }

    return this.prisma.architectureAnnotation.create({ data });
  }


  // ── Snapshot ─────────────────────────────────────────

  async getSnapshot(projectId: string) {

    const nodes = await this.prisma.architectureNode.findMany({
      where: { projectId, isCurrent: true },
      include: {
        annotations: true,
        _count: { select: { links: true } },
      },
    });

    const edges = await this.prisma.architectureEdge.findMany({
      where: { projectId, isCurrent: true },
    });

    // Top impact nodes: count incoming depends_on edges
    const impactMap: Record<string, number> = {};

    for (const edge of edges) {

      if (edge.edgeType === 'depends_on') {
        impactMap[edge.toNodeId] = (impactMap[edge.toNodeId] ?? 0) + 1;
      }
    }

    const topImpactNodes = Object.entries(impactMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([nodeId, directDependants]) => {
        const node = nodes.find((n) => n.id === nodeId);
        return { nodeId, name: node?.name ?? nodeId, directDependants };
      });

    return {
      projectId,
      generatedAt: new Date().toISOString(),
      nodeCount: nodes.length,
      edgeCount: edges.length,
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.type,
        name: n.name,
        path: n.path,
        domainGroup: n.domainGroup,
        openTaskCount: 0,
        linkedDecisionCount: n._count.links,
        annotations: n.annotations.map((a) => a.content),
      })),
      edges: edges.map((e) => ({ from: e.fromNodeId, to: e.toNodeId, type: e.edgeType })),
      topImpactNodes,
    };
  }


  // ── Impact ───────────────────────────────────────────

  async getImpact(nodeId: string, projectId: string): Promise<unknown> {

    const node = await this.getNode(nodeId) as { id: string; type: string; name: string; path: string | null };

    const edges = await this.prisma.architectureEdge.findMany({
      where: { projectId, isCurrent: true, edgeType: 'depends_on' },
    });

    // Build reverse adjacency list: who depends on whom
    const reverseDeps: Record<string, string[]> = {};

    for (const edge of edges) {
      (reverseDeps[edge.toNodeId] ??= []).push(edge.fromNodeId);
    }

    // BFS
    const direct: string[] = reverseDeps[nodeId] ?? [];
    const visited = new Set<string>([nodeId, ...direct]);
    const indirect: string[] = [];
    const remote: string[] = [];

    const queue = [...direct];

    let hops = 1;

    while (queue.length) {

      const next: string[] = [];

      for (const id of queue) {

        for (const dep of reverseDeps[id] ?? []) {

          if (!visited.has(dep)) {
            visited.add(dep);
            next.push(dep);

            if (hops === 1) indirect.push(dep);
            else remote.push(dep);
          }
        }
      }

      queue.splice(0, queue.length, ...next);
      hops++;

      if (hops > 10) break;
    }

    const allImpacted = [...direct, ...indirect, ...remote];

    const impactedNodes = await this.prisma.architectureNode.findMany({
      where: { id: { in: allImpacted } },
    });

    const nodeMap = Object.fromEntries(impactedNodes.map((n) => [n.id, n]));

    const toDto = (id: string) => {
      const n = nodeMap[id];
      return n ? { id: n.id, type: n.type, name: n.name, path: n.path } : { id, type: '', name: id, path: null };
    };

    return {
      triggerNode: { id: node.id, type: node.type, name: node.name, path: node.path },
      direct: direct.map(toDto),
      indirect: indirect.map(toDto),
      remote: remote.map(toDto),
    };
  }
}
