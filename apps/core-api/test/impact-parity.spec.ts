/**
 * Integration parity test for GraphService.getImpact (CF-GDB-03b-B).
 *
 * Seeds an identical 4-node DAG into Postgres AND Memgraph (via the same
 * GraphSyncService used in production), then runs getImpact twice on the
 * same trigger node:
 *   - flag OFF → Postgres reverse-BFS path
 *   - flag ON  → Memgraph Cypher reverse-BFS path
 *
 * Assertion: identical REST shape, identical set membership per bucket
 * (direct / indirect / remote). Ordering tolerated.
 *
 * Skips silently if Memgraph is unreachable, mirroring drift-integration.spec.ts.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@roadboard/database';
import { GraphDbClient, applyGraphSchema } from '@roadboard/graph-db';

import { GraphService } from '../src/modules/codeflow/graph.service';
import { GraphSyncService } from '../src/modules/codeflow/graph-sync.service';


// We piggy-back on an existing Project + CodeRepository (no fixture creation,
// to avoid touching unrelated tables: Team, User, etc.). The seeded nodes are
// tagged with a synthetic projectId scope reuse + dedicated ids so they can
// be cleaned up without affecting real data.
let TEST_PROJECT_ID = '';
let TEST_REPOSITORY_ID = '';

// DAG:        target
//              ^
//              |
//             mid
//            ^   ^
//           /     \
//        leaf1   leaf2
//          ^
//          |
//       remote
const NODES = [
  { id: 'impact-parity-target', name: 'target', type: 'app' },
  { id: 'impact-parity-mid',    name: 'mid',    type: 'package' },
  { id: 'impact-parity-leaf1',  name: 'leaf1',  type: 'package' },
  { id: 'impact-parity-leaf2',  name: 'leaf2',  type: 'package' },
  { id: 'impact-parity-remote', name: 'remote', type: 'package' },
] as const;

const EDGES = [
  { id: 'impact-parity-e1', from: 'impact-parity-mid',    to: 'impact-parity-target' },
  { id: 'impact-parity-e2', from: 'impact-parity-leaf1',  to: 'impact-parity-mid' },
  { id: 'impact-parity-e3', from: 'impact-parity-leaf2',  to: 'impact-parity-mid' },
  { id: 'impact-parity-e4', from: 'impact-parity-remote', to: 'impact-parity-leaf1' },
] as const;


interface ImpactDto {
  triggerNode: { id: string; type: string; name: string; path: string | null };
  direct:   Array<{ id: string; type: string; name: string; path: string | null }>;
  indirect: Array<{ id: string; type: string; name: string; path: string | null }>;
  remote:   Array<{ id: string; type: string; name: string; path: string | null }>;
}


function idsSet(arr: ImpactDto['direct']): string[] {
  return arr.map((n) => n.id).sort();
}


describe('getImpact parity (Postgres vs Memgraph)', () => {

  const prisma = new PrismaClient();
  const graph = new GraphDbClient();
  const sync = new GraphSyncService(graph);
  let reachable = false;

  beforeAll(async () => {

    reachable = await graph.ping().catch(() => false);

    if (!reachable) return;

    await applyGraphSchema(graph);
    // Trigger sync.onModuleInit so it flips `enabled=true`.
    await sync.onModuleInit();

    // Find an existing Project + CodeRepository so we don't have to seed
    // upstream Team/User fixtures. The test cleans up only the rows it
    // creates (matched by their well-known synthetic ids).
    const proj = await prisma.project.findFirst({
      include: { codeRepositories: true },
      where: { codeRepositories: { some: {} } },
    });

    if (!proj || proj.codeRepositories.length === 0) {
      reachable = false;
      return;
    }

    TEST_PROJECT_ID = proj.id;
    TEST_REPOSITORY_ID = proj.codeRepositories[0].id;

    // Clean previous run, if any (only synthetic ids, leave real data alone).
    await prisma.architectureEdge.deleteMany({ where: { id: { in: EDGES.map((e) => e.id) } } });
    await prisma.architectureNode.deleteMany({ where: { id: { in: NODES.map((n) => n.id) } } });

    // Clean any leftover synthetic nodes in Memgraph (by id, not projectId).
    await graph.run(
      'MATCH (n) WHERE n.id IN $ids DETACH DELETE n',
      { ids: NODES.map((n) => n.id) },
      { mode: 'write' },
    );

    // Seed Postgres.
    for (const n of NODES) {
      await prisma.architectureNode.create({
        data: {
          id: n.id,
          projectId: TEST_PROJECT_ID,
          repositoryId: TEST_REPOSITORY_ID,
          type: n.type,
          name: n.name,
          path: null,
          isManual: true,
          isCurrent: true,
        },
      });
    }

    for (const e of EDGES) {
      await prisma.architectureEdge.create({
        data: {
          id: e.id,
          projectId: TEST_PROJECT_ID,
          fromNodeId: e.from,
          toNodeId: e.to,
          edgeType: 'depends_on',
          weight: 1,
          isCurrent: true,
        },
      });
    }

    // Seed Memgraph via the same sync code-path used in production.
    for (const n of NODES) {
      await sync.upsertNode({
        id: n.id,
        projectId: TEST_PROJECT_ID,
        type: n.type,
        name: n.name,
        path: null,
        domainGroup: null,
        isManual: true,
        isCurrent: true,
      });
    }

    for (const e of EDGES) {
      await sync.upsertEdge({
        id: e.id,
        projectId: TEST_PROJECT_ID,
        fromNodeId: e.from,
        toNodeId: e.to,
        edgeType: 'depends_on',
        weight: 1,
      });
    }
  });


  afterAll(async () => {

    if (reachable) {
      await graph.run(
        'MATCH (n) WHERE n.id IN $ids DETACH DELETE n',
        { ids: NODES.map((n) => n.id) },
        { mode: 'write' },
      ).catch(() => undefined);
    }

    await prisma.architectureEdge.deleteMany({ where: { id: { in: EDGES.map((e) => e.id) } } }).catch(() => undefined);
    await prisma.architectureNode.deleteMany({ where: { id: { in: NODES.map((n) => n.id) } } }).catch(() => undefined);

    await graph.close().catch(() => undefined);
    await prisma.$disconnect().catch(() => undefined);
  });


  afterEach(() => {
    delete process.env.GRAPH_READ_USE_MEMGRAPH_IMPACT;
  });


  it('returns identical bucket membership on flag OFF vs flag ON', async () => {

    if (!reachable) return;

    // Flag OFF — Postgres path.
    delete process.env.GRAPH_READ_USE_MEMGRAPH_IMPACT;
    const svcOff = new GraphService(prisma as never, sync, graph);
    const pgResult = await svcOff.getImpact('impact-parity-target', TEST_PROJECT_ID) as ImpactDto;

    // Flag ON — Memgraph path.
    process.env.GRAPH_READ_USE_MEMGRAPH_IMPACT = 'true';
    const svcOn = new GraphService(prisma as never, sync, graph);
    const mgResult = await svcOn.getImpact('impact-parity-target', TEST_PROJECT_ID) as ImpactDto;

    // Trigger node identical.
    expect(mgResult.triggerNode.id).toBe(pgResult.triggerNode.id);
    expect(mgResult.triggerNode.type).toBe(pgResult.triggerNode.type);
    expect(mgResult.triggerNode.name).toBe(pgResult.triggerNode.name);

    // Set parity per bucket.
    expect(idsSet(mgResult.direct)).toEqual(idsSet(pgResult.direct));
    expect(idsSet(mgResult.indirect)).toEqual(idsSet(pgResult.indirect));
    expect(idsSet(mgResult.remote)).toEqual(idsSet(pgResult.remote));

    // Sanity: bucket content matches the seeded DAG.
    expect(idsSet(pgResult.direct)).toEqual(['impact-parity-mid']);
    expect(idsSet(pgResult.indirect)).toEqual(['impact-parity-leaf1', 'impact-parity-leaf2']);
    expect(idsSet(pgResult.remote)).toEqual(['impact-parity-remote']);
  });
});
