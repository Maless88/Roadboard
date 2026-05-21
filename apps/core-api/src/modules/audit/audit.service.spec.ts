import { AuditService } from './audit.service';


interface PrismaMock {
  activityEvent: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
}


function makePrisma(): PrismaMock {
  return {
    activityEvent: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
  };
}


describe('AuditService.findByProject filters', () => {

  let prisma: PrismaMock;
  let service: AuditService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new AuditService(prisma as never);
  });


  it('applies actorType filter', async () => {
    await service.findByProject('p1', 50, 0, { actorType: 'mcp_token' });

    const args = prisma.activityEvent.findMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(args.where.projectId).toBe('p1');
    expect(args.where.actorType).toBe('mcp_token');
  });


  it('applies dateFrom and dateTo to createdAt range', async () => {
    const from = '2026-01-01T00:00:00.000Z';
    const to = '2026-02-01T00:00:00.000Z';

    await service.findByProject('p1', 50, 0, { dateFrom: from, dateTo: to });

    const args = prisma.activityEvent.findMany.mock.calls[0][0] as {
      where: { createdAt?: { gte?: Date; lte?: Date } };
    };

    expect(args.where.createdAt?.gte).toEqual(new Date(from));
    expect(args.where.createdAt?.lte).toEqual(new Date(to));
  });


  it('ignores invalid date strings', async () => {
    await service.findByProject('p1', 50, 0, { dateFrom: 'not-a-date' });

    const args = prisma.activityEvent.findMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(args.where.createdAt).toBeUndefined();
  });


  it('combines actorType + dateFrom + eventType filters', async () => {
    await service.findByProject('p1', 50, 0, {
      actorType: 'user',
      dateFrom: '2026-01-01T00:00:00.000Z',
      eventType: 'project.created',
    });

    const args = prisma.activityEvent.findMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(args.where.actorType).toBe('user');
    expect(args.where.eventType).toBe('project.created');
    expect((args.where.createdAt as { gte: Date }).gte).toEqual(new Date('2026-01-01T00:00:00.000Z'));
  });


  it('returns pagination metadata { events, total, take, skip }', async () => {
    prisma.activityEvent.findMany.mockResolvedValue([{ id: 'e1' }]);
    prisma.activityEvent.count.mockResolvedValue(42);

    const result = await service.findByProject('p1', 10, 5, {});

    expect(result).toEqual({
      events: [{ id: 'e1' }],
      total: 42,
      take: 10,
      skip: 5,
    });
  });
});


describe('AuditService.recordForUser', () => {

  it('writes ActivityEvent with actorType=user and propagates source from AuthUser', async () => {
    const prisma = makePrisma();
    prisma.activityEvent.create.mockResolvedValue({ id: 'evt' });
    const service = new AuditService(prisma as never);

    await service.recordForUser(
      {
        userId: 'u1',
        username: 'tester',
        displayName: 'Tester',
        sessionId: 's',
        expiresAt: new Date().toISOString(),
        source: 'mcp',
      },
      'project.created',
      'project',
      'p1',
      'p1',
      { name: 'demo' },
    );

    expect(prisma.activityEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorType: 'user',
        actorId: 'u1',
        actorUserId: 'u1',
        source: 'mcp',
        eventType: 'project.created',
        targetType: 'project',
        targetId: 'p1',
        projectId: 'p1',
        metadata: { name: 'demo' },
      }),
    });
  });
});
