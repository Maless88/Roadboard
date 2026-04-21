import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();


function slugFromUsername(username: string, fallback: string): string {

  const s = username.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

  return s || fallback;
}


async function main() {

  console.log('Backfilling personal teams for existing users...');

  const users = await prisma.user.findMany({
    select: { id: true, username: true, displayName: true },
    orderBy: { createdAt: 'asc' },
  });

  let createdTeams = 0;
  let createdMemberships = 0;
  let skippedTeams = 0;

  for (const user of users) {

    const slug = slugFromUsername(user.username, user.id);

    let team = await prisma.team.findUnique({ where: { slug } });

    if (team) {
      skippedTeams++;
    } else {
      team = await prisma.team.create({
        data: {
          name: `${user.displayName} (personal)`,
          slug,
          description: `Personal workspace for ${user.displayName}`,
        },
      });
      createdTeams++;
      console.log(`  + team created: ${team.slug}`);
    }

    const membership = await prisma.teamMembership.findUnique({
      where: { teamId_userId: { teamId: team.id, userId: user.id } },
    });

    if (!membership) {
      await prisma.teamMembership.create({
        data: {
          teamId: team.id,
          userId: user.id,
          role: 'admin',
          status: 'active',
        },
      });
      createdMemberships++;
      console.log(`  + membership created: ${user.username} -> ${team.slug}`);
    }
  }

  console.log(`Backfill complete: ${createdTeams} teams created, ${skippedTeams} skipped, ${createdMemberships} memberships created. Total users scanned: ${users.length}.`);
}


main()
  .catch((e) => {
    console.error('Backfill failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
