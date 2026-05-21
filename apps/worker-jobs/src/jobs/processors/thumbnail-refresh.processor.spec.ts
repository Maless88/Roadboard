import { describe, it, expect, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

import { ThumbnailRefreshProcessor } from './thumbnail-refresh.processor';


function fakePrisma(initial: Record<string, unknown>) {

  const updates: Array<Record<string, unknown>> = [];

  return {
    project: {
      findUnique: vi.fn().mockResolvedValue(initial),
      update: vi.fn().mockImplementation(async (args: { where: unknown; data: Record<string, unknown> }) => {
        updates.push(args.data);
        return { ...initial, ...args.data };
      }),
    },
    __updates: updates,
  };
}


describe('ThumbnailRefreshProcessor', () => {

  it('skips when project has no homeUrl', async () => {

    const prisma = fakePrisma({ id: 'p1', homeUrl: null, thumbnailManualUpload: false, thumbnailUrl: null });
    const launch = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proc = new ThumbnailRefreshProcessor().setDepsForTest({ prisma: prisma as any, launch, chromiumPath: '/bin/true', uploadsDir: '/tmp' });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await proc.process({ data: { projectId: 'p1' } } as any);

    expect(launch).not.toHaveBeenCalled();
    expect(prisma.__updates).toHaveLength(0);
  });


  it('skips when project uses manual upload', async () => {

    const prisma = fakePrisma({
      id: 'p1', homeUrl: 'https://example.com', thumbnailManualUpload: true, thumbnailUrl: '/uploads/thumbnails/x.png',
    });
    const launch = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proc = new ThumbnailRefreshProcessor().setDepsForTest({ prisma: prisma as any, launch, chromiumPath: '/bin/true', uploadsDir: '/tmp' });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await proc.process({ data: { projectId: 'p1' } } as any);

    expect(launch).not.toHaveBeenCalled();
  });


  it('skips when Chromium is unavailable', async () => {

    const prisma = fakePrisma({ id: 'p1', homeUrl: 'https://example.com', thumbnailManualUpload: false, thumbnailUrl: null });
    const launch = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proc = new ThumbnailRefreshProcessor().setDepsForTest({ prisma: prisma as any, launch, chromiumPath: '', uploadsDir: '/tmp' });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await proc.process({ data: { projectId: 'p1' } } as any);

    expect(launch).not.toHaveBeenCalled();
    expect(prisma.__updates).toHaveLength(0);
  });


  it('captures screenshot and updates project with TTL', async () => {

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'thumb-smoke-'));
    const prisma = fakePrisma({
      id: 'proj-x', homeUrl: 'https://example.com', thumbnailManualUpload: false, thumbnailUrl: null,
    });

    const screenshotPayload = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

    const page = {
      setViewport: vi.fn().mockResolvedValue(undefined),
      goto: vi.fn().mockResolvedValue(undefined),
      screenshot: vi.fn().mockResolvedValue(screenshotPayload),
      close: vi.fn().mockResolvedValue(undefined),
    };

    const browser = {
      newPage: vi.fn().mockResolvedValue(page),
      close: vi.fn().mockResolvedValue(undefined),
    };

    const launch = vi.fn().mockResolvedValue(browser);

    const proc = new ThumbnailRefreshProcessor().setDepsForTest({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma: prisma as any,
      launch,
      chromiumPath: '/usr/bin/chromium',
      uploadsDir: tmpDir,
      ttlHours: 24,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await proc.process({ data: { projectId: 'proj-x' } } as any);

    expect(launch).toHaveBeenCalledOnce();
    expect(page.setViewport).toHaveBeenCalledWith({ width: 1280, height: 720 });
    expect(page.goto).toHaveBeenCalledWith('https://example.com', expect.objectContaining({ waitUntil: 'networkidle2' }));
    expect(browser.close).toHaveBeenCalledOnce();

    expect(prisma.__updates).toHaveLength(1);
    const data = prisma.__updates[0];
    expect(String(data.thumbnailUrl)).toMatch(/^\/uploads\/thumbnails\/proj-x-auto-.+\.png$/);
    expect(data.thumbnailManualUpload).toBe(false);
    expect(data.thumbnailExpiresAt).toBeInstanceOf(Date);

    // File written
    const files = await fs.readdir(tmpDir);
    expect(files).toHaveLength(1);
  });
});
