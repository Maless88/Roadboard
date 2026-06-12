import { DecisionsService } from './decisions.service';


function buildService(findManyImpl: (args: Record<string, unknown>) => Promise<unknown>) {

  const prisma = { decision: { findMany: vi.fn(findManyImpl) } } as unknown;
  return {
    service: new DecisionsService(prisma as never, {} as never),
    findMany: (prisma as { decision: { findMany: ReturnType<typeof vi.fn> } }).decision.findMany,
  };
}


describe('DecisionsService.findAll', () => {

  it('default call uses createdAt desc ordering and no updatedAt filter', async () => {
    const { service, findMany } = buildService(async () => []);

    await service.findAll({ projectId: 'p1' });

    const args = findMany.mock.calls[0][0] as Record<string, unknown>;
    expect(args.orderBy).toEqual({ createdAt: 'desc' });
    expect((args.where as Record<string, unknown>).updatedAt).toBeUndefined();
  });


  it('updatedSince adds gt filter and asc ordering', async () => {
    const { service, findMany } = buildService(async () => []);

    await service.findAll({ projectId: 'p1', updatedSince: '2026-01-01T00:00:00.000Z' });

    const args = findMany.mock.calls[0][0] as Record<string, unknown>;
    expect((args.where as Record<string, unknown>).updatedAt).toEqual({
      gt: new Date('2026-01-01T00:00:00.000Z'),
    });
    expect(args.orderBy).toEqual([{ updatedAt: 'asc' }, { id: 'asc' }]);
  });


  it('limit triggers paginated response with nextCursor when more rows exist', async () => {
    const rows = [{ id: 'd1' }, { id: 'd2' }, { id: 'd3' }];
    const { service, findMany } = buildService(async () => rows);

    const result = await service.findAll({ projectId: 'p1', limit: 2 });

    expect(findMany.mock.calls[0][0]).toMatchObject({ take: 3 });
    expect(result).toEqual({ items: [rows[0], rows[1]], nextCursor: 'd2' });
  });


  it('cursor is forwarded with skip:1', async () => {
    const { service, findMany } = buildService(async () => []);

    await service.findAll({ projectId: 'p1', limit: 10, cursor: 'dX' });

    const args = findMany.mock.calls[0][0] as Record<string, unknown>;
    expect(args.cursor).toEqual({ id: 'dX' });
    expect(args.skip).toBe(1);
  });
});
