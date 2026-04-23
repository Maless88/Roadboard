import { PrismaClient } from '@prisma/client';
import { GraphDbClient, applyGraphSchema, labelFromType } from '@roadboard/graph-db';


const prisma = new PrismaClient();
const graph = new GraphDbClient();


async function main() {

  console.log('Migrating CodeFlow graph: PostgreSQL → Memgraph');

  const ok = await graph.ping();

  if (!ok) {
    console.error('Memgraph unreachable at', process.env.GRAPH_DB_URL ?? 'bolt://localhost:7687');
    process.exit(1);
  }

  await applyGraphSchema(graph);
  console.log('  schema applied');

  // Reset Memgraph — this is a one-shot migration for Phase 1 of CF-GDB-03
  await graph.run('MATCH (n) DETACH DELETE n', {}, { mode: 'write' });
  console.log('  Memgraph wiped');

  const nodes = await prisma.architectureNode.findMany({ where: { isCurrent: true } });
  console.log(`  ${nodes.length} nodes from Postgres`);

  for (const n of nodes) {
    const label = labelFromType(n.type);
    await graph.run(
      `MERGE (x:${label} {id: $id})
       SET x.projectId = $projectId, x.type = $type, x.name = $name,
           x.path = $path, x.domainGroup = $domainGroup`,
      {
        id: n.id,
        projectId: n.projectId,
        type: n.type,
        name: n.name,
        path: n.path,
        domainGroup: n.domainGroup,
      },
      { mode: 'write' },
    );
  }

  const edges = await prisma.architectureEdge.findMany({ where: { isCurrent: true } });
  console.log(`  ${edges.length} edges from Postgres`);

  let edgeOk = 0;
  let edgeSkip = 0;

  for (const e of edges) {
    const relType = e.edgeType.toUpperCase();
    try {
      await graph.run(
        `MATCH (a {id: $fromId}), (b {id: $toId})
         MERGE (a)-[r:${relType} {id: $id}]->(b)
         SET r.projectId = $projectId, r.weight = $weight, r.edgeType = $edgeType`,
        {
          id: e.id,
          fromId: e.fromNodeId,
          toId: e.toNodeId,
          projectId: e.projectId,
          weight: e.weight,
          edgeType: e.edgeType,
        },
        { mode: 'write' },
      );
      edgeOk++;
    } catch {
      edgeSkip++;
    }
  }

  console.log(`  ${edgeOk} edges migrated, ${edgeSkip} skipped`);

  // Verify counts
  const [nRow] = await graph.run<{ count: number }>('MATCH (n) RETURN count(n) AS count');
  const [eRow] = await graph.run<{ count: number }>('MATCH ()-[r]->() RETURN count(r) AS count');
  console.log(`  Memgraph now holds: ${nRow?.count ?? 0} nodes, ${eRow?.count ?? 0} edges`);

  await graph.close();
}


main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
