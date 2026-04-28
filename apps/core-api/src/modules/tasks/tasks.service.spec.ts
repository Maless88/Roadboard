import { TasksService } from './tasks.service';


function buildService(findManyImpl: (args: Record<string, unknown>) => Promise<unknown>) {

  const prisma = { task: { findMany: vi.fn(findManyImpl) } } as unknown;
  const audit = {} as unknown;
  return {
    service: new TasksService(prisma as never, audit as never),
    findMany: (prisma as { task: { findMany: ReturnType<typeof vi.fn> } }).task.findMany,
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
});
