import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { GraphDbClient, applyGraphSchema, labelFromType } from '@roadboard/graph-db';


/**
 * Dual-write bridge to Memgraph.
 *
 * Phase 1 of CF-GDB-03: the graph is still authoritative in PostgreSQL
 * (Prisma). Every GraphService write is mirrored to Memgraph so we can
 * validate the Cypher model and get a consistent copy before the
 * read-path refactor in CF-GDB-03b.
 *
 * Failures are logged but do NOT abort the primary Postgres write —
 * Memgraph is treated as eventually consistent during the migration.
 */
@Injectable()
export class GraphSyncService implements OnModuleInit, OnModuleDestroy {

  private readonly logger = new Logger(GraphSyncService.name);
  private enabled = false;

  constructor(@Optional() @Inject('GRAPH_DB_CLIENT') private readonly client?: GraphDbClient) {}


  async onModuleInit(): Promise<void> {

    if (!this.client) {
      this.logger.warn('Graph DB client not provided — dual-write disabled.');
      return;
    }

    const ok = await this.client.ping().catch(() => false);

    if (!ok) {
      this.logger.warn('Memgraph unreachable — dual-write disabled for this process.');
      return;
    }

    try {
      await applyGraphSchema(this.client);
      this.enabled = true;
      this.logger.log('Memgraph dual-write enabled, schema applied.');
    } catch (err) {
      this.logger.warn(`Could not apply Memgraph schema: ${err instanceof Error ? err.message : err}`);
    }
  }


  async onModuleDestroy(): Promise<void> {

    if (this.client) {
      await this.client.close().catch(() => undefined);
    }
  }


  isEnabled(): boolean {
    return this.enabled;
  }


