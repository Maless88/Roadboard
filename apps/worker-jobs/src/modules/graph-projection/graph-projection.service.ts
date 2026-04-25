import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@roadboard/database';
import { GraphDbClient, applyGraphSchema, labelFromType } from '@roadboard/graph-db';
import { optionalEnv } from '@roadboard/config';


type EntityType = 'node' | 'edge' | 'link' | 'annotation' | 'repository' | 'project';
type Op = 'upsert' | 'delete' | 'reset';
type Status = 'pending' | 'in_progress' | 'done' | 'dead';


interface PendingEvent {
  id: string;
  projectId: string;
  entityType: EntityType;
  entityId: string;
  op: Op;
  payload: Record<string, unknown>;
  attempts: number;
}


// Backoff in ms after attempts 1..N. After exhausting the array, the
// event is marked `dead`. Total horizon ≈ 1h before giving up.
const BACKOFF_MS = [1_000, 5_000, 30_000, 5 * 60_000, 60 * 60_000];
const POLL_INTERVAL_MS = 1_000;
const BATCH_SIZE = 25;


@Injectable()
export class GraphProjectionService implements OnModuleInit, OnModuleDestroy {

  private readonly logger = new Logger(GraphProjectionService.name);
  private readonly prisma: PrismaClient;
  private readonly graph: GraphDbClient;
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private graphReady = false;
  private readonly enabled: boolean;

  constructor() {

    this.prisma = new PrismaClient();
    this.graph = new GraphDbClient();
    this.enabled = optionalEnv('GRAPH_SYNC_USE_OUTBOX', 'false') === 'true';
  }


  async onModuleInit(): Promise<void> {

    if (!this.enabled) {
      this.logger.log('GraphProjectionService disabled (GRAPH_SYNC_USE_OUTBOX != true)');
      return;
    }

    const ok = await this.graph.ping().catch(() => false);

    if (!ok) {
      this.logger.warn('Memgraph unreachable at boot — projection worker idle until next poll succeeds');
    } else {
      try {
        await applyGraphSchema(this.graph);
        this.graphReady = true;
        this.logger.log('Memgraph reachable, schema applied — projection worker active');
      } catch (err) {
        this.logger.warn(`applyGraphSchema failed: ${(err as Error).message}`);
      }
    }

    this.timer = setInterval(() => this.tick().catch((err) => {
      this.logger.error(`tick failed: ${(err as Error).message}`);
    }), POLL_INTERVAL_MS);
  }


  async onModuleDestroy(): Promise<void> {

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    await this.graph.close().catch(() => undefined);
    await this.prisma.$disconnect().catch(() => undefined);
  }


  private async tick(): Promise<void> {

    if (!this.enabled || this.running) return;

    this.running = true;

    try {
      // Lazy reattach to Memgraph if it was down at boot.
      if (!this.graphReady) {
        const ok = await this.graph.ping().catch(() => false);

        if (!ok) return;

        try {
          await applyGraphSchema(this.graph);
          this.graphReady = true;
          this.logger.log('Memgraph reattached — projection worker active');
        } catch {
          return;
        }
      }

      const events = await this.claimBatch();

      for (const evt of events) {

        try {
          await this.applyEvent(evt);
          await this.markDone(evt.id);
        } catch (err) {
          await this.markFailed(evt, err instanceof Error ? err.message : String(err));
        }
      }
    } finally {
      this.running = false;
    }
  }


  /**
   * Claim a batch of pending events using SELECT FOR UPDATE SKIP LOCKED so
   * multiple worker replicas don't process the same row twice.
   */
  private async claimBatch(): Promise<PendingEvent[]> {

    const claimed = await this.prisma.$queryRawUnsafe<PendingEvent[]>(
      `WITH next AS (
         SELECT id FROM graph_sync_events
         WHERE status = 'pending'
           AND (next_attempt_at IS NULL OR next_attempt_at <= NOW())
         ORDER BY created_at ASC
         FOR UPDATE SKIP LOCKED
         LIMIT ${BATCH_SIZE}
       )
       UPDATE graph_sync_events e
         SET status = 'in_progress'
       FROM next
       WHERE e.id = next.id
       RETURNING
         e.id,
         e.project_id      AS "projectId",
         e.entity_type     AS "entityType",
         e.entity_id       AS "entityId",
         e.op,
         e.payload,
         e.attempts`,
    );

    return claimed;
  }


  private async markDone(id: string): Promise<void> {

    await this.prisma.graphSyncEvent.update({
      where: { id },
      data: { status: 'done' as Status, processedAt: new Date(), lastError: null },
    });
  }


  private async markFailed(evt: PendingEvent, error: string): Promise<void> {

    const nextAttempts = evt.attempts + 1;
    const backoffIdx = Math.min(nextAttempts - 1, BACKOFF_MS.length - 1);
    const dead = nextAttempts > BACKOFF_MS.length;

    await this.prisma.graphSyncEvent.update({
      where: { id: evt.id },
      data: dead
        ? { status: 'dead' as Status, attempts: nextAttempts, lastError: error.slice(-500), nextAttemptAt: null }
        : {
            status: 'pending' as Status,
            attempts: nextAttempts,
            lastError: error.slice(-500),
            nextAttemptAt: new Date(Date.now() + BACKOFF_MS[backoffIdx]),
          },
    });

    this.logger.warn({
      op: 'graph-projection',
      eventId: evt.id,
      entityType: evt.entityType,
      entityId: evt.entityId,
      attempts: nextAttempts,
      status: dead ? 'dead' : 'pending',
      error,
    });
  }


