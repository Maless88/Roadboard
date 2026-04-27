/**
 * Integration tests for DriftService against a live Postgres + Memgraph
 * stack (CF-GDB-03c-5).
 *
 * Skips silently if either backend is unreachable, mirroring the
 * pattern in packages/graph-db/src/client.spec.ts. Run alongside
 * `docker compose up postgres memgraph` (or the full stack).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@roadboard/database';
import { GraphDbClient, applyGraphSchema } from '@roadboard/graph-db';

import { DriftService } from '../src/modules/codeflow/drift.service';


const TEST_PROJECT_ID = 'drift-int-test-project';
const TEST_NODE_ID = 'drift-int-test-node';
const TEST_ORPHAN_NODE_ID = 'drift-int-test-orphan';


describe('DriftService (live integration)', () => {

  const prisma = new PrismaClient();
  const graph = new GraphDbClient();
  let drift: DriftService;
  let reachable = false;
  let originalPgIds: string[] = [];

  beforeAll(async () => {

    reachable = await graph.ping().catch(() => false);

    if (!reachable) return;

    await applyGraphSchema(graph);

    drift = new DriftService(prisma as never, graph);

    // Snapshot of currently-tracked node ids in Postgres so the assertions
    // below don't depend on the exact existing dataset.
    originalPgIds = (await prisma.architectureNode.findMany({
      where: { isCurrent: true }, select: { id: true },
    })).map((n) => n.id);
  });


  afterAll(async () => {

    if (reachable) {
      await graph.run(
        'MATCH (n {id: $id}) DETACH DELETE n',
        { id: TEST_ORPHAN_NODE_ID },
        { mode: 'write' },
      ).catch(() => undefined);
    }

    await graph.close().catch(() => undefined);
    await prisma.$disconnect().catch(() => undefined);
  });


  it('returns a well-formed report with all 5 entity types', async () => {

    if (!reachable) return;

    const report = await drift.detectDrift();

    expect(report.reachable).toBe(true);
    expect(report.entities.map((e) => e.type).sort()).toEqual([
      'annotation', 'edge', 'link', 'node', 'repository',
    ]);
    // Not asserting totalDrift=0 here: the local dev DB may carry latent
    // mismatches from earlier test runs. Steady-state parity in prod is
    // verified by the hourly systemd timer (CF-GDB-03c-4).
  });


  it('detects extra-in-memgraph when an orphan node is injected into Memgraph', async () => {

    if (!reachable) return;

    await graph.run(
      'MERGE (n:App {id: $id, projectId: $pid}) SET n.name = "drift-test"',
      { id: TEST_ORPHAN_NODE_ID, pid: TEST_PROJECT_ID },
      { mode: 'write' },
    );

    try {
      const report = await drift.detectDrift();
      const nodeReport = report.entities.find((e) => e.type === 'node');

      expect(nodeReport?.inSync).toBe(false);
      expect(nodeReport?.extraInMemgraph).toContain(TEST_ORPHAN_NODE_ID);
      expect(report.totalDrift).toBeGreaterThan(0);
    } finally {
      // Cleanup so subsequent tests start from a clean baseline.
      await graph.run(
        'MATCH (n {id: $id}) DETACH DELETE n',
        { id: TEST_ORPHAN_NODE_ID },
        { mode: 'write' },
      );
    }
  });


  it('detects missing-in-memgraph when a Postgres-tracked node is removed from Memgraph', async () => {

    if (!reachable || originalPgIds.length === 0) return;

    const target = originalPgIds[0];

    // Capture the current node so we can recreate it after the test.
    const orig = await prisma.architectureNode.findUnique({
      where: { id: target },
      select: { id: true, projectId: true, type: true, name: true, path: true, domainGroup: true },
    });

    if (!orig) return;

    await graph.run(
      'MATCH (n {id: $id}) DETACH DELETE n',
      { id: target },
      { mode: 'write' },
    );

    try {
      const report = await drift.detectDrift();
      const nodeReport = report.entities.find((e) => e.type === 'node');

      expect(nodeReport?.inSync).toBe(false);
      expect(nodeReport?.missingInMemgraph).toContain(target);
    } finally {
      // Restore the node into Memgraph so the live stack returns to parity.
      await graph.run(
        `MERGE (n:App {id: $id, projectId: $pid})
         SET n.type = $type, n.name = $name, n.path = $path, n.domainGroup = $domainGroup`,
        {
          id: orig.id, pid: orig.projectId, type: orig.type, name: orig.name,
          path: orig.path ?? null, domainGroup: orig.domainGroup ?? null,
        },
        { mode: 'write' },
      );
    }
  });


});
