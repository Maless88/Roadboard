import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();


async function ensurePhase(data: {
  projectId: string;
  title: string;
  description?: string;
  orderIndex?: number;
  status?: string;
}) {

  const existing = await prisma.phase.findFirst({
    where: { projectId: data.projectId, title: data.title },
  });

  if (existing) {
    return existing;
  }

  return prisma.phase.create({
    data: {
      projectId: data.projectId,
      title: data.title,
      description: data.description,
      orderIndex: data.orderIndex ?? 0,
      status: data.status ?? 'planned',
    },
  });
}


async function ensureTask(data: {
  projectId: string;
  phaseId: string;
  title: string;
  description?: string;
  status?: string;
  priority?: string;
}) {

  const existing = await prisma.task.findFirst({
    where: { projectId: data.projectId, title: data.title },
  });

  if (existing) {
    return existing;
  }

  return prisma.task.create({
    data: {
      projectId: data.projectId,
      phaseId: data.phaseId,
      title: data.title,
      description: data.description,
      status: data.status ?? 'todo',
      priority: data.priority ?? 'medium',
    },
  });
}


async function ensureMemoryEntry(data: {
  projectId: string;
  type: string;
  title: string;
  body?: string;
}) {

  const existing = await prisma.memoryEntry.findFirst({
    where: {
      projectId: data.projectId,
      type: data.type,
      title: data.title,
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.memoryEntry.create({
    data,
  });
}

async function main() {
  console.log('Seeding Roadboard database...');

  // We import hash dynamically since this is a seed script
  const { hashPassword } = await import('@roadboard/auth');

  const defaultPassword = await hashPassword('roadboard2025');

  // ── Users ────────────────────────────────────────
  const users = await Promise.all([
    prisma.user.upsert({
      where: { username: 'serena' },
      update: {},
      create: {
        username: 'serena',
        displayName: 'Serena',
        email: 'serena@roadboard.dev',
        password: defaultPassword,
        status: 'active',
      },
    }),
    prisma.user.upsert({
      where: { username: 'alessio' },
      update: {},
      create: {
        username: 'alessio',
        displayName: 'Alessio',
        email: 'alessio@roadboard.dev',
        password: defaultPassword,
        status: 'active',
      },
    }),
    prisma.user.upsert({
      where: { username: 'dev3' },
      update: {},
      create: {
        username: 'dev3',
        displayName: 'Developer 3',
        email: 'dev3@roadboard.dev',
        password: defaultPassword,
        status: 'active',
      },
    }),
    prisma.user.upsert({
      where: { username: 'dev4' },
      update: {},
      create: {
        username: 'dev4',
        displayName: 'Developer 4',
        email: 'dev4@roadboard.dev',
        password: defaultPassword,
        status: 'active',
      },
    }),
  ]);

  console.log(`Created ${users.length} users`);

  // ── Team ─────────────────────────────────────────
  const team = await prisma.team.upsert({
    where: { slug: 'core-team' },
    update: {},
    create: {
      name: 'Core Team',
      slug: 'core-team',
      description: 'Roadboard 2.0 founding development team',
    },
  });

  console.log(`Created team: ${team.name}`);

  // ── Memberships ──────────────────────────────────
  for (const user of users) {
    await prisma.teamMembership.upsert({
      where: {
        teamId_userId: { teamId: team.id, userId: user.id },
      },
      update: {},
      create: {
        teamId: team.id,
        userId: user.id,
        role: user.username === 'serena' || user.username === 'alessio' ? 'admin' : 'member',
        status: 'active',
      },
    });
  }

  console.log(`Created ${users.length} team memberships`);

  // ── Project ──────────────────────────────────────
  const project = await prisma.project.upsert({
    where: { slug: 'roadboard-2' },
    update: {},
    create: {
      name: 'Roadboard 2.0',
      slug: 'roadboard-2',
      description: 'Multi-project execution, memory, and collaboration platform',
      status: 'active',
      ownerTeamId: team.id,
    },
  });

  console.log(`Created project: ${project.name}`);

  // ── Team Grant ───────────────────────────────────
  await prisma.projectGrant.upsert({
    where: {
      id: `grant-${team.id}-${project.id}-admin`,
    },
    update: {},
    create: {
      id: `grant-${team.id}-${project.id}-admin`,
      projectId: project.id,
      subjectType: 'team',
      subjectId: team.id,
      grantType: 'project.admin',
      grantedByUserId: users[0]!.id,
    },
  });

  console.log('Created team project grant (project.admin)');

  // ── Onboarding phase, tasks, and memory ─────────
  const wave2Phase = await ensurePhase({
    projectId: project.id,
    title: 'Wave 2 — Platform Hardening',
    description: 'Local developer experience, MCP integration, and operational stability.',
    orderIndex: 0,
    status: 'completed',
  });

  await ensureTask({
    projectId: project.id,
    phaseId: wave2Phase.id,
    title: 'Wave 2 — OpenAPI docs for core-api and auth-access',
    description: 'Expose Swagger/OpenAPI docs on both backend APIs.',
    status: 'done',
    priority: 'high',
  });
  await ensureTask({
    projectId: project.id,
    phaseId: wave2Phase.id,
    title: 'Wave 2 — Full local Docker Compose stack',
    description: 'Run the full local stack with Postgres, Redis, APIs, MCP service, worker, sync bridge, and web app.',
    status: 'done',
    priority: 'high',
  });
  await ensureTask({
    projectId: project.id,
    phaseId: wave2Phase.id,
    title: 'Wave 2 — Health endpoints for mcp-service and web-app',
    description: 'Expose unauthenticated health endpoints and wire them into the local stack.',
    status: 'done',
    priority: 'medium',
  });
  await ensureTask({
    projectId: project.id,
    phaseId: wave2Phase.id,
    title: 'Wave 2 — Improve onboarding seed data',
    description: 'Seed a stable initial project, tasks, and memory so a fresh bootstrap is immediately usable.',
    status: 'done',
    priority: 'medium',
  });
  await ensureTask({
    projectId: project.id,
    phaseId: wave2Phase.id,
    title: 'Wave 2 — Normalize API validation and error reporting',
    description: 'Add consistent request validation and uniform HTTP error payloads across backend services.',
    status: 'done',
    priority: 'medium',
  });

  await ensureMemoryEntry({
    projectId: project.id,
    type: 'operational_note',
    title: 'Local onboarding defaults',
    body: [
      'Default local users:',
      '- alessio / roadboard2025',
      '- serena / roadboard2025',
      '- dev3 / roadboard2025',
      '- dev4 / roadboard2025',
      '',
      'Default local endpoints:',
      '- web-app: http://127.0.0.1:3000',
      '- core-api: http://127.0.0.1:3001',
      '- auth-access: http://127.0.0.1:3002',
      '- worker-jobs: http://127.0.0.1:3003',
      '- local-sync-bridge: http://127.0.0.1:3004',
      '- mcp-service HTTP: http://127.0.0.1:3005/mcp',
      '',
      'The project backlog is seeded to reflect the current Wave 2 completion state.',
    ].join('\n'),
  });

  await ensureMemoryEntry({
    projectId: project.id,
    type: 'done',
    title: 'OpenAPI docs enabled for core-api and auth-access',
    body: [
      'Swagger/OpenAPI docs are enabled on both backend APIs.',
      '- core-api: /docs and /docs-json',
      '- auth-access: /docs and /docs-json',
    ].join('\n'),
  });

  await ensureMemoryEntry({
    projectId: project.id,
    type: 'done',
    title: 'Wave 2 local compose stack validated',
    body: [
      'The full local Docker Compose stack is validated and runs end-to-end.',
      'Services included: postgres, redis, core-api, auth-access, worker-jobs, local-sync-bridge, mcp-service, and web-app.',
    ].join('\n'),
  });

  await ensureMemoryEntry({
    projectId: project.id,
    type: 'done',
    title: 'Validation and HTTP error payloads normalized',
    body: [
      'core-api and auth-access now use global request validation and a shared HTTP error shape.',
      'Validation failures return a stable payload with message, error, statusCode, path, timestamp, and field-level details.',
    ].join('\n'),
  });

  console.log('Seed completed successfully.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
