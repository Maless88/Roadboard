import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();


async function main() {
  console.log('Seeding Roadboard database...');

  const { hashPassword } = await import('@roadboard/auth');

  const defaultPassword = await hashPassword('***REDACTED***');

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: { role: 'admin' },
    create: {
      username: 'admin',
      displayName: 'Admin',
      email: 'admin@roadboard.dev',
      password: defaultPassword,
      role: 'admin',
      status: 'active',
    },
  });

  console.log(`Created admin user: ${admin.username}`);

  const team = await prisma.team.upsert({
    where: { slug: 'core-team' },
    update: {},
    create: {
      name: 'Core Team',
      slug: 'core-team',
      description: 'Default team',
    },
  });

  console.log(`Created team: ${team.name}`);

  await prisma.teamMembership.upsert({
    where: {
      teamId_userId: { teamId: team.id, userId: admin.id },
    },
    update: {},
    create: {
      teamId: team.id,
      userId: admin.id,
      role: 'admin',
      status: 'active',
    },
  });

  console.log('Seed completed: bare bootstrap (1 admin user + 1 team, no projects).');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
