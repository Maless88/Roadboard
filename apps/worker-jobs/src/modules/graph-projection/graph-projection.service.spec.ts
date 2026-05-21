import { Test } from '@nestjs/testing';
import { GraphProjectionService } from './graph-projection.service';


/**
 * Unit tests for GraphProjectionService.checkBacklogAlert.
 *
 * We stub out PrismaClient and GraphDbClient at the class level so the
 * service constructor never tries to open real connections.
 */

vi.mock('@roadboard/database', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    graphSyncEvent: { count: vi.fn() },
    $disconnect: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('@roadboard/graph-db', () => ({
  GraphDbClient: vi.fn().mockImplementation(() => ({
    ping: vi.fn().mockResolvedValue(false),
    close: vi.fn().mockResolvedValue(undefined),
  })),
  applyGraphSchema: vi.fn().mockResolvedValue(undefined),
  labelFromType: vi.fn((t: string) => t),
}));

vi.mock('@roadboard/config', () => ({
  optionalEnv: vi.fn().mockReturnValue('false'),
}));


function buildService(): GraphProjectionService {

  return new GraphProjectionService();
}


describe('GraphProjectionService.checkBacklogAlert', () => {

  it('returns counts and does NOT warn when backlog <= 50', async () => {

    const svc = buildService();
    const warnSpy = vi.spyOn((svc as unknown as { logger: { warn: () => void } }).logger, 'warn');

    const prisma = (svc as unknown as { prisma: { graphSyncEvent: { count: ReturnType<typeof vi.fn> } } }).prisma;
    prisma.graphSyncEvent.count
      .mockResolvedValueOnce(20)   // pending
      .mockResolvedValueOnce(10);  // dead

    const result = await svc.checkBacklogAlert();

    expect(result).toEqual({ pending: 20, dead: 10, backlog: 30 });
    expect(warnSpy).not.toHaveBeenCalled();
  });


  it('emits a structured warn log when backlog > 50', async () => {

    const svc = buildService();
    const warnSpy = vi.spyOn((svc as unknown as { logger: { warn: (obj: unknown) => void } }).logger, 'warn');

    const prisma = (svc as unknown as { prisma: { graphSyncEvent: { count: ReturnType<typeof vi.fn> } } }).prisma;
    prisma.graphSyncEvent.count
      .mockResolvedValueOnce(40)   // pending
      .mockResolvedValueOnce(20);  // dead

    const result = await svc.checkBacklogAlert();

    expect(result).toEqual({ pending: 40, dead: 20, backlog: 60 });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: 'graph_sync_backlog_high',
        backlog: 60,
        threshold: 50,
      }),
    );
  });


  it('warns exactly at threshold + 1 (boundary: 51)', async () => {

    const svc = buildService();
    const warnSpy = vi.spyOn((svc as unknown as { logger: { warn: (obj: unknown) => void } }).logger, 'warn');

    const prisma = (svc as unknown as { prisma: { graphSyncEvent: { count: ReturnType<typeof vi.fn> } } }).prisma;
    prisma.graphSyncEvent.count
      .mockResolvedValueOnce(51)
      .mockResolvedValueOnce(0);

    await svc.checkBacklogAlert();

    expect(warnSpy).toHaveBeenCalledOnce();
  });


  it('does NOT warn at exactly threshold (50)', async () => {

    const svc = buildService();
    const warnSpy = vi.spyOn((svc as unknown as { logger: { warn: () => void } }).logger, 'warn');

    const prisma = (svc as unknown as { prisma: { graphSyncEvent: { count: ReturnType<typeof vi.fn> } } }).prisma;
    prisma.graphSyncEvent.count
      .mockResolvedValueOnce(50)
      .mockResolvedValueOnce(0);

    await svc.checkBacklogAlert();

    expect(warnSpy).not.toHaveBeenCalled();
  });
});
