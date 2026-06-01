import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { Prisma, PrismaClient } from '@roadboard/database';
import { optionalEnv } from '@roadboard/config';
import { GraphDbClient, labelFromType } from '@roadboard/graph-db';

import type { AuthUser } from '../../common/auth-user';
import { AuditService } from '../audit/audit.service';
import { CreateNodeDto } from './dto/create-node.dto';
import { UpdateNodeDto } from './dto/update-node.dto';
import { CreateEdgeDto } from './dto/create-edge.dto';
import { CreateLinkDto } from './dto/create-link.dto';
import { CreateAnnotationDto } from './dto/create-annotation.dto';
import { GraphSyncService } from './graph-sync.service';


/**
 * Safely parse a JSON string. Mirror writes store node `metadata` as a JSON
 * string (Memgraph properties accept primitives/strings only). Returns the
 * original value if it cannot be parsed.
 */
function safeJsonParse(value: string): unknown {

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}


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

  private readonly logger = new Logger(GraphService.name);
  private readonly useOutbox: boolean;
  private readonly useMemgraphImpact: boolean;
  private readonly useMemgraphNode: boolean;
  private readonly useMemgraphGraph: boolean;
  private readonly useMemgraphSnapshot: boolean;
  private readonly useMemgraphWrite: boolean;

  constructor(
    @Inject('PRISMA') private readonly prisma: PrismaClient,
    @Inject(GraphSyncService) private readonly sync: GraphSyncService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Optional() @Inject('GRAPH_DB_CLIENT') private readonly graph?: GraphDbClient,
  ) {

    this.useOutbox = optionalEnv('GRAPH_SYNC_USE_OUTBOX', 'false') === 'true';
    this.useMemgraphImpact = optionalEnv('GRAPH_READ_USE_MEMGRAPH_IMPACT', 'false') === 'true';
    this.useMemgraphNode = optionalEnv('GRAPH_READ_USE_MEMGRAPH_NODE', 'false') === 'true';
    this.useMemgraphGraph = optionalEnv('GRAPH_READ_USE_MEMGRAPH_GRAPH', 'false') === 'true';
    this.useMemgraphSnapshot = optionalEnv('GRAPH_READ_USE_MEMGRAPH_SNAPSHOT', 'false') === 'true';
    this.useMemgraphWrite = optionalEnv('GRAPH_WRITE_USE_MEMGRAPH', 'false') === 'true';
  }


  isOutboxMode(): boolean {
    return this.useOutbox;
  }


  isMemgraphImpactMode(): boolean {
    return this.useMemgraphImpact;
  }


  isMemgraphNodeMode(): boolean {
    return this.useMemgraphNode;
  }


  isMemgraphGraphMode(): boolean {
    return this.useMemgraphGraph;
  }


  isMemgraphSnapshotMode(): boolean {
    return this.useMemgraphSnapshot;
  }


  isMemgraphWriteMode(): boolean {
    return this.useMemgraphWrite;
  }


  /**
   * Returns the Memgraph client or throws when the write flag is ON but no
   * client was injected. Fail-closed: a misconfigured write path must error
   * rather than silently fall back to Postgres.
   */
  private requireGraph(): GraphDbClient {

    if (!this.graph) {
      throw new Error('GRAPH_WRITE_USE_MEMGRAPH is enabled but GraphDbClient is not available');
    }

    return this.graph;
  }


  /**
   * Outbox health snapshot for the admin dashboard (CF-GDB-03b-8).
   * Returns aggregate counts of graph_sync_events plus the timestamp of
   * the oldest pending event (most recent issue indicator).
   */
  async getOutboxStats(): Promise<{
    enabled: boolean;
    pending: number;
    inProgress: number;
    dead: number;
    pendingOldestAt: string | null;
    doneLast1h: number;
    doneLast24h: number;
  }> {

    const now = Date.now();
    const oneHourAgo = new Date(now - 60 * 60 * 1000);
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);

    const [pending, inProgress, dead, oldest, doneLast1h, doneLast24h] = await Promise.all([
      this.prisma.graphSyncEvent.count({ where: { status: 'pending' } }),
      this.prisma.graphSyncEvent.count({ where: { status: 'in_progress' } }),
      this.prisma.graphSyncEvent.count({ where: { status: 'dead' } }),
      this.prisma.graphSyncEvent.findFirst({
        where: { status: 'pending' },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
      this.prisma.graphSyncEvent.count({
        where: { status: 'done', processedAt: { gte: oneHourAgo } },
      }),
      this.prisma.graphSyncEvent.count({
        where: { status: 'done', processedAt: { gte: oneDayAgo } },
      }),
    ]);

    return {
      enabled: this.useOutbox,
      pending,
      inProgress,
      dead,
      pendingOldestAt: oldest?.createdAt.toISOString() ?? null,
      doneLast1h,
      doneLast24h,
    };
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

    if (this.useMemgraphWrite) {
      // Decision 2/3: graph entities (node/edge/link/annotation/snapshot mirror)
      // are deleted from Memgraph with EXACT pre-delete counts, while the
      // non-graph relational table `codeRepository` is still cleaned up in
      // Postgres exactly as before.
      const result = await this.resetProjectInMemgraph(projectId);
      await this.prisma.codeRepository.deleteMany({ where: { projectId } });

      return result;
    }

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

    if (this.useMemgraphGraph && this.graph) {

      try {
        return await this.getGraphFromMemgraph(projectId);
      } catch (err) {
        this.logger.warn({
          op: 'getGraph',
          source: 'memgraph',
          projectId,
          error: err instanceof Error ? err.message : String(err),
        });
        // Fall through to Postgres path.
      }
    }

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


  /**
   * Memgraph-backed getGraph (CF-GDB-03b-C).
   *
   * Reads current nodes + outgoing edges from Memgraph along with aggregate
   * counts (linked tasks, decisions, annotations). The snapshot metadata
   * (snapshotId/status/lastScannedAt) still comes from Postgres until the
   * snapshot table is retired in Phase 2.
   */
  private async getGraphFromMemgraph(projectId: string): Promise<unknown> {

    if (!this.graph) {
      throw new Error('GraphDbClient not available');
    }

    const nodesCypher = `MATCH (n {projectId: $projectId})
WHERE NOT n:Link AND NOT n:Annotation
  AND (n.isCurrent IS NULL OR n.isCurrent = true)
OPTIONAL MATCH (lTask:Link {entityType: 'task'})-[:LINKED_TO]->(n)
WITH n, count(DISTINCT lTask) AS taskCount
OPTIONAL MATCH (lDec:Link {entityType: 'decision'})-[:LINKED_TO]->(n)
WITH n, taskCount, count(DISTINCT lDec) AS decisionCount
OPTIONAL MATCH (a:Annotation)-[:ANNOTATES]->(n)
WITH n, taskCount, decisionCount, count(DISTINCT a) AS annotationCount
RETURN n.id AS id,
       n.type AS type,
       n.name AS name,
       n.path AS path,
       n.domainGroup AS domainGroup,
       n.isManual AS isManual,
       n.ownerUserId AS ownerUserId,
       n.ownerTeamId AS ownerTeamId,
       n.metadata AS metadata,
       taskCount,
       decisionCount,
       annotationCount
ORDER BY id`;

    const edgesCypher = `MATCH (a {projectId: $projectId})-[r]->(b {projectId: $projectId})
WHERE type(r) <> 'LINKED_TO' AND type(r) <> 'ANNOTATES'
  AND r.id IS NOT NULL
  AND (a.isCurrent IS NULL OR a.isCurrent = true)
  AND (b.isCurrent IS NULL OR b.isCurrent = true)
RETURN r.id AS id,
       a.id AS fromNodeId,
       b.id AS toNodeId,
       coalesce(r.edgeType, toLower(type(r))) AS edgeType,
       coalesce(r.weight, 1.0) AS weight,
       coalesce(r.isManual, false) AS isManual
ORDER BY id`;

    const [nodeRecords, edgeRecords, latestSnapshot] = await Promise.all([
      this.graph.run<{
        id: string;
        type: string | null;
        name: string | null;
        path: string | null;
        domainGroup: string | null;
        isManual: boolean | null;
        ownerUserId: string | null;
        ownerTeamId: string | null;
        metadata: unknown;
        taskCount: number;
        decisionCount: number;
        annotationCount: number;
      }>(nodesCypher, { projectId }, { mode: 'read' }),
      this.graph.run<{
        id: string;
        fromNodeId: string;
        toNodeId: string;
        edgeType: string;
        weight: number;
        isManual: boolean;
      }>(edgesCypher, { projectId }, { mode: 'read' }),
      this.prisma.architectureSnapshot.findFirst({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      snapshotId: latestSnapshot?.id ?? null,
      snapshotStatus: latestSnapshot?.status ?? null,
      lastScannedAt: latestSnapshot?.completedAt ?? null,
      nodes: nodeRecords.map((n) => ({
        id: n.id,
        type: n.type ?? '',
        name: n.name ?? n.id,
        path: n.path,
        domainGroup: n.domainGroup,
        isManual: n.isManual ?? false,
        ownerUserId: n.ownerUserId,
        ownerTeamId: n.ownerTeamId,
        openTaskCount: Number(n.taskCount ?? 0),
        decisionCount: Number(n.decisionCount ?? 0),
        annotationCount: Number(n.annotationCount ?? 0),
        metadata: typeof n.metadata === 'string' ? safeJsonParse(n.metadata) : n.metadata ?? null,
      })),
      edges: edgeRecords.map((e) => ({
        id: e.id,
        fromNodeId: e.fromNodeId,
        toNodeId: e.toNodeId,
        edgeType: e.edgeType,
        weight: Number(e.weight ?? 1),
        isManual: Boolean(e.isManual),
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

  async createNode(projectId: string, dto: CreateNodeDto, user: AuthUser): Promise<unknown> {

    if (this.useMemgraphWrite) {
      const node = await this.createNodeInMemgraph(projectId, dto);

      await this.audit.recordForUser(user, 'node.created', 'architecture_node', node.id, node.projectId, {
        type: node.type,
        name: node.name,
        path: node.path,
      });

      return node;
    }

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

    let node: Awaited<ReturnType<typeof this.prisma.architectureNode.create>>;

    if (this.useOutbox) {
      node = await this.prisma.$transaction(async (tx) => {
        const created = await tx.architectureNode.create({ data });
        await tx.graphSyncEvent.create({
          data: {
            projectId: created.projectId,
            entityType: 'node',
            entityId: created.id,
            op: 'upsert',
            payload: this.nodeProjection(created) as Prisma.InputJsonValue,
          },
        });
        return created;
      });
    } else {
      node = await this.prisma.architectureNode.create({ data });
      await this.sync.upsertNode(this.nodeProjection(node) as Parameters<typeof this.sync.upsertNode>[0]);
    }

    await this.audit.recordForUser(user, 'node.created', 'architecture_node', node.id, node.projectId, {
      type: node.type,
      name: node.name,
      path: node.path,
    });

    return node;
  }


  private nodeProjection(node: {
    id: string; projectId: string; type: string; name: string;
    path: string | null; domainGroup: string | null;
    description?: string | null;
    metadata?: unknown;
    ownerUserId?: string | null;
    ownerTeamId?: string | null;
    isManual?: boolean | null;
    isCurrent?: boolean | null;
  }): Record<string, unknown> {
    return {
      id: node.id, projectId: node.projectId, type: node.type, name: node.name,
      path: node.path, domainGroup: node.domainGroup,
      description: node.description ?? null,
      metadata: node.metadata ?? null,
      ownerUserId: node.ownerUserId ?? null,
      ownerTeamId: node.ownerTeamId ?? null,
      isManual: node.isManual ?? null,
      isCurrent: node.isCurrent ?? null,
    };
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


  // ── Memgraph-direct write helpers (CF-GDB-03b-D) ─────
  //
  // These run when GRAPH_WRITE_USE_MEMGRAPH is ON. Unlike GraphSyncService
  // (best-effort mirror), they are fail-closed: errors propagate so the
  // write API fails instead of reporting a fake success. Memgraph does not
  // generate ids/timestamps/defaults, so each create* helper materialises
  // them explicitly to keep the REST response shape identical to Prisma.

  /**
   * Generates a fresh entity id. Postgres uses Prisma `@default(cuid())`,
   * generated engine-side; no JS cuid generator is bundled, so we use an
   * opaque randomUUID — the id is never parsed by clients.
   */
  private newId(): string {
    return randomUUID();
  }


  private async createNodeInMemgraph(projectId: string, dto: CreateNodeDto): Promise<{
    id: string; projectId: string; repositoryId: string; snapshotId: string | null;
    domainGroupId: string | null; type: string; name: string; path: string | null;
    description: string | null; domainGroup: string | null; isManual: boolean;
    isCurrent: boolean; metadata: Record<string, unknown>; ownerUserId: string | null;
    ownerTeamId: string | null; createdAt: Date; updatedAt: Date;
  }> {

    const graph = this.requireGraph();
    const now = new Date();

    const node = {
      id: this.newId(),
      projectId,
      repositoryId: dto.repositoryId,
      snapshotId: null,
      domainGroupId: null,
      type: dto.type,
      name: dto.name,
      path: dto.path ?? null,
      description: dto.description ?? null,
      domainGroup: dto.domainGroup ?? null,
      isManual: dto.isManual ?? true,
      isCurrent: true,
      metadata: {} as Record<string, unknown>,
      ownerUserId: dto.ownerUserId ?? null,
      ownerTeamId: dto.ownerTeamId ?? null,
      createdAt: now,
      updatedAt: now,
    };

    const label = labelFromType(node.type);

    await graph.run(
      `MERGE (n:${label} {id: $id})
       SET n.projectId = $projectId,
           n.type = $type,
           n.name = $name,
           n.path = $path,
           n.domainGroup = $domainGroup,
           n.description = $description,
           n.metadata = $metadata,
           n.ownerUserId = $ownerUserId,
           n.ownerTeamId = $ownerTeamId,
           n.isManual = $isManual,
           n.isCurrent = $isCurrent,
           n.createdAt = $createdAt,
           n.updatedAt = $updatedAt`,
      {
        id: node.id,
        projectId: node.projectId,
        type: node.type,
        name: node.name,
        path: node.path,
        domainGroup: node.domainGroup,
        description: node.description,
        metadata: JSON.stringify(node.metadata),
        ownerUserId: node.ownerUserId,
        ownerTeamId: node.ownerTeamId,
        isManual: node.isManual,
        isCurrent: node.isCurrent,
        createdAt: node.createdAt.toISOString(),
        updatedAt: node.updatedAt.toISOString(),
      },
      { mode: 'write' },
    );

    return node;
  }


  private async updateNodeInMemgraph(
    id: string,
    data: Record<string, unknown>,
  ): Promise<{
    id: string; projectId: string; type: string | null; name: string | null;
    path: string | null; domainGroup: string | null; description: string | null;
    metadata: unknown; ownerUserId: string | null; ownerTeamId: string | null;
    isManual: boolean | null; isCurrent: boolean | null; updatedAt: string;
  }> {

    const graph = this.requireGraph();

    const records = await graph.run<{
      id: string; projectId: string; type: string | null; name: string | null;
      path: string | null; domainGroup: string | null; description: string | null;
      metadata: unknown; ownerUserId: string | null; ownerTeamId: string | null;
      isManual: boolean | null; isCurrent: boolean | null; updatedAt: string;
    }>(
      `MATCH (n {id: $id})
       WHERE NOT n:Link AND NOT n:Annotation
       SET n.name = coalesce($name, n.name),
           n.description = $description,
           n.domainGroup = $domainGroup,
           n.ownerUserId = $ownerUserId,
           n.ownerTeamId = $ownerTeamId,
           n.updatedAt = $updatedAt
       RETURN n.id AS id,
              n.projectId AS projectId,
              n.type AS type,
              n.name AS name,
              n.path AS path,
              n.domainGroup AS domainGroup,
              n.description AS description,
              n.metadata AS metadata,
              n.ownerUserId AS ownerUserId,
              n.ownerTeamId AS ownerTeamId,
              n.isManual AS isManual,
              n.isCurrent AS isCurrent,
              n.updatedAt AS updatedAt`,
      {
        id,
        name: (data['name'] as string | undefined) ?? null,
        description: (data['description'] as string | null | undefined) ?? null,
        domainGroup: (data['domainGroup'] as string | null | undefined) ?? null,
        ownerUserId: (data['ownerUserId'] as string | null | undefined) ?? null,
        ownerTeamId: (data['ownerTeamId'] as string | null | undefined) ?? null,
        updatedAt: new Date().toISOString(),
      },
      { mode: 'write' },
    );

    if (records.length === 0) {
      throw new NotFoundException(`ArchitectureNode ${id} not found`);
    }

    return records[0];
  }


  private async deleteNodeInMemgraph(id: string, projectId: string): Promise<void> {

    const graph = this.requireGraph();

    await graph.run(
      'MATCH (n {id: $id, projectId: $pid}) DETACH DELETE n',
      { id, pid: projectId },
      { mode: 'write' },
    );
  }


  private async createEdgeInMemgraph(projectId: string, dto: CreateEdgeDto): Promise<{
    id: string; projectId: string; snapshotId: string | null; fromNodeId: string;
    toNodeId: string; edgeType: string; weight: number; isManual: boolean;
    isCurrent: boolean; metadata: Record<string, unknown>; createdAt: Date;
  }> {

    const graph = this.requireGraph();

    const edge = {
      id: this.newId(),
      projectId,
      snapshotId: null,
      fromNodeId: dto.fromNodeId,
      toNodeId: dto.toNodeId,
      edgeType: dto.edgeType,
      weight: dto.weight ?? 1.0,
      isManual: dto.isManual ?? true,
      isCurrent: true,
      metadata: {} as Record<string, unknown>,
      createdAt: new Date(),
    };

    const relType = edge.edgeType.toUpperCase();

    // Existence check (Decision 7): a MERGE that matches no node creates zero
    // relationships silently. We MATCH both nodes, count the created/matched
    // relationship, and raise NotFoundException when either endpoint is absent
    // — preserving the FK-violation semantics of the Prisma path.
    const records = await graph.run<{ created: number }>(
      `MATCH (a {id: $fromId}), (b {id: $toId})
       MERGE (a)-[r:${relType} {id: $id}]->(b)
       SET r.projectId = $projectId,
           r.weight = $weight,
           r.edgeType = $edgeType,
           r.isManual = $isManual,
           r.isCurrent = $isCurrent,
           r.createdAt = $createdAt
       RETURN count(r) AS created`,
      {
        id: edge.id,
        fromId: edge.fromNodeId,
        toId: edge.toNodeId,
        projectId: edge.projectId,
        weight: edge.weight,
        edgeType: edge.edgeType,
        isManual: edge.isManual,
        isCurrent: edge.isCurrent,
        createdAt: edge.createdAt.toISOString(),
      },
      { mode: 'write' },
    );

    const created = records.length > 0 ? Number(records[0].created) : 0;

    if (created === 0) {
      throw new NotFoundException(
        `ArchitectureEdge endpoints not found: fromNodeId=${edge.fromNodeId}, toNodeId=${edge.toNodeId}`,
      );
    }

    return edge;
  }


  /**
   * Reads an edge from Memgraph for the delete guard/audit metadata path.
   * Returns null when the relationship does not exist (caller raises 404).
   */
  private async getEdgeFromMemgraph(id: string): Promise<{
    id: string; projectId: string; fromNodeId: string; toNodeId: string;
    edgeType: string; isManual: boolean;
  } | null> {

    const graph = this.requireGraph();

    const records = await graph.run<{
      id: string; projectId: string; fromNodeId: string; toNodeId: string;
      edgeType: string; isManual: boolean | null;
    }>(
      `MATCH (a)-[r {id: $id}]->(b)
       RETURN r.id AS id,
              r.projectId AS projectId,
              a.id AS fromNodeId,
              b.id AS toNodeId,
              coalesce(r.edgeType, toLower(type(r))) AS edgeType,
              coalesce(r.isManual, false) AS isManual
       LIMIT 1`,
      { id },
      { mode: 'read' },
    );

    if (records.length === 0) return null;

    const r = records[0];

    return {
      id: r.id,
      projectId: r.projectId,
      fromNodeId: r.fromNodeId,
      toNodeId: r.toNodeId,
      edgeType: r.edgeType,
      isManual: Boolean(r.isManual),
    };
  }


  private async deleteEdgeInMemgraph(id: string, projectId: string): Promise<void> {

    const graph = this.requireGraph();

    await graph.run(
      'MATCH ()-[r {id: $id, projectId: $pid}]->() DELETE r',
      { id, pid: projectId },
      { mode: 'write' },
    );
  }


  private async createLinkInMemgraph(
    nodeId: string,
    projectId: string,
    dto: CreateLinkDto,
    user: AuthUser,
  ): Promise<{
    id: string; nodeId: string; projectId: string; entityType: string;
    entityId: string; linkType: string; createdByUserId: string;
    note: string | null; createdAt: Date;
  }> {

    const graph = this.requireGraph();

    const link = {
      id: this.newId(),
      nodeId,
      projectId,
      entityType: dto.entityType,
      entityId: dto.entityId,
      linkType: dto.linkType,
      createdByUserId: user.userId,
      note: dto.note ?? null,
      createdAt: new Date(),
    };

    await graph.run(
      `MERGE (l:Link {id: $id})
       SET l.projectId = $projectId,
           l.nodeId = $nodeId,
           l.entityType = $entityType,
           l.entityId = $entityId,
           l.linkType = $linkType,
           l.note = $note,
           l.createdByUserId = $createdByUserId,
           l.createdAt = $createdAt
       WITH l
       MATCH (n {id: $nodeId, projectId: $projectId})
       MERGE (l)-[:LINKED_TO]->(n)`,
      {
        id: link.id,
        projectId: link.projectId,
        nodeId: link.nodeId,
        entityType: link.entityType,
        entityId: link.entityId,
        linkType: link.linkType,
        note: link.note,
        createdByUserId: link.createdByUserId,
        createdAt: link.createdAt.toISOString(),
      },
      { mode: 'write' },
    );

    return link;
  }


  /**
   * Reads a link from Memgraph for the delete guard/audit metadata path.
   * Returns null when the link node does not exist (caller raises 404).
   */
  private async getLinkFromMemgraph(id: string): Promise<{
    id: string; projectId: string; nodeId: string; entityType: string;
    entityId: string; linkType: string;
  } | null> {

    const graph = this.requireGraph();

    const records = await graph.run<{
      id: string; projectId: string; nodeId: string; entityType: string;
      entityId: string; linkType: string;
    }>(
      `MATCH (l:Link {id: $id})
       RETURN l.id AS id,
              l.projectId AS projectId,
              l.nodeId AS nodeId,
              l.entityType AS entityType,
              l.entityId AS entityId,
              l.linkType AS linkType
       LIMIT 1`,
      { id },
      { mode: 'read' },
    );

    return records.length > 0 ? records[0] : null;
  }


  private async deleteLinkInMemgraph(id: string, projectId: string): Promise<void> {

    const graph = this.requireGraph();

    await graph.run(
      'MATCH (l:Link {id: $id, projectId: $pid}) DETACH DELETE l',
      { id, pid: projectId },
      { mode: 'write' },
    );
  }


  private async createAnnotationInMemgraph(
    nodeId: string,
    projectId: string,
    dto: CreateAnnotationDto,
    user: AuthUser,
  ): Promise<{
    id: string; nodeId: string; projectId: string; content: string;
    createdByUserId: string; createdAt: Date; updatedAt: Date;
  }> {

    const graph = this.requireGraph();
    const now = new Date();

    const ann = {
      id: this.newId(),
      nodeId,
      projectId,
      content: dto.content,
      createdByUserId: user.userId,
      createdAt: now,
      updatedAt: now,
    };

    await graph.run(
      `MERGE (a:Annotation {id: $id})
       SET a.projectId = $projectId,
           a.nodeId = $nodeId,
           a.content = $content,
           a.createdByUserId = $createdByUserId,
           a.createdAt = $createdAt,
           a.updatedAt = $updatedAt
       WITH a
       MATCH (n {id: $nodeId, projectId: $projectId})
       MERGE (a)-[:ANNOTATES]->(n)`,
      {
        id: ann.id,
        projectId: ann.projectId,
        nodeId: ann.nodeId,
        content: ann.content,
        createdByUserId: ann.createdByUserId,
        createdAt: ann.createdAt.toISOString(),
        updatedAt: ann.updatedAt.toISOString(),
      },
      { mode: 'write' },
    );

    return ann;
  }


  private async resetProjectInMemgraph(
    projectId: string,
  ): Promise<{ deletedNodes: number; deletedEdges: number }> {

    const graph = this.requireGraph();

    // Count graph entities BEFORE deleting so the response matches the
    // Prisma path (Decision 3): nodes exclude Link/Annotation mirror nodes;
    // edges exclude LINKED_TO/ANNOTATES mirror relationships.
    const countRecords = await graph.run<{ nodeCount: number; edgeCount: number }>(
      `OPTIONAL MATCH (n {projectId: $pid})
       WHERE NOT n:Link AND NOT n:Annotation
       WITH count(DISTINCT n) AS nodeCount
       OPTIONAL MATCH (a {projectId: $pid})-[r]->(b {projectId: $pid})
       WHERE type(r) <> 'LINKED_TO' AND type(r) <> 'ANNOTATES'
         AND r.id IS NOT NULL
       RETURN nodeCount, count(DISTINCT r) AS edgeCount`,
      { pid: projectId },
      { mode: 'read' },
    );

    const deletedNodes = countRecords.length > 0 ? Number(countRecords[0].nodeCount) : 0;
    const deletedEdges = countRecords.length > 0 ? Number(countRecords[0].edgeCount) : 0;

    await graph.run(
      'MATCH (n {projectId: $pid}) DETACH DELETE n',
      { pid: projectId },
      { mode: 'write' },
    );

    return { deletedNodes, deletedEdges };
  }


  async getNode(id: string): Promise<unknown> {

    if (this.useMemgraphNode && this.graph) {

      try {
        const fromMg = await this.getNodeFromMemgraph(id);

        if (fromMg) return fromMg;
        // Node not found in Memgraph — fall through to Postgres which will
        // either return the node (drift) or raise NotFoundException.
      } catch (err) {
        this.logger.warn({
          op: 'getNode',
          source: 'memgraph',
          nodeId: id,
          error: err instanceof Error ? err.message : String(err),
        });
        // Fall through to Postgres path.
      }
    }

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


  /**
   * Memgraph-backed getNode (CF-GDB-03b-C).
   *
   * Reads the node + its outgoing Link/Annotation mirror entities. Mirror
   * relationships from GraphSyncService:
   *   - (l:Link)-[:LINKED_TO]->(n)
   *   - (a:Annotation)-[:ANNOTATES]->(n)
   *
   * Returns null if the node does not exist in Memgraph (caller falls back
   * to Postgres). Shape matches the Prisma `findUnique({ include })` result
   * so the REST contract is unchanged.
   */
  private async getNodeFromMemgraph(id: string): Promise<Record<string, unknown> | null> {

    if (!this.graph) {
      throw new Error('GraphDbClient not available');
    }

    // Use explicit projections — RETURN n gives a Neo4j Node object (properties
    // under .properties), not a plain record, so { ...n } would lose all fields.
    // collect({...}) in WITH is supported; list comprehensions are not in Memgraph 2.18.
    const cypher = `MATCH (n {id: $id})
WHERE NOT n:Link AND NOT n:Annotation
OPTIONAL MATCH (l:Link)-[:LINKED_TO]->(n)
WITH n,
  collect(DISTINCT {
    id: l.id, projectId: l.projectId, nodeId: l.nodeId,
    entityType: l.entityType, entityId: l.entityId,
    linkType: l.linkType, note: l.note
  }) AS links
OPTIONAL MATCH (a:Annotation)-[:ANNOTATES]->(n)
WITH n, links,
  collect(DISTINCT {
    id: a.id, projectId: a.projectId, nodeId: a.nodeId, content: a.content
  }) AS annotations
RETURN
  n.id AS id,
  n.projectId AS projectId,
  n.type AS type,
  n.name AS name,
  n.path AS path,
  n.domainGroup AS domainGroup,
  n.description AS description,
  n.metadata AS metadata,
  n.ownerUserId AS ownerUserId,
  n.ownerTeamId AS ownerTeamId,
  n.isManual AS isManual,
  n.isCurrent AS isCurrent,
  links,
  annotations
LIMIT 1`;

    const records = await this.graph.run<Record<string, unknown>>(
      cypher, { id }, { mode: 'read' },
    );

    if (records.length === 0 || !records[0].id) return null;

    return records[0];
  }


  async updateNode(id: string, dto: UpdateNodeDto, user: AuthUser): Promise<unknown> {

    const existing = await this.getNode(id) as {
      id: string; projectId: string; name: string;
      description: string | null; domainGroup: string | null;
      ownerUserId: string | null; ownerTeamId: string | null;
      domainGroupId?: string | null;
    };

    const data: Record<string, unknown> = {
      name: dto.name,
      description: dto.description,
      domainGroup: dto.domainGroup,
      ownerUserId: dto.ownerUserId,
      ownerTeamId: dto.ownerTeamId,
    };

    if ('domainGroupId' in dto) {
      data['domainGroupId'] = dto.domainGroupId ?? null;
    }

    let updated: { id: string; projectId: string };

    if (this.useMemgraphWrite) {
      updated = await this.updateNodeInMemgraph(id, data) as { id: string; projectId: string };
    } else if (this.useOutbox) {
      updated = await this.prisma.$transaction(async (tx) => {
        const u = await tx.architectureNode.update({ where: { id }, data });
        await tx.graphSyncEvent.create({
          data: {
            projectId: u.projectId,
            entityType: 'node',
            entityId: u.id,
            op: 'upsert',
            payload: this.nodeProjection(u) as Prisma.InputJsonValue,
          },
        });
        return u;
      });
    } else {
      const u = await this.prisma.architectureNode.update({ where: { id }, data });
      await this.sync.upsertNode(this.nodeProjection(u) as Parameters<typeof this.sync.upsertNode>[0]);
      updated = u;
    }

    const changedFields: Record<string, { from: unknown; to: unknown }> = {};
    const trackedKeys = ['name', 'description', 'domainGroup', 'ownerUserId', 'ownerTeamId', 'domainGroupId'] as const;

    for (const key of trackedKeys) {

      if (key in dto) {
        const before = (existing as Record<string, unknown>)[key] ?? null;
        const after = (dto as Record<string, unknown>)[key] ?? null;

        if (before !== after) {
          changedFields[key] = { from: before, to: after };
        }
      }
    }

    if (Object.keys(changedFields).length > 0) {
      await this.audit.recordForUser(user, 'node.updated', 'architecture_node', updated.id, updated.projectId, {
        changed: changedFields,
      });
    }

    return updated;
  }


  async deleteNode(id: string, user: AuthUser): Promise<unknown> {

    const node = await this.getNode(id) as { id: string; isManual: boolean; projectId: string; name: string; type: string };

    if (!node.isManual) {
      throw new Error('Cannot delete auto-generated nodes; set isCurrent=false via rescan');
    }

    let deleted: unknown;

    if (this.useMemgraphWrite) {
      await this.deleteNodeInMemgraph(id, node.projectId);
      deleted = { id: node.id, projectId: node.projectId };
    } else if (this.useOutbox) {
      deleted = await this.prisma.$transaction(async (tx) => {
        const d = await tx.architectureNode.delete({ where: { id } });
        await tx.graphSyncEvent.create({
          data: {
            projectId: node.projectId,
            entityType: 'node',
            entityId: id,
            op: 'delete',
            payload: { id, projectId: node.projectId },
          },
        });
        return d;
      });
    } else {
      deleted = await this.prisma.architectureNode.delete({ where: { id } });
      await this.sync.deleteNode(id, node.projectId);
    }

    await this.audit.recordForUser(user, 'node.deleted', 'architecture_node', node.id, node.projectId, {
      name: node.name,
      type: node.type,
    });

    return deleted;
  }


  // ── Edges ────────────────────────────────────────────

  async createEdge(projectId: string, dto: CreateEdgeDto, user: AuthUser): Promise<unknown> {

    if (this.useMemgraphWrite) {
      const edge = await this.createEdgeInMemgraph(projectId, dto);

      await this.audit.recordForUser(user, 'edge.created', 'architecture_edge', edge.id, edge.projectId, {
        fromNodeId: edge.fromNodeId,
        toNodeId: edge.toNodeId,
        edgeType: edge.edgeType,
      });

      return edge;
    }

    const data = {
      projectId,
      fromNodeId: dto.fromNodeId,
      toNodeId: dto.toNodeId,
      edgeType: dto.edgeType,
      weight: dto.weight ?? 1.0,
      isManual: dto.isManual ?? true,
    };

    let edge: Awaited<ReturnType<typeof this.prisma.architectureEdge.create>>;

    if (this.useOutbox) {
      edge = await this.prisma.$transaction(async (tx) => {
        const e = await tx.architectureEdge.create({ data });
        await tx.graphSyncEvent.create({
          data: {
            projectId: e.projectId,
            entityType: 'edge',
            entityId: e.id,
            op: 'upsert',
            payload: this.edgeProjection(e),
          },
        });
        return e;
      });
    } else {
      edge = await this.prisma.architectureEdge.create({ data });
      await this.sync.upsertEdge(this.edgeProjection(edge) as Parameters<typeof this.sync.upsertEdge>[0]);
    }

    await this.audit.recordForUser(user, 'edge.created', 'architecture_edge', edge.id, edge.projectId, {
      fromNodeId: edge.fromNodeId,
      toNodeId: edge.toNodeId,
      edgeType: edge.edgeType,
    });

    return edge;
  }


  async deleteEdge(id: string, user: AuthUser): Promise<unknown> {

    const edge = this.useMemgraphWrite
      ? await this.getEdgeFromMemgraph(id)
      : await this.prisma.architectureEdge.findUnique({ where: { id } });

    if (!edge) {
      throw new NotFoundException(`ArchitectureEdge ${id} not found`);
    }

    if (!edge.isManual) {
      throw new Error('Cannot delete auto-generated edges; they are replaced on rescan');
    }

    let deleted: unknown;

    if (this.useMemgraphWrite) {
      await this.deleteEdgeInMemgraph(id, edge.projectId);
      deleted = { id: edge.id, projectId: edge.projectId };
    } else if (this.useOutbox) {
      deleted = await this.prisma.$transaction(async (tx) => {
        const d = await tx.architectureEdge.delete({ where: { id } });
        await tx.graphSyncEvent.create({
          data: {
            projectId: edge.projectId,
            entityType: 'edge',
            entityId: id,
            op: 'delete',
            payload: { id, projectId: edge.projectId },
          },
        });
        return d;
      });
    } else {
      deleted = await this.prisma.architectureEdge.delete({ where: { id } });
      await this.sync.deleteEdge(id, edge.projectId);
    }

    await this.audit.recordForUser(user, 'edge.deleted', 'architecture_edge', edge.id, edge.projectId, {
      fromNodeId: edge.fromNodeId,
      toNodeId: edge.toNodeId,
      edgeType: edge.edgeType,
    });

    return deleted;
  }


  // ── Links ────────────────────────────────────────────

  async createLink(nodeId: string, projectId: string, dto: CreateLinkDto, user: AuthUser) {

    await this.getNode(nodeId);

    if (this.useMemgraphWrite) {
      const link = await this.createLinkInMemgraph(nodeId, projectId, dto, user);

      await this.audit.recordForUser(user, 'link.created', 'architecture_link', link.id, link.projectId, {
        nodeId: link.nodeId,
        entityType: link.entityType,
        entityId: link.entityId,
        linkType: link.linkType,
      });

      return link;
    }

    const data = {
      nodeId,
      projectId,
      entityType: dto.entityType,
      entityId: dto.entityId,
      linkType: dto.linkType,
      createdByUserId: user.userId,
      note: dto.note,
    };

    let link: Awaited<ReturnType<typeof this.prisma.architectureLink.create>>;

    if (this.useOutbox) {
      link = await this.prisma.$transaction(async (tx) => {
        const l = await tx.architectureLink.create({ data });
        await tx.graphSyncEvent.create({
          data: {
            projectId: l.projectId,
            entityType: 'link',
            entityId: l.id,
            op: 'upsert',
            payload: {
              id: l.id, projectId: l.projectId, nodeId: l.nodeId,
              entityType: l.entityType, entityId: l.entityId,
              linkType: l.linkType, note: l.note,
            },
          },
        });
        return l;
      });
    } else {
      link = await this.prisma.architectureLink.create({ data });
      await this.sync.upsertLink({
        id: link.id,
        projectId: link.projectId,
        nodeId: link.nodeId,
        entityType: link.entityType,
        entityId: link.entityId,
        linkType: link.linkType,
        note: link.note,
      });
    }

    await this.audit.recordForUser(user, 'link.created', 'architecture_link', link.id, link.projectId, {
      nodeId: link.nodeId,
      entityType: link.entityType,
      entityId: link.entityId,
      linkType: link.linkType,
    });

    return link;
  }


  async listLinks(nodeId: string) {

    await this.getNode(nodeId);

    return this.prisma.architectureLink.findMany({
      where: { nodeId },
      orderBy: { createdAt: 'desc' },
    });
  }


  async deleteLink(id: string, user: AuthUser) {

    const link = this.useMemgraphWrite
      ? await this.getLinkFromMemgraph(id)
      : await this.prisma.architectureLink.findUnique({ where: { id } });

    if (!link) {
      throw new NotFoundException(`ArchitectureLink ${id} not found`);
    }

    let deleted: unknown;

    if (this.useMemgraphWrite) {
      await this.deleteLinkInMemgraph(id, link.projectId);
      deleted = { id: link.id, projectId: link.projectId };
    } else if (this.useOutbox) {
      deleted = await this.prisma.$transaction(async (tx) => {
        const d = await tx.architectureLink.delete({ where: { id } });
        await tx.graphSyncEvent.create({
          data: {
            projectId: link.projectId,
            entityType: 'link',
            entityId: id,
            op: 'delete',
            payload: { id, projectId: link.projectId },
          },
        });
        return d;
      });
    } else {
      deleted = await this.prisma.architectureLink.delete({ where: { id } });
      await this.sync.deleteLink(id, link.projectId);
    }

    await this.audit.recordForUser(user, 'link.deleted', 'architecture_link', link.id, link.projectId, {
      nodeId: link.nodeId,
      entityType: link.entityType,
      entityId: link.entityId,
      linkType: link.linkType,
    });

    return deleted;
  }


  // ── Annotations ──────────────────────────────────────

  async createAnnotation(nodeId: string, projectId: string, dto: CreateAnnotationDto, user: AuthUser) {

    await this.getNode(nodeId);

    if (this.useMemgraphWrite) {
      const ann = await this.createAnnotationInMemgraph(nodeId, projectId, dto, user);

      await this.audit.recordForUser(user, 'annotation.created', 'architecture_annotation', ann.id, ann.projectId, {
        nodeId: ann.nodeId,
      });

      return ann;
    }

    const data = {
      nodeId,
      projectId,
      content: dto.content,
      createdByUserId: user.userId,
    };

    let ann: Awaited<ReturnType<typeof this.prisma.architectureAnnotation.create>>;

    if (this.useOutbox) {
      ann = await this.prisma.$transaction(async (tx) => {
        const a = await tx.architectureAnnotation.create({ data });
        await tx.graphSyncEvent.create({
          data: {
            projectId: a.projectId,
            entityType: 'annotation',
            entityId: a.id,
            op: 'upsert',
            payload: {
              id: a.id, projectId: a.projectId, nodeId: a.nodeId, content: a.content,
            },
          },
        });
        return a;
      });
    } else {
      ann = await this.prisma.architectureAnnotation.create({ data });
      await this.sync.upsertAnnotation({
        id: ann.id,
        projectId: ann.projectId,
        nodeId: ann.nodeId,
        content: ann.content,
      });
    }

    await this.audit.recordForUser(user, 'annotation.created', 'architecture_annotation', ann.id, ann.projectId, {
      nodeId: ann.nodeId,
    });

    return ann;
  }


  // ── Snapshot ─────────────────────────────────────────

  async getSnapshot(projectId: string) {

    if (this.useMemgraphSnapshot && this.graph) {

      try {
        return await this.getSnapshotFromMemgraph(projectId);
      } catch (err) {
        this.logger.warn({
          op: 'getSnapshot',
          source: 'memgraph',
          projectId,
          error: err instanceof Error ? err.message : String(err),
        });
        // Fall through to Postgres path.
      }
    }

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


  /**
   * Memgraph-backed getSnapshot (CF-GDB-03b-C).
   *
   * Returns the same shape as the Postgres version: current nodes (with
   * total link count + annotation contents), current edges, and the top-10
   * impact nodes ranked by incoming :DEPENDS_ON degree.
   */
  private async getSnapshotFromMemgraph(projectId: string): Promise<unknown> {

    if (!this.graph) {
      throw new Error('GraphDbClient not available');
    }

    const nodesCypher = `MATCH (n {projectId: $projectId})
WHERE NOT n:Link AND NOT n:Annotation
  AND (n.isCurrent IS NULL OR n.isCurrent = true)
OPTIONAL MATCH (l:Link)-[:LINKED_TO]->(n)
WITH n, count(DISTINCT l) AS linkCount
OPTIONAL MATCH (a:Annotation)-[:ANNOTATES]->(n)
WITH n, linkCount, collect(DISTINCT a.content) AS annotationContents
RETURN n.id AS id,
       n.type AS type,
       n.name AS name,
       n.path AS path,
       n.domainGroup AS domainGroup,
       linkCount,
       annotationContents
ORDER BY id`;

    const edgesCypher = `MATCH (a {projectId: $projectId})-[r]->(b {projectId: $projectId})
WHERE type(r) <> 'LINKED_TO' AND type(r) <> 'ANNOTATES'
  AND r.id IS NOT NULL
  AND (a.isCurrent IS NULL OR a.isCurrent = true)
  AND (b.isCurrent IS NULL OR b.isCurrent = true)
RETURN a.id AS fromNodeId,
       b.id AS toNodeId,
       coalesce(r.edgeType, toLower(type(r))) AS edgeType`;

    const topImpactCypher = `MATCH (target {projectId: $projectId})
WHERE NOT target:Link AND NOT target:Annotation
  AND (target.isCurrent IS NULL OR target.isCurrent = true)
OPTIONAL MATCH (src)-[:DEPENDS_ON]->(target)
WHERE src.projectId = $projectId
WITH target, count(src) AS directDependants
WHERE directDependants > 0
RETURN target.id AS nodeId,
       target.name AS name,
       directDependants
ORDER BY directDependants DESC, nodeId
LIMIT 10`;

    const [nodeRecords, edgeRecords, topImpactRecords] = await Promise.all([
      this.graph.run<{
        id: string;
        type: string | null;
        name: string | null;
        path: string | null;
        domainGroup: string | null;
        linkCount: number;
        annotationContents: string[];
      }>(nodesCypher, { projectId }, { mode: 'read' }),
      this.graph.run<{
        fromNodeId: string;
        toNodeId: string;
        edgeType: string;
      }>(edgesCypher, { projectId }, { mode: 'read' }),
      this.graph.run<{
        nodeId: string;
        name: string | null;
        directDependants: number;
      }>(topImpactCypher, { projectId }, { mode: 'read' }),
    ]);

    return {
      projectId,
      generatedAt: new Date().toISOString(),
      nodeCount: nodeRecords.length,
      edgeCount: edgeRecords.length,
      nodes: nodeRecords.map((n) => ({
        id: n.id,
        type: n.type ?? '',
        name: n.name ?? n.id,
        path: n.path,
        domainGroup: n.domainGroup,
        openTaskCount: 0,
        linkedDecisionCount: Number(n.linkCount ?? 0),
        annotations: n.annotationContents ?? [],
      })),
      edges: edgeRecords.map((e) => ({ from: e.fromNodeId, to: e.toNodeId, type: e.edgeType })),
      topImpactNodes: topImpactRecords.map((r) => ({
        nodeId: r.nodeId,
        name: r.name ?? r.nodeId,
        directDependants: Number(r.directDependants),
      })),
    };
  }


  async getSnapshotCompact(projectId: string): Promise<{
    projectId: string;
    generatedAt: string;
    nodeCount: number;
    edgeCount: number;
    summary: {
      nodesByType: Record<string, number>;
      edgesByType: Record<string, number>;
    };
    topImpactNodes: Array<{
      nodeId: string;
      name: string;
      type: string;
      directDependants: number;
    }>;
    recentAnnotations: Array<{
      nodeId: string;
      nodeName: string;
      content: string;
      createdAt: string;
    }>;
  }> {

    const [nodes, edges, annotations] = await Promise.all([
      this.prisma.architectureNode.findMany({
        where: { projectId, isCurrent: true },
        select: { id: true, type: true, name: true },
      }),
      this.prisma.architectureEdge.findMany({
        where: { projectId, isCurrent: true },
        select: { fromNodeId: true, toNodeId: true, edgeType: true },
      }),
      this.prisma.architectureAnnotation.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          nodeId: true,
          content: true,
          createdAt: true,
          node: { select: { name: true } },
        },
      }),
    ]);

    const nodesByType: Record<string, number> = {};

    for (const n of nodes) {
      nodesByType[n.type] = (nodesByType[n.type] ?? 0) + 1;
    }

    const edgesByType: Record<string, number> = {};

    for (const e of edges) {
      edgesByType[e.edgeType] = (edgesByType[e.edgeType] ?? 0) + 1;
    }

    const topImpactNodes = await this.computeTopImpactNodes(nodes, edges, projectId);

    const recentAnnotations = annotations.map((a) => ({
      nodeId: a.nodeId,
      nodeName: a.node.name,
      content: a.content,
      createdAt: a.createdAt.toISOString(),
    }));

    return {
      projectId,
      generatedAt: new Date().toISOString(),
      nodeCount: nodes.length,
      edgeCount: edges.length,
      summary: { nodesByType, edgesByType },
      topImpactNodes,
      recentAnnotations,
    };
  }


  private async computeTopImpactNodes(
    nodes: Array<{ id: string; type: string; name: string }>,
    edges: Array<{ fromNodeId: string; toNodeId: string; edgeType: string }>,
    projectId: string,
  ): Promise<Array<{ nodeId: string; name: string; type: string; directDependants: number }>> {

    if (this.graph) {

      try {
        return await this.computeTopImpactNodesFromMemgraph(projectId, nodes);
      } catch (err) {
        this.logger.warn({
          op: 'getSnapshotCompact.topImpactNodes',
          source: 'memgraph',
          projectId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return this.computeTopImpactNodesFromPrisma(nodes, edges);
  }


  private async computeTopImpactNodesFromMemgraph(
    projectId: string,
    nodes: Array<{ id: string; type: string; name: string }>,
  ): Promise<Array<{ nodeId: string; name: string; type: string; directDependants: number }>> {

    if (!this.graph) {
      throw new Error('GraphDbClient not available');
    }

    const cypher = `MATCH (target)
WHERE target.projectId = $projectId
OPTIONAL MATCH (src)-[:DEPENDS_ON]->(target)
WHERE src.projectId = $projectId
WITH target, count(src) AS directDependants
ORDER BY directDependants DESC
LIMIT 5
RETURN target.id AS nodeId, target.name AS name, target.type AS type, directDependants`;

    const records = await this.graph.run<{
      nodeId: string;
      name: string | null;
      type: string | null;
      directDependants: number;
    }>(cypher, { projectId }, { mode: 'read' });

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    return records
      .filter((r) => Number(r.directDependants) > 0)
      .map((r) => {
        const fallback = nodeMap.get(r.nodeId);

        return {
          nodeId: r.nodeId,
          name: r.name ?? fallback?.name ?? r.nodeId,
          type: r.type ?? fallback?.type ?? '',
          directDependants: Number(r.directDependants),
        };
      });
  }


  private computeTopImpactNodesFromPrisma(
    nodes: Array<{ id: string; type: string; name: string }>,
    edges: Array<{ fromNodeId: string; toNodeId: string; edgeType: string }>,
  ): Array<{ nodeId: string; name: string; type: string; directDependants: number }> {

    const impactMap: Record<string, number> = {};

    for (const edge of edges) {

      if (edge.edgeType === 'depends_on') {
        impactMap[edge.toNodeId] = (impactMap[edge.toNodeId] ?? 0) + 1;
      }
    }

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    return Object.entries(impactMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([nodeId, directDependants]) => {
        const node = nodeMap.get(nodeId);

        return {
          nodeId,
          name: node?.name ?? nodeId,
          type: node?.type ?? '',
          directDependants,
        };
      });
  }


  // ── Impact ───────────────────────────────────────────

  /**
   * Precomputes blast-radius for every current node in the project and writes
   * the results atomically into `ImpactAnalysis` (one row per trigger node).
   *
   * Atomicity guarantee: DELETE all existing rows for the project + INSERT new
   * set happen inside a single Prisma interactive transaction. A crash between
   * the two operations leaves the table in a clean state (all old rows intact
   * or all new rows committed — never a mix of old and new).
   *
   * Idempotent: calling refreshImpact() N times in a row for the same project
   * always produces the same final row count (= number of current nodes) with
   * no orphan triggerNodeId values.
   */
  async refreshImpact(projectId: string, snapshotId: string): Promise<{ upsertedRows: number }> {

    const [nodes, edges] = await Promise.all([
      this.prisma.architectureNode.findMany({
        where: { projectId, isCurrent: true },
        select: { id: true },
      }),
      this.prisma.architectureEdge.findMany({
        where: { projectId, isCurrent: true, edgeType: 'depends_on' },
        select: { fromNodeId: true, toNodeId: true },
      }),
    ]);

    // Build reverse adjacency list once (shared across all BFS traversals)
    const reverseDeps: Record<string, string[]> = {};

    for (const edge of edges) {
      (reverseDeps[edge.toNodeId] ??= []).push(edge.fromNodeId);
    }

    const nodeIds = new Set(nodes.map((n) => n.id));

    const rows = nodes.map((node) => {
      const direct: string[] = reverseDeps[node.id] ?? [];
      const visited = new Set<string>([node.id, ...direct]);
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

      return {
        projectId,
        snapshotId,
        triggerNodeId: node.id,
        directNodeIds: direct.filter((id) => nodeIds.has(id)),
        indirectNodeIds: indirect.filter((id) => nodeIds.has(id)),
        remoteNodeIds: remote.filter((id) => nodeIds.has(id)),
        computedAt: new Date(),
      };
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.impactAnalysis.deleteMany({ where: { projectId } });

      if (rows.length > 0) {
        await tx.impactAnalysis.createMany({ data: rows });
      }
    });

    return { upsertedRows: rows.length };
  }


  async getImpact(nodeId: string, projectId: string): Promise<unknown> {

    const node = await this.getNode(nodeId) as { id: string; type: string; name: string; path: string | null };

    if (this.useMemgraphImpact && this.graph) {

      try {
        return await this.getImpactFromMemgraph(node, projectId);
      } catch (err) {
        this.logger.warn({
          op: 'getImpact',
          source: 'memgraph',
          taskId: nodeId,
          projectId,
          error: err instanceof Error ? err.message : String(err),
        });
        // Fall through to Postgres path.
      }
    }

    return this.getImpactFromPostgres(node, projectId);
  }


  /**
   * Postgres fallback for getImpact: reverse-BFS over architectureEdge.
   * Behaviour identical to the pre-CF-GDB-03b-B implementation; used when
   * the Memgraph flag is OFF or when the Cypher query fails.
   */
  private async getImpactFromPostgres(
    node: { id: string; type: string; name: string; path: string | null },
    projectId: string,
  ): Promise<unknown> {

    const nodeId = node.id;

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


  /**
   * Memgraph-backed getImpact (CF-GDB-03b-B).
   *
   * Cypher reverse-BFS along the :DEPENDS_ON relationship. Edge direction
   * follows the convention in GraphSyncService.upsertEdge:
   *   (from)-[:DEPENDS_ON]->(to)   means "from depends on to"
   *
   * So `getImpact(nodeId)` ("who depends on nodeId") walks the relationship
   * BACKWARDS from the target: `(impacted)-[:DEPENDS_ON*1..10]->(target)`.
   *
   * Hop classification:
   *   - direct   = hops == 1
   *   - indirect = hops == 2
   *   - remote   = hops >= 3 (depth capped at 10, matches Postgres BFS)
   *
   * Self-loops are excluded by `impacted.id <> target.id`. Project scoping
   * via `impacted.projectId = $projectId`. Min-hop selection guarantees
   * each impacted node appears in exactly one bucket.
   */
  private async getImpactFromMemgraph(
    node: { id: string; type: string; name: string; path: string | null },
    projectId: string,
  ): Promise<unknown> {

    if (!this.graph) {
      throw new Error('GraphDbClient not available');
    }

    const cypher = this.buildImpactCypher();

    const records = await this.graph.run<{
      id: string;
      type: string | null;
      name: string | null;
      path: string | null;
      hopCount: number;
    }>(
      cypher,
      { nodeId: node.id, projectId },
      { mode: 'read' },
    );

    const direct: Array<{ id: string; type: string; name: string; path: string | null }> = [];
    const indirect: Array<{ id: string; type: string; name: string; path: string | null }> = [];
    const remote: Array<{ id: string; type: string; name: string; path: string | null }> = [];

    for (const r of records) {

      const dto = {
        id: r.id,
        type: r.type ?? '',
        name: r.name ?? r.id,
        path: r.path ?? null,
      };

      const hops = Number(r.hopCount);

      if (hops === 1) direct.push(dto);
      else if (hops === 2) indirect.push(dto);
      else remote.push(dto);
    }

    return {
      triggerNode: { id: node.id, type: node.type, name: node.name, path: node.path },
      direct,
      indirect,
      remote,
    };
  }


  /**
   * Cypher query builder for the impact reverse-BFS. Extracted so it can
   * be asserted in unit tests without a live Memgraph instance.
   */
  buildImpactCypher(): string {
    // NOTE: `hops` is a reserved word in Memgraph's openCypher dialect (cannot
    // be used as an alias). We use `hopCount` instead.
    return `MATCH (target {id: $nodeId})
MATCH p = (impacted)-[:DEPENDS_ON *1..10]->(target)
WHERE impacted.id <> $nodeId
  AND impacted.projectId = $projectId
WITH impacted, min(size(p)) AS hopCount
RETURN impacted.id AS id,
       impacted.type AS type,
       impacted.name AS name,
       impacted.path AS path,
       hopCount
ORDER BY hopCount, id`;
  }
}
