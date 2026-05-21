import { ProjectsService } from './projects.service';
import type { AuthUser } from '../../common/auth-user';


const MOCK_USER: AuthUser = {
  userId: 'u1',
  username: 'tester',
  displayName: 'Tester',
  sessionId: 'sess',
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  source: 'web',
};


function makePrisma() {
  return {
    project: {
      create: vi.fn().mockResolvedValue({
        id: 'p1', name: 'demo', slug: 'demo', status: 'active',
        ownerTeamId: 't1', ownerUserId: 'u1',
      }),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    projectGrant: { create: vi.fn().mockResolvedValue({}) },
    projectUserArchive: { upsert: vi.fn(), deleteMany: vi.fn() },
    team: { findUnique: vi.fn() },
  };
}


describe('ProjectsService audit coverage', () => {

  it('create emits project.created via auditService.recordForUser', async () => {

    const prisma = makePrisma();
    const audit = { recordForUser: vi.fn().mockResolvedValue({ id: 'evt' }) };
    const service = new ProjectsService(prisma as never, audit as never);

    await service.create(
      { name: 'demo', slug: 'demo', ownerTeamId: 't1', status: 'active' } as never,
      MOCK_USER,
    );

    expect(audit.recordForUser).toHaveBeenCalledWith(
      MOCK_USER,
      'project.created',
      'project',
      'p1',
      'p1',
      expect.objectContaining({ name: 'demo', slug: 'demo', ownerTeamId: 't1' }),
    );
  });


  it('archiveForUser emits project.archived with scope=per_user', async () => {

    const prisma = makePrisma();
    prisma.project.findUnique.mockResolvedValue({ id: 'p1' });
    prisma.projectUserArchive.upsert.mockResolvedValue({});
    const audit = { recordForUser: vi.fn().mockResolvedValue({ id: 'evt' }) };
    const service = new ProjectsService(prisma as never, audit as never);

    await service.archiveForUser('p1', MOCK_USER);

    expect(audit.recordForUser).toHaveBeenCalledWith(
      MOCK_USER,
      'project.archived',
      'project',
      'p1',
      'p1',
      { scope: 'per_user' },
    );
  });


  it('delete emits project.deleted with name/slug snapshot', async () => {

    const prisma = makePrisma();
    prisma.project.findUnique.mockResolvedValue({
      id: 'p1', name: 'demo', slug: 'demo', ownerUserId: 'u1',
    });
    prisma.project.delete.mockResolvedValue({ id: 'p1' });
    const audit = { recordForUser: vi.fn().mockResolvedValue({ id: 'evt' }) };
    const service = new ProjectsService(prisma as never, audit as never);

    await service.delete('p1', MOCK_USER);

    expect(audit.recordForUser).toHaveBeenCalledWith(
      MOCK_USER,
      'project.deleted',
      'project',
      'p1',
      'p1',
      expect.objectContaining({ name: 'demo' }),
    );
  });
});
