import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();


async function main() {
  console.log('Seeding Roadboard database...');

  const { hashPassword } = await import('@roadboard/auth');

  const defaultPassword = await hashPassword('***REDACTED***');

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
      update: { role: 'admin' },
      create: {
        username: 'alessio',
        displayName: 'Alessio',
        email: 'alessio@roadboard.dev',
        password: defaultPassword,
        role: 'admin',
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
  console.log('Seed completed: bare bootstrap (users + team only, no projects).');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
