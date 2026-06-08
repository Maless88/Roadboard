import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { GraphDbClient, applyGraphSchema, labelFromType } from '@roadboard/graph-db';


const prisma = new PrismaClient();
const graph = new GraphDbClient();

const REPO_ROOT = resolve(__dirname, '../../..');
const DEFAULT_PROJECT_SLUG = 'roadboard-2';


interface Workspace {
  type: 'app' | 'package';
  shortName: string;
  pkgName: string;
  path: string;
  deps: string[];
}


function readWorkspace(type: 'app' | 'package', dirName: string): Workspace | null {

  const path = `${type === 'app' ? 'apps' : 'packages'}/${dirName}`;
  const pkgPath = join(REPO_ROOT, path, 'package.json');
  let pkg: { name?: string; dependencies?: Record<string, string>; devDependencies?: Record<string, string> };

  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as typeof pkg;
  } catch {
    return null;
  }

  if (!pkg.name) return null;

  const deps = [
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
  ].filter((d) => d.startsWith('@roadboard/'));

  return {
    type,
    shortName: dirName,
    pkgName: pkg.name,
    path,
    deps,
  };
}


function discoverWorkspaces(): Workspace[] {

  const workspaces: Workspace[] = [];

  for (const dir of readdirSync(join(REPO_ROOT, 'apps'))) {
    const ws = readWorkspace('app', dir);
    if (ws) workspaces.push(ws);
  }

  for (const dir of readdirSync(join(REPO_ROOT, 'packages'))) {
    const ws = readWorkspace('package', dir);
    if (ws) workspaces.push(ws);
  }

  return workspaces;
}


async function main() {

  const projectSlug = process.env.PROJECT_SLUG ?? DEFAULT_PROJECT_SLUG;
  console.log(`Seeding CodeFlow graph for project slug="${projectSlug}"...`);

  const project = await prisma.project.findUnique({ where: { slug: projectSlug } });

  if (!project) {
    console.error(`Project with slug="${projectSlug}" not found.`);
    process.exit(1);
  }

  const workspaces = discoverWorkspaces();
  console.log(`Discovered ${workspaces.length} workspaces (${workspaces.filter((w) => w.type === 'app').length} apps, ${workspaces.filter((w) => w.type === 'package').length} packages).`);

  // Memgraph is the sole source of truth for the architecture graph
  // (nodes/edges/links/annotations). The relational tables retained are the
  // scan metadata (architectureSnapshot) and codeRepository.
  await applyGraphSchema(graph);

  // Idempotent reset: wipe previous CodeFlow data for this project.
  // Graph entities live in Memgraph; scan metadata in Postgres.
  await graph.run(
    'MATCH (n {projectId: $projectId}) DETACH DELETE n',
    { projectId: project.id },
    { mode: 'write' },
  );
  await prisma.architectureSnapshot.deleteMany({ where: { projectId: project.id } });
  await prisma.codeRepository.deleteMany({ where: { projectId: project.id } });

  const repo = await prisma.codeRepository.create({
    data: {
      projectId: project.id,
      name: 'roadboard-monorepo',
      repoUrl: 'local://roadboard',
      provider: 'manual',
      defaultBranch: 'main',
    },
  });

  const snapshot = await prisma.architectureSnapshot.create({
    data: {
      projectId: project.id,
      repositoryId: repo.id,
      status: 'completed',
      scanType: 'manual',
      completedAt: new Date(),
    },
  });

  const now = new Date().toISOString();

  // Create all nodes first so we can look them up by pkgName when creating edges
  const nodesByPkgName = new Map<string, string>(); // pkgName -> nodeId

  for (const ws of workspaces) {
    const nodeId = randomUUID();
    const label = labelFromType(ws.type);

    await graph.run(
      `MERGE (n:${label} {id: $id})
       SET n.projectId = $projectId,
           n.type = $type,
           n.name = $name,
           n.path = $path,
           n.description = $description,
           n.metadata = $metadata,
           n.isManual = $isManual,
           n.isCurrent = $isCurrent,
           n.createdAt = $createdAt,
           n.updatedAt = $updatedAt`,
      {
        id: nodeId,
        projectId: project.id,
        type: ws.type,
        name: ws.shortName,
        path: ws.path,
        description: ws.pkgName,
        metadata: JSON.stringify({}),
        isManual: false,
        isCurrent: true,
        createdAt: now,
        updatedAt: now,
      },
      { mode: 'write' },
    );
    nodesByPkgName.set(ws.pkgName, nodeId);
    console.log(`  + node ${ws.type}:${ws.shortName} (${ws.pkgName})`);
  }

  // Create edges for workspace-internal depends_on relations
  let edgeCount = 0;

  for (const ws of workspaces) {
    const fromId = nodesByPkgName.get(ws.pkgName);

    if (!fromId) continue;

    for (const dep of ws.deps) {
      const toId = nodesByPkgName.get(dep);

      if (!toId || toId === fromId) continue;

      await graph.run(
        `MATCH (a {id: $fromId}), (b {id: $toId})
         MERGE (a)-[r:DEPENDS_ON {id: $id}]->(b)
         SET r.projectId = $projectId,
             r.edgeType = 'depends_on',
             r.weight = $weight,
             r.isManual = $isManual,
             r.isCurrent = $isCurrent,
             r.createdAt = $createdAt`,
        {
          id: randomUUID(),
          fromId,
          toId,
          projectId: project.id,
          weight: 1.0,
          isManual: false,
          isCurrent: true,
          createdAt: now,
        },
        { mode: 'write' },
      );
      edgeCount++;
    }
  }

  console.log(`Seed complete: 1 repository, 1 snapshot (${snapshot.id}), ${workspaces.length} nodes, ${edgeCount} edges (Memgraph).`);
}


main()
  .catch((e) => {
    console.error('Seed CodeFlow failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await graph.close().catch(() => undefined);
  });
