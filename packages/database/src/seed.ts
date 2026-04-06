import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

  console.log('Seed completed successfully.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
