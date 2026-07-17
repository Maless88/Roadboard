import { TasksService } from './tasks.service';


function buildService(findManyImpl: (args: Record<string, unknown>) => Promise<unknown>) {

  const prisma = {
    task: {
      findMany: vi.fn(findManyImpl),
      count: vi.fn(async () => 7),
    },
  } as unknown;
  const audit = {} as unknown;
  return {
    service: new TasksService(prisma as never, audit as never),
    findMany: (prisma as { task: { findMany: ReturnType<typeof vi.fn> } }).task.findMany,
    count: (prisma as { task: { count: ReturnType<typeof vi.fn> } }).task.count,
  };
}


describe('TasksService.findAll', () => {

  it('legacy call without limit returns flat array with include', async () => {
    const fixtures = [{ id: 't1' }, { id: 't2' }];
    const { service, findMany } = buildService(async () => fixtures);

    const result = await service.findAll({ projectId: 'p1' });

    expect(result).toEqual(fixtures);
    const args = findMany.mock.calls[0][0] as Record<string, unknown>;
    expect(args.include).toBeDefined();
    expect(args.select).toBeUndefined();
    expect(args.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
  });


  it('compact=true uses select preset and excludes description', async () => {
    const { service, findMany } = buildService(async () => [{ id: 't1' }]);

    await service.findAll({ projectId: 'p1', compact: true });

    const args = findMany.mock.calls[0][0] as { select: Record<string, true> };
    expect(args.select.id).toBe(true);
    expect(args.select.title).toBe(true);
    expect(args.select.status).toBe(true);
    expect(args.select.description).toBeUndefined();
    expect(args.select.completionNotes).toBeUndefined();
  });


  it('explicit fields override compact preset', async () => {
    const { service, findMany } = buildService(async () => [{ id: 't1' }]);

    await service.findAll({ projectId: 'p1', fields: ['title', 'description'] });

    const args = findMany.mock.calls[0][0] as { select: Record<string, true> };
    expect(args.select.id).toBe(true);
    expect(args.select.title).toBe(true);
    expect(args.select.description).toBe(true);
    expect(args.select.priority).toBeUndefined();
  });


  it('limit triggers paginated response with nextCursor when more rows exist', async () => {
    const rows = Array.from({ length: 3 }, (_, i) => ({ id: `t${i + 1}` }));
    const { service, findMany } = buildService(async () => rows);

    const result = await service.findAll({ projectId: 'p1', limit: 2 });

    expect(findMany.mock.calls[0][0]).toMatchObject({ take: 3 });
    expect(result).toEqual({ items: [rows[0], rows[1]], nextCursor: 't2' });
  });


  it('limit returns nextCursor=null when fewer rows than limit+1', async () => {
    const rows = [{ id: 't1' }];
    const { service } = buildService(async () => rows);

    const result = await service.findAll({ projectId: 'p1', limit: 5 });

    expect(result).toEqual({ items: rows, nextCursor: null });
  });


  it('cursor is forwarded with skip:1', async () => {
    const { service, findMany } = buildService(async () => []);

    await service.findAll({ projectId: 'p1', limit: 10, cursor: 'tX' });

    const args = findMany.mock.calls[0][0] as Record<string, unknown>;
    expect(args.cursor).toEqual({ id: 'tX' });
    expect(args.skip).toBe(1);
  });


  it('statuses filter uses one global query with stable pagination', async () => {
    const rows = [
      { id: 't3', status: 'todo' },
      { id: 't2', status: 'in_progress' },
      { id: 't1', status: 'blocked' },
    ];
    const { service, findMany } = buildService(async () => rows);

    const result = await service.findAll({
      projectId: 'p1',
      statuses: ['todo', 'in_progress', 'blocked'],
      limit: 2,
      cursor: 't4',
      compact: true,
    });

    expect(findMany).toHaveBeenCalledTimes(1);
    const args = findMany.mock.calls[0][0] as Record<string, unknown>;
    expect(args.where).toMatchObject({
      projectId: 'p1',
      status: { in: ['todo', 'in_progress', 'blocked'] },
    });
    expect(args.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
    expect(args.cursor).toEqual({ id: 't4' });
    expect(args.skip).toBe(1);
    expect(args.take).toBe(3);
    expect(result).toEqual({ items: [rows[0], rows[1]], nextCursor: 't2' });
  });


  it('updatedSince adds gt filter and asc ordering', async () => {
    const { service, findMany } = buildService(async () => []);

    await service.findAll({ projectId: 'p1', updatedSince: '2026-01-01T00:00:00.000Z' });

    const args = findMany.mock.calls[0][0] as Record<string, unknown>;
    expect(args.where).toMatchObject({ projectId: 'p1' });
    expect((args.where as Record<string, unknown>).updatedAt).toEqual({
      gt: new Date('2026-01-01T00:00:00.000Z'),
    });
    expect(args.orderBy).toEqual([{ updatedAt: 'asc' }, { id: 'asc' }]);
  });
});


describe('TasksService.count', () => {

  it('counts with a single status filter', async () => {
    const { service, count } = buildService(async () => []);

    const result = await service.count({ projectId: 'p1', status: 'todo' });

    expect(result).toBe(7);
    expect(count).toHaveBeenCalledWith({
      where: {
        projectId: 'p1',
        status: 'todo',
      },
    });
  });


  it('counts multiple statuses with one Prisma in filter', async () => {
    const { service, count } = buildService(async () => []);

    await service.count({ projectId: 'p1', statuses: ['todo', 'blocked'] });

    expect(count).toHaveBeenCalledTimes(1);
    expect(count).toHaveBeenCalledWith({
      where: {
        projectId: 'p1',
        status: { in: ['todo', 'blocked'] },
      },
    });
  });


  it('rejects status combined with statuses', async () => {
    const { service, count } = buildService(async () => []);

    await expect(service.count({ projectId: 'p1', status: 'todo', statuses: ['blocked'] }))
      .rejects.toThrow('Use either status or statuses');
    expect(count).not.toHaveBeenCalled();
  });


  it('rejects empty statuses', async () => {
    const { service, count } = buildService(async () => []);

    await expect(service.count({ projectId: 'p1', statuses: [] }))
      .rejects.toThrow('statuses must contain at least one status');
    expect(count).not.toHaveBeenCalled();
  });


  it('rejects unknown status values before counting', async () => {
    const { service, count } = buildService(async () => []);

    await expect(service.count({ projectId: 'p1', statuses: ['not-a-status' as never] }))
      .rejects.toThrow('statuses contains an invalid task status');
    expect(count).not.toHaveBeenCalled();
  });
});


const MOCK_USER = {
  userId: 'u1',
  username: 'tester',
  displayName: 'Tester',
  sessionId: 'sess',
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  source: 'web',
};


function buildCreateService(existing: { id: string; projectId: string } | null) {

  const prisma = {
    task: {
      findUnique: vi.fn(async () => existing),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: data.id ?? 'generated-id',
        projectId: data.projectId,
        phaseId: data.phaseId,
        title: data.title,
      })),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({
        id: where.id,
        projectId: existing?.projectId,
        phaseId: data.phaseId,
        title: data.title,
      })),
      findMany: vi.fn(async () => []),
    },
    phase: { findMany: vi.fn(async () => []), update: vi.fn(async () => ({})) },
    project: { findUnique: vi.fn(async () => ({ status: 'active' })), update: vi.fn(async () => ({})) },
  };
  const audit = { recordForUser: vi.fn(async () => ({ id: 'evt' })) };
  return { service: new TasksService(prisma as never, audit as never), prisma, audit };
}


