import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@roadboard/database';

import { CreateNodeDto } from './dto/create-node.dto';
import { UpdateNodeDto } from './dto/update-node.dto';
import { CreateEdgeDto } from './dto/create-edge.dto';
import { CreateLinkDto } from './dto/create-link.dto';
import { CreateAnnotationDto } from './dto/create-annotation.dto';
import { GraphSyncService } from './graph-sync.service';


@Injectable()
export class GraphService {

  constructor(
    @Inject('PRISMA') private readonly prisma: PrismaClient,
    @Inject(GraphSyncService) private readonly sync: GraphSyncService,
  ) {}


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
    // Wrap in $transaction so a crash midway leaves Postgres consistent
    // instead of partially deleted (CF-GDB-03a-2).
    const [edgeRes, , , nodeRes] = await this.prisma.$transaction([
      this.prisma.architectureEdge.deleteMany({ where: { projectId } }),
      this.prisma.architectureLink.deleteMany({ where: { projectId } }),
      this.prisma.architectureAnnotation.deleteMany({ where: { projectId } }),
      this.prisma.architectureNode.deleteMany({ where: { projectId } }),
      this.prisma.architectureSnapshot.deleteMany({ where: { projectId } }),
      this.prisma.codeRepository.deleteMany({ where: { projectId } }),
    ]);

    // Memgraph mirror only after the Postgres tx committed. Best-effort.
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

    const node = await this.prisma.architectureNode.create({
      data: {
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
      },
    });

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

    const updated = await this.prisma.architectureNode.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        domainGroup: dto.domainGroup,
        ownerUserId: dto.ownerUserId,
        ownerTeamId: dto.ownerTeamId,
      },
    });

    // Mirror updated state into Memgraph (CF-GDB-03a-1). Best-effort:
    // a sync failure here must not fail the user PATCH.
    await this.sync.upsertNode({
      id: updated.id,
      projectId: updated.projectId,
      type: updated.type,
      name: updated.name,
      path: updated.path,
      domainGroup: updated.domainGroup,
    });

    return updated;
  }


  async deleteNode(id: string): Promise<unknown> {

    const node = await this.getNode(id) as { isManual: boolean; projectId: string };

    if (!node.isManual) {
      throw new Error('Cannot delete auto-generated nodes; set isCurrent=false via rescan');
    }

    const deleted = await this.prisma.architectureNode.delete({ where: { id } });
    // Pass projectId so the Memgraph delete is multi-tenant scoped (CF-GDB-03a-3).
    await this.sync.deleteNode(id, node.projectId);
    return deleted;
  }


  // ── Edges ────────────────────────────────────────────

  async createEdge(projectId: string, dto: CreateEdgeDto): Promise<unknown> {

    const edge = await this.prisma.architectureEdge.create({
      data: {
        projectId,
        fromNodeId: dto.fromNodeId,
        toNodeId: dto.toNodeId,
        edgeType: dto.edgeType,
        weight: dto.weight ?? 1.0,
        isManual: dto.isManual ?? true,
      },
    });

    await this.sync.upsertEdge({
      id: edge.id,
      projectId: edge.projectId,
      fromNodeId: edge.fromNodeId,
      toNodeId: edge.toNodeId,
      edgeType: edge.edgeType,
      weight: edge.weight,
    });

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

    const deleted = await this.prisma.architectureEdge.delete({ where: { id } });
    // Pass projectId so the Memgraph delete is multi-tenant scoped (CF-GDB-03a-3).
    await this.sync.deleteEdge(id, edge.projectId);
    return deleted;
  }


  // ── Links ────────────────────────────────────────────

  async createLink(nodeId: string, projectId: string, dto: CreateLinkDto, createdByUserId: string) {

    await this.getNode(nodeId);

    return this.prisma.architectureLink.create({
      data: {
        nodeId,
        projectId,
        entityType: dto.entityType,
        entityId: dto.entityId,
        linkType: dto.linkType,
        createdByUserId,
        note: dto.note,
      },
    });
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

    return this.prisma.architectureLink.delete({ where: { id } });
  }


  // ── Annotations ──────────────────────────────────────

  async createAnnotation(nodeId: string, projectId: string, dto: CreateAnnotationDto, createdByUserId: string) {

    await this.getNode(nodeId);

    return this.prisma.architectureAnnotation.create({
      data: {
        nodeId,
        projectId,
        content: dto.content,
        createdByUserId,
      },
    });
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
