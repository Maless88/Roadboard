import { PhasesService } from './phases.service';


function buildService(findManyImpl: (args: Record<string, unknown>) => Promise<unknown>) {

  const prisma = { phase: { findMany: vi.fn(findManyImpl) } } as unknown;
  const audit = {} as unknown;
  return {
    service: new PhasesService(prisma as never, audit as never),
    findMany: (prisma as { phase: { findMany: ReturnType<typeof vi.fn> } }).phase.findMany,
  };
}


describe('PhasesService.findAll', () => {

  it('filters phases by status at query level while paginating', async () => {
    const rows = [
      { id: 'p2', status: 'in_progress' },
      { id: 'p1', status: 'in_progress' },
    ];
    const { service, findMany } = buildService(async () => rows);

    const result = await service.findAll({
      projectId: 'project-1',
      status: 'in_progress',
      limit: 1,
      cursor: 'p3',
    });

    expect(findMany).toHaveBeenCalledTimes(1);
    const args = findMany.mock.calls[0][0] as Record<string, unknown>;
    expect(args.where).toMatchObject({
      projectId: 'project-1',
      status: 'in_progress',
    });
    expect(args.cursor).toEqual({ id: 'p3' });
    expect(args.skip).toBe(1);
    expect(args.take).toBe(2);
    expect(result).toEqual({ items: [rows[0]], nextCursor: 'p2' });
  });
});