describe('TasksService.create with client-provided id', () => {

  it('creates a new row with the provided id when none exists', async () => {

    const { service, prisma, audit } = buildCreateService(null);

    const result = await service.create(
      { id: 'task-1', projectId: 'p1', phaseId: 'ph1', title: 'T' } as never,
      MOCK_USER as never,
    );

    expect(prisma.task.create).toHaveBeenCalledOnce();
    const data = prisma.task.create.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.id).toBe('task-1');
    expect(data.createdByUserId).toBe('u1');
    expect(result.id).toBe('task-1');
    expect(audit.recordForUser).toHaveBeenCalledWith(
      MOCK_USER, 'task.created', 'task', 'task-1', 'p1', expect.any(Object),
    );
  });


  it('updates the existing row without touching createdByUserId', async () => {

    const { service, prisma, audit } = buildCreateService({ id: 'task-1', projectId: 'p1' });

    await service.create(
      { id: 'task-1', projectId: 'p1', phaseId: 'ph2', title: 'Updated' } as never,
      MOCK_USER as never,
    );

    expect(prisma.task.create).not.toHaveBeenCalled();
    expect(prisma.task.update).toHaveBeenCalledOnce();
    const data = prisma.task.update.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.title).toBe('Updated');
    expect(data.createdByUserId).toBeUndefined();
    expect(data.updatedByUserId).toBe('u1');
    expect(audit.recordForUser).toHaveBeenCalledWith(
      MOCK_USER, 'task.updated', 'task', 'task-1', 'p1', expect.any(Object),
    );
  });


  it('rejects with 409 when the id belongs to another project', async () => {

    const { service, prisma } = buildCreateService({ id: 'task-1', projectId: 'other' });

    await expect(
      service.create(
        { id: 'task-1', projectId: 'p1', phaseId: 'ph1', title: 'T' } as never,
        MOCK_USER as never,
      ),
    ).rejects.toThrow();

    expect(prisma.task.create).not.toHaveBeenCalled();
    expect(prisma.task.update).not.toHaveBeenCalled();
  });
});
