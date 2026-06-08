import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { PrismaClient } from '@roadboard/database';
import { optionalEnv } from '@roadboard/config';
import { GraphDbClient, labelFromType } from '@roadboard/graph-db';

import type { AuthUser } from '../../common/auth-user';
import { AuditService } from '../audit/audit.service';
import { CreateNodeDto } from './dto/create-node.dto';
import { UpdateNodeDto } from './dto/update-node.dto';
import { CreateEdgeDto } from './dto/create-edge.dto';
import { CreateLinkDto } from './dto/create-link.dto';
import { CreateAnnotationDto } from './dto/create-annotation.dto';


/**
 * Safely parse a JSON string. Memgraph stores node `metadata` as a JSON
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


@Injectable()
export class GraphService {

  private readonly logger = new Logger(GraphService.name);
  private readonly useOutbox: boolean;

  constructor(
    @Inject('PRISMA') private readonly prisma: PrismaClient,
    @Inject(AuditService) private readonly audit: AuditService,
    @Optional() @Inject('GRAPH_DB_CLIENT') private readonly graph?: GraphDbClient,
  ) {

    this.useOutbox = optionalEnv('GRAPH_SYNC_USE_OUTBOX', 'false') === 'true';
  }


  isOutboxMode(): boolean {
    return this.useOutbox;
  }


  /**
   * Returns the Memgraph client or throws when it was not injected.
   * Memgraph is the sole source of truth for the architecture graph; a
   * missing client must error rather than silently degrade.
   */
  private requireGraph(): GraphDbClient {

    if (!this.graph) {
      throw new Error('GraphDbClient is not available');
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

    const graph = this.requireGraph();

    const records = await graph.run<{
      id: string;
      nodeId: string;
      entityType: string;
      entityId: string;
      linkType: string;
      note: string | null;
      createdAt: string | null;
    }>(
      `MATCH (l:Link {projectId: $projectId, entityType: $entityType, entityId: $entityId})
       RETURN l.id AS id,
              l.nodeId AS nodeId,
              l.entityType AS entityType,
              l.entityId AS entityId,
              l.linkType AS linkType,
              l.note AS note,
              l.createdAt AS createdAt
       ORDER BY l.createdAt DESC`,
      { projectId, entityType, entityId },
      { mode: 'read' },
    );

    if (records.length === 0) {
      return { links: [], nodes: [] };
    }

    const nodeIds = [...new Set(records.map((l) => l.nodeId))];

    const nodeRecords = await graph.run<{
      id: string;
      type: string | null;
      name: string | null;
      path: string | null;
      domainGroup: string | null;
      description: string | null;
      annotationsPreview: Array<{ content: string; createdAt: string | null }>;
    }>(
      `MATCH (n {projectId: $projectId})
       WHERE n.id IN $nodeIds AND NOT n:Link AND NOT n:Annotation
       OPTIONAL MATCH (a:Annotation)-[:ANNOTATES]->(n)
       WITH n, a
       ORDER BY a.createdAt DESC
       WITH n, collect({ content: a.content, createdAt: a.createdAt })[0..3] AS annotationsPreview
       RETURN n.id AS id,
              n.type AS type,
              n.name AS name,
              n.path AS path,
              n.domainGroup AS domainGroup,
              n.description AS description,
              annotationsPreview`,
      { projectId, nodeIds },
      { mode: 'read' },
    );

    return {
      links: records.map((l) => ({
        id: l.id,
        nodeId: l.nodeId,
        entityType: l.entityType,
        entityId: l.entityId,
        linkType: l.linkType,
        note: l.note,
        createdAt: l.createdAt,
      })),
      nodes: nodeRecords.map((n) => ({
        id: n.id,
        type: n.type ?? '',
        name: n.name ?? n.id,
        path: n.path,
        domainGroup: n.domainGroup,
        description: n.description,
        annotationsPreview: (n.annotationsPreview ?? [])
          .filter((a) => a && a.content != null)
          .map((a) => ({ content: a.content, createdAt: a.createdAt })),
      })),
    };
  }


  async resetProject(projectId: string): Promise<{ deletedNodes: number; deletedEdges: number }> {

    // Graph entities (node/edge/link/annotation) are deleted from Memgraph
    // with EXACT pre-delete counts, while the non-graph relational table
    // `codeRepository` is still cleaned up in Postgres.
    const result = await this.resetProjectInMemgraph(projectId);
    await this.prisma.codeRepository.deleteMany({ where: { projectId } });

    return result;
  }


  async getGraph(projectId: string): Promise<unknown> {

    return this.getGraphFromMemgraph(projectId);
  }


  /**
   * Memgraph-backed getGraph (CF-GDB-03b-C).
   *
   * Reads current nodes + outgoing edges from Memgraph along with aggregate
   * counts (linked tasks, decisions, annotations). The snapshot metadata
   * (snapshotId/status/lastScannedAt) comes from the relational
   * `architectureSnapshot` table (scan metadata, retained — Decision 8).
   */
  private async getGraphFromMemgraph(projectId: string): Promise<unknown> {

    const graph = this.requireGraph();

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
      graph.run<{
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
      graph.run<{
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


  // ── Nodes ────────────────────────────────────────────

  async createNode(projectId: string, dto: CreateNodeDto, user: AuthUser): Promise<unknown> {

    const node = await this.createNodeInMemgraph(projectId, dto);

    await this.audit.recordForUser(user, 'node.created', 'architecture_node', node.id, node.projectId, {
      type: node.type,
      name: node.name,
      path: node.path,
    });

    return node;
  }


  // ── Memgraph-direct write helpers (CF-GDB-03b-D) ─────
  //
  // Memgraph is the sole source of truth. These helpers are fail-closed:
  // errors propagate so the write API fails instead of reporting a fake
  // success. Memgraph does not generate ids/timestamps/defaults, so each
  // create* helper materialises them explicitly to keep the REST response
  // shape identical to the previous Prisma-backed contract.

  /**
   * Generates a fresh entity id. Clients never parse the id, so an opaque
   * randomUUID is sufficient.
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
    // — preserving the FK-violation semantics of the prior Prisma path.
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

    // Count graph entities BEFORE deleting so the response matches the prior
    // contract (Decision 3): nodes exclude Link/Annotation mirror nodes;
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

    const node = await this.getNodeFromMemgraph(id);

    if (!node) {
      throw new NotFoundException(`ArchitectureNode ${id} not found`);
    }

    return node;
  }


  /**
   * Memgraph-backed getNode (CF-GDB-03b-C).
   *
   * Reads the node + its outgoing Link/Annotation entities:
   *   - (l:Link)-[:LINKED_TO]->(n)
   *   - (a:Annotation)-[:ANNOTATES]->(n)
   *
   * Returns null if the node does not exist in Memgraph (caller raises 404).
   * Shape matches the previous Prisma `findUnique({ include })` result so the
   * REST contract is unchanged.
   */
  private async getNodeFromMemgraph(id: string): Promise<Record<string, unknown> | null> {

    const graph = this.requireGraph();

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

    const records = await graph.run<Record<string, unknown>>(
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

    const updated = await this.updateNodeInMemgraph(id, data) as { id: string; projectId: string };

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

    await this.deleteNodeInMemgraph(id, node.projectId);
    const deleted = { id: node.id, projectId: node.projectId };

    await this.audit.recordForUser(user, 'node.deleted', 'architecture_node', node.id, node.projectId, {
      name: node.name,
      type: node.type,
    });

    return deleted;
  }


  // ── Edges ────────────────────────────────────────────

  async createEdge(projectId: string, dto: CreateEdgeDto, user: AuthUser): Promise<unknown> {

    const edge = await this.createEdgeInMemgraph(projectId, dto);

    await this.audit.recordForUser(user, 'edge.created', 'architecture_edge', edge.id, edge.projectId, {
      fromNodeId: edge.fromNodeId,
      toNodeId: edge.toNodeId,
      edgeType: edge.edgeType,
    });

    return edge;
  }


  async deleteEdge(id: string, user: AuthUser): Promise<unknown> {

    const edge = await this.getEdgeFromMemgraph(id);

    if (!edge) {
      throw new NotFoundException(`ArchitectureEdge ${id} not found`);
    }

    if (!edge.isManual) {
      throw new Error('Cannot delete auto-generated edges; they are replaced on rescan');
    }

    await this.deleteEdgeInMemgraph(id, edge.projectId);
    const deleted = { id: edge.id, projectId: edge.projectId };

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

    const link = await this.createLinkInMemgraph(nodeId, projectId, dto, user);

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

    const graph = this.requireGraph();

    return graph.run<{
      id: string; nodeId: string; projectId: string; entityType: string;
      entityId: string; linkType: string; note: string | null; createdAt: string | null;
    }>(
      `MATCH (l:Link {nodeId: $nodeId})
       RETURN l.id AS id,
              l.nodeId AS nodeId,
              l.projectId AS projectId,
              l.entityType AS entityType,
              l.entityId AS entityId,
              l.linkType AS linkType,
              l.note AS note,
              l.createdAt AS createdAt
       ORDER BY l.createdAt DESC`,
      { nodeId },
      { mode: 'read' },
    );
  }


  async deleteLink(id: string, user: AuthUser) {

    const link = await this.getLinkFromMemgraph(id);

    if (!link) {
      throw new NotFoundException(`ArchitectureLink ${id} not found`);
    }

    await this.deleteLinkInMemgraph(id, link.projectId);
    const deleted = { id: link.id, projectId: link.projectId };

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

    const ann = await this.createAnnotationInMemgraph(nodeId, projectId, dto, user);

    await this.audit.recordForUser(user, 'annotation.created', 'architecture_annotation', ann.id, ann.projectId, {
      nodeId: ann.nodeId,
    });

    return ann;
  }


  // ── Snapshot ─────────────────────────────────────────

  async getSnapshot(projectId: string) {

    return this.getSnapshotFromMemgraph(projectId);
  }


  /**
   * Memgraph-backed getSnapshot (CF-GDB-03b-C).
   *
   * Returns the same shape as the prior Postgres version: current nodes (with
   * total link count + annotation contents), current edges, and the top-10
   * impact nodes ranked by incoming :DEPENDS_ON degree.
   */
  private async getSnapshotFromMemgraph(projectId: string): Promise<unknown> {

    const graph = this.requireGraph();

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
      graph.run<{
        id: string;
        type: string | null;
        name: string | null;
        path: string | null;
        domainGroup: string | null;
        linkCount: number;
        annotationContents: string[];
      }>(nodesCypher, { projectId }, { mode: 'read' }),
      graph.run<{
        fromNodeId: string;
        toNodeId: string;
        edgeType: string;
      }>(edgesCypher, { projectId }, { mode: 'read' }),
      graph.run<{
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

    const graph = this.requireGraph();

    const nodesCypher = `MATCH (n {projectId: $projectId})
WHERE NOT n:Link AND NOT n:Annotation
  AND (n.isCurrent IS NULL OR n.isCurrent = true)
RETURN n.id AS id, n.type AS type, n.name AS name
ORDER BY id`;

    const edgesCypher = `MATCH (a {projectId: $projectId})-[r]->(b {projectId: $projectId})
WHERE type(r) <> 'LINKED_TO' AND type(r) <> 'ANNOTATES'
  AND r.id IS NOT NULL
  AND (a.isCurrent IS NULL OR a.isCurrent = true)
  AND (b.isCurrent IS NULL OR b.isCurrent = true)
RETURN a.id AS fromNodeId, b.id AS toNodeId,
       coalesce(r.edgeType, toLower(type(r))) AS edgeType`;

    const annotationsCypher = `MATCH (a:Annotation {projectId: $projectId})-[:ANNOTATES]->(n)
RETURN a.nodeId AS nodeId, a.content AS content,
       a.createdAt AS createdAt, n.name AS nodeName
ORDER BY a.createdAt DESC
LIMIT 10`;

    const [nodes, edges, annotations] = await Promise.all([
      graph.run<{ id: string; type: string | null; name: string | null }>(
        nodesCypher, { projectId }, { mode: 'read' },
      ),
      graph.run<{ fromNodeId: string; toNodeId: string; edgeType: string }>(
        edgesCypher, { projectId }, { mode: 'read' },
      ),
      graph.run<{
        nodeId: string; content: string; createdAt: string | null; nodeName: string | null;
      }>(annotationsCypher, { projectId }, { mode: 'read' }),
    ]);

    const nodesByType: Record<string, number> = {};

    for (const n of nodes) {
      const type = n.type ?? '';
      nodesByType[type] = (nodesByType[type] ?? 0) + 1;
    }

    const edgesByType: Record<string, number> = {};

    for (const e of edges) {
      edgesByType[e.edgeType] = (edgesByType[e.edgeType] ?? 0) + 1;
    }

    const topImpactNodes = await this.computeTopImpactNodesFromMemgraph(
      projectId,
      nodes.map((n) => ({ id: n.id, type: n.type ?? '', name: n.name ?? n.id })),
    );

    const recentAnnotations = annotations.map((a) => ({
      nodeId: a.nodeId,
      nodeName: a.nodeName ?? a.nodeId,
      content: a.content,
      createdAt: a.createdAt ?? new Date().toISOString(),
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


  private async computeTopImpactNodesFromMemgraph(
    projectId: string,
    nodes: Array<{ id: string; type: string; name: string }>,
  ): Promise<Array<{ nodeId: string; name: string; type: string; directDependants: number }>> {

    const graph = this.requireGraph();

    const cypher = `MATCH (target)
WHERE target.projectId = $projectId
OPTIONAL MATCH (src)-[:DEPENDS_ON]->(target)
WHERE src.projectId = $projectId
WITH target, count(src) AS directDependants
ORDER BY directDependants DESC
LIMIT 5
RETURN target.id AS nodeId, target.name AS name, target.type AS type, directDependants`;

    const records = await graph.run<{
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


  // ── Impact ───────────────────────────────────────────

  async getImpact(nodeId: string, projectId: string): Promise<unknown> {

    const node = await this.getNode(nodeId) as { id: string; type: string; name: string; path: string | null };

    return this.getImpactFromMemgraph(node, projectId);
  }


  /**
   * Memgraph-backed getImpact (CF-GDB-03b-B).
   *
   * Cypher reverse-BFS along the :DEPENDS_ON relationship. Edge direction:
   *   (from)-[:DEPENDS_ON]->(to)   means "from depends on to"
   *
   * So `getImpact(nodeId)` ("who depends on nodeId") walks the relationship
   * BACKWARDS from the target: `(impacted)-[:DEPENDS_ON*1..10]->(target)`.
   *
   * Hop classification:
   *   - direct   = hops == 1
   *   - indirect = hops == 2
   *   - remote   = hops >= 3 (depth capped at 10)
   *
   * Self-loops are excluded by `impacted.id <> target.id`. Project scoping
   * via `impacted.projectId = $projectId`. Min-hop selection guarantees
   * each impacted node appears in exactly one bucket.
   */
  private async getImpactFromMemgraph(
    node: { id: string; type: string; name: string; path: string | null },
    projectId: string,
  ): Promise<unknown> {

    const graph = this.requireGraph();

    const cypher = this.buildImpactCypher();

    const records = await graph.run<{
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