  async upsertNode(node: {
    id: string;
    projectId: string;
    type: string;
    name: string;
    path: string | null;
    domainGroup: string | null;
    description?: string | null;
    metadata?: Record<string, unknown> | null;
    ownerUserId?: string | null;
    ownerTeamId?: string | null;
    isManual?: boolean | null;
    isCurrent?: boolean | null;
  }): Promise<void> {

    if (!this.enabled || !this.client) return;

    const label = labelFromType(node.type);

    try {
      await this.client.run(
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
             n.isCurrent = $isCurrent`,
        {
          id: node.id,
          projectId: node.projectId,
          type: node.type,
          name: node.name,
          path: node.path,
          domainGroup: node.domainGroup,
          description: node.description ?? null,
          metadata: node.metadata == null ? null : JSON.stringify(node.metadata),
          ownerUserId: node.ownerUserId ?? null,
          ownerTeamId: node.ownerTeamId ?? null,
          isManual: node.isManual ?? null,
          isCurrent: node.isCurrent ?? null,
        },
        { mode: 'write' },
      );
    } catch (err) {
      this.logger.warn({
        op: 'upsertNode',
        projectId: node.projectId,
        entityType: 'node',
        entityId: node.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }


  async deleteNode(nodeId: string, projectId: string): Promise<void> {

    if (!this.enabled || !this.client) return;

    try {
      // Multi-tenant safe: scope delete by id AND projectId (CF-GDB-03a-3).
      await this.client.run(
        'MATCH (n {id: $id, projectId: $pid}) DETACH DELETE n',
        { id: nodeId, pid: projectId },
        { mode: 'write' },
      );
    } catch (err) {
      this.logger.warn({
        op: 'deleteNode',
        projectId,
        entityType: 'node',
        entityId: nodeId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }


  async upsertEdge(edge: {
    id: string;
    projectId: string;
    fromNodeId: string;
    toNodeId: string;
    edgeType: string;
    weight: number;
  }): Promise<void> {

    if (!this.enabled || !this.client) return;

    const relType = edge.edgeType.toUpperCase();

    try {
      await this.client.run(
        `MATCH (a {id: $fromId}), (b {id: $toId})
         MERGE (a)-[r:${relType} {id: $id}]->(b)
         SET r.projectId = $projectId,
             r.weight = $weight,
             r.edgeType = $edgeType`,
        {
          id: edge.id,
          fromId: edge.fromNodeId,
          toId: edge.toNodeId,
          projectId: edge.projectId,
          weight: edge.weight,
          edgeType: edge.edgeType,
        },
        { mode: 'write' },
      );
    } catch (err) {
      this.logger.warn({
        op: 'upsertEdge',
        projectId: edge.projectId,
        entityType: 'edge',
        entityId: edge.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }


  async deleteEdge(edgeId: string, projectId: string): Promise<void> {

    if (!this.enabled || !this.client) return;

    try {
      // Multi-tenant safe: scope delete by id AND projectId (CF-GDB-03a-3).
      await this.client.run(
        'MATCH ()-[r {id: $id, projectId: $pid}]->() DELETE r',
        { id: edgeId, pid: projectId },
        { mode: 'write' },
      );
    } catch (err) {
      this.logger.warn({
        op: 'deleteEdge',
        projectId,
        entityType: 'edge',
        entityId: edgeId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }


  async upsertLink(link: {
    id: string;
    projectId: string;
    nodeId: string;
    entityType: string;
    entityId: string;
    linkType: string;
    note: string | null;
  }): Promise<void> {

    if (!this.enabled || !this.client) return;

    try {
      await this.client.run(
        `MERGE (l:Link {id: $id})
         SET l.projectId = $projectId,
             l.nodeId = $nodeId,
             l.entityType = $entityType,
             l.entityId = $entityId,
             l.linkType = $linkType,
             l.note = $note
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
        },
        { mode: 'write' },
      );
    } catch (err) {
      this.logger.warn({
        op: 'upsertLink',
        projectId: link.projectId,
        entityType: 'link',
        entityId: link.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }


  async deleteLink(linkId: string, projectId: string): Promise<void> {

    if (!this.enabled || !this.client) return;

    try {
      // Multi-tenant safe: scope delete by id AND projectId.
      await this.client.run(
        'MATCH (l:Link {id: $id, projectId: $pid}) DETACH DELETE l',
        { id: linkId, pid: projectId },
        { mode: 'write' },
      );
    } catch (err) {
      this.logger.warn({
        op: 'deleteLink',
        projectId,
        entityType: 'link',
        entityId: linkId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }


  async upsertAnnotation(annotation: {
    id: string;
    projectId: string;
    nodeId: string;
    content: string;
  }): Promise<void> {

    if (!this.enabled || !this.client) return;

    try {
      await this.client.run(
        `MERGE (a:Annotation {id: $id})
         SET a.projectId = $projectId,
             a.nodeId = $nodeId,
             a.content = $content
         WITH a
         MATCH (n {id: $nodeId, projectId: $projectId})
         MERGE (a)-[:ANNOTATES]->(n)`,
        {
          id: annotation.id,
          projectId: annotation.projectId,
          nodeId: annotation.nodeId,
          content: annotation.content,
        },
        { mode: 'write' },
      );
    } catch (err) {
      this.logger.warn({
        op: 'upsertAnnotation',
        projectId: annotation.projectId,
        entityType: 'annotation',
        entityId: annotation.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }


  async deleteAnnotation(annotationId: string, projectId: string): Promise<void> {

    if (!this.enabled || !this.client) return;

    try {
      // Multi-tenant safe: scope delete by id AND projectId.
      await this.client.run(
        'MATCH (a:Annotation {id: $id, projectId: $pid}) DETACH DELETE a',
        { id: annotationId, pid: projectId },
        { mode: 'write' },
      );
    } catch (err) {
      this.logger.warn({
        op: 'deleteAnnotation',
        projectId,
        entityType: 'annotation',
        entityId: annotationId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }


  async resetProject(projectId: string): Promise<void> {

    if (!this.enabled || !this.client) return;

    try {
      await this.client.run(
        'MATCH (n {projectId: $pid}) DETACH DELETE n',
        { pid: projectId },
        { mode: 'write' },
      );
    } catch (err) {
      this.logger.warn({
        op: 'resetProject',
        projectId,
        entityType: 'project',
        entityId: projectId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
