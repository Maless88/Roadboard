import { PrismaClient } from '@prisma/client';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';


const prisma = new PrismaClient();

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

  // Idempotent reset: wipe previous CodeFlow data for this project
  await prisma.architectureEdge.deleteMany({ where: { projectId: project.id } });
  await prisma.architectureLink.deleteMany({ where: { projectId: project.id } });
  await prisma.architectureAnnotation.deleteMany({ where: { projectId: project.id } });
  await prisma.architectureNode.deleteMany({ where: { projectId: project.id } });
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

  // Create all nodes first so we can look them up by pkgName when creating edges
  const nodesByPkgName = new Map<string, string>(); // pkgName -> nodeId

  for (const ws of workspaces) {
    const node = await prisma.architectureNode.create({
      data: {
        projectId: project.id,
        repositoryId: repo.id,
        snapshotId: snapshot.id,
        type: ws.type,
        name: ws.shortName,
        path: ws.path,
        description: ws.pkgName,
        isManual: false,
        isCurrent: true,
      },
    });
    nodesByPkgName.set(ws.pkgName, node.id);
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

      await prisma.architectureEdge.create({
        data: {
          projectId: project.id,
          snapshotId: snapshot.id,
          fromNodeId: fromId,
          toNodeId: toId,
          edgeType: 'depends_on',
          weight: 1.0,
          isManual: false,
          isCurrent: true,
        },
      });
      edgeCount++;
    }
  }

  console.log(`Seed complete: 1 repository, 1 snapshot, ${workspaces.length} nodes, ${edgeCount} edges.`);
}


main()
  .catch((e) => {
    console.error('Seed CodeFlow failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
