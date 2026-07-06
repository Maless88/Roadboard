import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();


async function main() {
  console.log('Seeding Roadboard database...');

  const { hashPassword } = await import('@roadboard/auth');

  const rawPassword = process.env.SEED_ADMIN_PASSWORD;

  if (!rawPassword) {
    throw new Error('SEED_ADMIN_PASSWORD env var is required — never hardcode passwords in seed files.');
  }

  const defaultPassword = await hashPassword(rawPassword);

  // Idempotent bootstrap: never attempt an INSERT when the admin already exists.
  // Prisma upsert compiles to INSERT ... ON CONFLICT (username), whose arbiter
  // does NOT cover the unique `email`, so re-seeding an existing admin raised
  // P2002 on email. Match by username OR email, then create only if absent.
  const existingAdmin = await prisma.user.findFirst({
    where: { OR: [{ username: 'admin' }, { email: 'admin@roadboard.dev' }] },
  });

  const admin = existingAdmin
    ? existingAdmin.role === 'admin'
      ? existingAdmin
      : await prisma.user.update({
          where: { id: existingAdmin.id },
          data: { role: 'admin' },
        })
    : await prisma.user.create({
        data: {
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
