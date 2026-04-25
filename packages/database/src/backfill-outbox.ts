/**
 * One-shot backfill of `graph_sync_events` from current Postgres state.
 *
 * Runs after CF-GDB-03b deploy when GRAPH_SYNC_USE_OUTBOX=true is enabled,
 * so the projection worker has events to process for entities that
 * already existed before the outbox was wired in.
 *
 * Idempotent: an event is inserted only if no event with op='upsert' and
 * status in (pending, in_progress, done) already exists for the same
 * (entityType, entityId). Dead events are skipped (re-running the
 * backfill should requeue them — it's the only way to recover).
 *
 * Usage:
 *   pnpm --filter @roadboard/database db:backfill-outbox
 */
import { PrismaClient } from '@prisma/client';


const prisma = new PrismaClient();


type Op = 'upsert';
type EntityType = 'node' | 'edge' | 'link' | 'annotation' | 'repository';


interface Event {
  projectId: string;
  entityType: EntityType;
  entityId: string;
  op: Op;
  payload: Record<string, unknown>;
}


async function alreadyEnqueued(entityType: EntityType, entityId: string): Promise<boolean> {

  // Skip insert if an upsert event already exists in any non-dead state.
  // Dead events are intentionally NOT counted: backfill re-run is the
  // recovery path for events that exhausted retries.
  const found = await prisma.graphSyncEvent.findFirst({
    where: {
      entityType, entityId, op: 'upsert',
      status: { in: ['pending', 'in_progress', 'done'] },
    },
    select: { id: true },
  });

  return found !== null;
}


async function insertBatch(events: Event[]): Promise<number> {

  if (events.length === 0) return 0;

  let inserted = 0;

  for (const evt of events) {

    if (await alreadyEnqueued(evt.entityType, evt.entityId)) continue;

    await prisma.graphSyncEvent.create({
      data: {
        projectId: evt.projectId,
        entityType: evt.entityType,
        entityId: evt.entityId,
        op: evt.op,
        payload: evt.payload as never,
      },
    });

    inserted++;
  }

  return inserted;
}


async function backfillNodes(): Promise<number> {

  const rows = await prisma.architectureNode.findMany({
    where: { isCurrent: true },
    select: {
      id: true, projectId: true, type: true, name: true, path: true, domainGroup: true,
    },
  });

  console.log(`  ${rows.length} nodes to evaluate`);

  return insertBatch(rows.map((n) => ({
    projectId: n.projectId,
    entityType: 'node',
    entityId: n.id,
    op: 'upsert',
    payload: { id: n.id, projectId: n.projectId, type: n.type, name: n.name, path: n.path, domainGroup: n.domainGroup },
  })));
}


async function backfillEdges(): Promise<number> {

  const rows = await prisma.architectureEdge.findMany({
    where: { isCurrent: true },
    select: {
      id: true, projectId: true, fromNodeId: true, toNodeId: true, edgeType: true, weight: true,
    },
  });

  console.log(`  ${rows.length} edges to evaluate`);

  return insertBatch(rows.map((e) => ({
    projectId: e.projectId,
    entityType: 'edge',
    entityId: e.id,
    op: 'upsert',
    payload: { id: e.id, projectId: e.projectId, fromNodeId: e.fromNodeId, toNodeId: e.toNodeId, edgeType: e.edgeType, weight: e.weight },
  })));
}


async function backfillLinks(): Promise<number> {

  const rows = await prisma.architectureLink.findMany({
    select: {
      id: true, projectId: true, nodeId: true, entityType: true, entityId: true, linkType: true, note: true,
    },
  });

  console.log(`  ${rows.length} links to evaluate`);

  return insertBatch(rows.map((l) => ({
    projectId: l.projectId,
    entityType: 'link',
    entityId: l.id,
    op: 'upsert',
    payload: { id: l.id, projectId: l.projectId, nodeId: l.nodeId, entityType: l.entityType, entityId: l.entityId, linkType: l.linkType, note: l.note },
  })));
}


async function backfillAnnotations(): Promise<number> {

  const rows = await prisma.architectureAnnotation.findMany({
    select: { id: true, projectId: true, nodeId: true, content: true },
  });

  console.log(`  ${rows.length} annotations to evaluate`);

  return insertBatch(rows.map((a) => ({
    projectId: a.projectId,
    entityType: 'annotation',
    entityId: a.id,
    op: 'upsert',
    payload: { id: a.id, projectId: a.projectId, nodeId: a.nodeId, content: a.content },
  })));
}


async function backfillRepositories(): Promise<number> {

  const rows = await prisma.codeRepository.findMany({
    select: { id: true, projectId: true, name: true, repoUrl: true, provider: true, defaultBranch: true },
  });

  console.log(`  ${rows.length} repositories to evaluate`);

  return insertBatch(rows.map((r) => ({
    projectId: r.projectId,
    entityType: 'repository',
    entityId: r.id,
    op: 'upsert',
    payload: { id: r.id, projectId: r.projectId, name: r.name, repoUrl: r.repoUrl, provider: r.provider, defaultBranch: r.defaultBranch },
  })));
}


async function main() {

  console.log('Backfilling graph_sync_events from Postgres state…');

  const totals = {
    nodes: await backfillNodes(),
    edges: await backfillEdges(),
    links: await backfillLinks(),
    annotations: await backfillAnnotations(),
    repositories: await backfillRepositories(),
  };

  const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);

  console.log('---');
  console.log(`Inserted (skipping entities with existing 'done' events):`);
  console.log(`  ${totals.nodes} node events`);
  console.log(`  ${totals.edges} edge events`);
  console.log(`  ${totals.links} link events`);
  console.log(`  ${totals.annotations} annotation events`);
  console.log(`  ${totals.repositories} repository events`);
  console.log(`  TOTAL ${grandTotal}`);
  console.log('Worker will process them on its next poll.');
}


main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