  /**
   * Dispatch an event to its Cypher handler. Each handler must be idempotent
   * (MERGE-based) so retries don't create duplicates.
   */
  private async applyEvent(evt: PendingEvent): Promise<void> {

    const payload = evt.payload;

    switch (`${evt.entityType}:${evt.op}`) {

      case 'node:upsert':
        return this.upsertNode(payload);

      case 'node:delete':
        return this.deleteNode(evt.entityId, evt.projectId);

      case 'edge:upsert':
        return this.upsertEdge(payload);

      case 'edge:delete':
        return this.deleteEdge(evt.entityId, evt.projectId);

      case 'link:upsert':
        return this.upsertLink(payload);

      case 'link:delete':
        return this.deleteSimpleNode('Link', evt.entityId, evt.projectId);

      case 'annotation:upsert':
        return this.upsertAnnotation(payload);

      case 'annotation:delete':
        return this.deleteSimpleNode('Annotation', evt.entityId, evt.projectId);

      case 'repository:upsert':
        return this.upsertRepository(payload);

      case 'repository:delete':
        return this.deleteSimpleNode('Repository', evt.entityId, evt.projectId);

      case 'project:reset':
        return this.resetProject(evt.projectId);

      default:
        throw new Error(`unsupported event ${evt.entityType}:${evt.op}`);
    }
  }


  // ── Cypher handlers (all idempotent) ──────────────────────────────

  private async upsertNode(p: Record<string, unknown>): Promise<void> {

    const label = labelFromType(p.type as string);

    await this.graph.run(
      `MERGE (n:${label} {id: $id, projectId: $projectId})
       SET n.type = $type, n.name = $name, n.path = $path, n.domainGroup = $domainGroup`,
      {
        id: p.id, projectId: p.projectId, type: p.type, name: p.name,
        path: p.path ?? null, domainGroup: p.domainGroup ?? null,
      },
      { mode: 'write' },
    );
  }


  private async deleteNode(id: string, projectId: string): Promise<void> {

    await this.graph.run(
      'MATCH (n {id: $id, projectId: $pid}) DETACH DELETE n',
      { id, pid: projectId },
      { mode: 'write' },
    );
  }


  private async upsertEdge(p: Record<string, unknown>): Promise<void> {

    const relType = String(p.edgeType).toUpperCase();

    await this.graph.run(
      `MATCH (a {id: $fromId, projectId: $pid}), (b {id: $toId, projectId: $pid})
       MERGE (a)-[r:${relType} {id: $id}]->(b)
       SET r.projectId = $pid, r.weight = $weight, r.edgeType = $edgeType`,
      {
        id: p.id, pid: p.projectId, fromId: p.fromNodeId, toId: p.toNodeId,
        weight: p.weight ?? 1, edgeType: p.edgeType,
      },
      { mode: 'write' },
    );
  }


  private async deleteEdge(id: string, projectId: string): Promise<void> {

    await this.graph.run(
      'MATCH ()-[r {id: $id, projectId: $pid}]->() DELETE r',
      { id, pid: projectId },
      { mode: 'write' },
    );
  }


  private async upsertLink(p: Record<string, unknown>): Promise<void> {

    await this.graph.run(
      `MERGE (l:Link {id: $id, projectId: $projectId})
       SET l.nodeId = $nodeId, l.entityType = $entityType, l.entityId = $entityId,
           l.linkType = $linkType, l.note = $note
       WITH l
       MATCH (n {id: $nodeId, projectId: $projectId})
       MERGE (l)-[:LINKED_TO]->(n)`,
      {
        id: p.id, projectId: p.projectId, nodeId: p.nodeId,
        entityType: p.entityType, entityId: p.entityId,
        linkType: p.linkType, note: p.note ?? null,
      },
      { mode: 'write' },
    );
  }


  private async upsertAnnotation(p: Record<string, unknown>): Promise<void> {

    await this.graph.run(
      `MERGE (a:Annotation {id: $id, projectId: $projectId})
       SET a.nodeId = $nodeId, a.content = $content
       WITH a
       MATCH (n {id: $nodeId, projectId: $projectId})
       MERGE (a)-[:ANNOTATES]->(n)`,
      {
        id: p.id, projectId: p.projectId, nodeId: p.nodeId,
        content: p.content,
      },
      { mode: 'write' },
    );
  }


  private async upsertRepository(p: Record<string, unknown>): Promise<void> {

    await this.graph.run(
      `MERGE (r:Repository {id: $id, projectId: $projectId})
       SET r.name = $name, r.repoUrl = $repoUrl, r.provider = $provider,
           r.defaultBranch = $defaultBranch`,
      {
        id: p.id, projectId: p.projectId, name: p.name,
        repoUrl: p.repoUrl ?? null, provider: p.provider ?? 'manual',
        defaultBranch: p.defaultBranch ?? 'main',
      },
      { mode: 'write' },
    );
  }


  private async deleteSimpleNode(label: string, id: string, projectId: string): Promise<void> {

    await this.graph.run(
      `MATCH (n:${label} {id: $id, projectId: $pid}) DETACH DELETE n`,
      { id, pid: projectId },
      { mode: 'write' },
    );
  }


  private async resetProject(projectId: string): Promise<void> {

    await this.graph.run(
      'MATCH (n {projectId: $pid}) DETACH DELETE n',
      { pid: projectId },
      { mode: 'write' },
    );
  }
}
