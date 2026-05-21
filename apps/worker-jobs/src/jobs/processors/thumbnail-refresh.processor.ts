import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { optionalEnv } from '@roadboard/config';
import { PrismaClient } from '@roadboard/database';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

import { QUEUE_THUMBNAIL_REFRESH } from '../queue-names';


type LaunchFn = (opts: { headless: boolean; executablePath: string; args: string[] }) => Promise<BrowserLike>;

interface BrowserLike {
  newPage: () => Promise<PageLike>;
  close: () => Promise<void>;
}

interface PageLike {
  setViewport: (v: { width: number; height: number }) => Promise<void>;
  goto: (url: string, opts?: { waitUntil?: string; timeout?: number }) => Promise<unknown>;
  screenshot: (opts: { type: 'png' | 'jpeg' | 'webp'; fullPage?: boolean }) => Promise<Buffer>;
  close: () => Promise<void>;
}


export interface ThumbnailRefreshJobData {
  projectId: string;
}


export interface ThumbnailRefreshDeps {
  prisma?: PrismaClient;
  launch?: LaunchFn;
  uploadsDir?: string;
  /** If the property is *present* (including value `''`), it overrides auto-detection. */
  chromiumPath?: string;
  ttlHours?: number;
}


function detectChromium(): string | null {

  const explicit = optionalEnv('PUPPETEER_EXECUTABLE_PATH', '');

  if (explicit) return explicit;

  const candidates = [
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
  ];

  for (const c of candidates) {

    try {
      require('node:fs').accessSync(c);
      return c;
    } catch {
      // try next
    }
  }

  return null;
}


@Processor(QUEUE_THUMBNAIL_REFRESH, { concurrency: 10 })
export class ThumbnailRefreshProcessor extends WorkerHost {

  private readonly logger = new Logger(ThumbnailRefreshProcessor.name);
  private deps: ThumbnailRefreshDeps = {};
  private prisma: PrismaClient | null = null;


  constructor() {

    super();
  }


  setDepsForTest(deps: ThumbnailRefreshDeps): this {

    this.deps = deps;
    return this;
  }


  private getPrisma(): PrismaClient {

    if (this.deps.prisma) return this.deps.prisma;

    if (!this.prisma) this.prisma = new PrismaClient();

    return this.prisma;
  }


  private getUploadsDir(): string {

    return this.deps.uploadsDir
      ?? optionalEnv('THUMBNAIL_UPLOAD_DIR', path.resolve(process.cwd(), '../core-api/uploads/thumbnails'));
  }


  private getTtlMs(): number {

    const hours = this.deps.ttlHours ?? Number(optionalEnv('THUMBNAIL_TTL_HOURS', '24'));
    return hours * 60 * 60 * 1000;
  }


  async process(job: Job<ThumbnailRefreshJobData>): Promise<void> {

    const { projectId } = job.data;
    const prisma = this.getPrisma();
    const project = await prisma.project.findUnique({ where: { id: projectId } });

    if (!project) {
      this.logger.warn(`[thumbnail-refresh] project=${projectId} not found, skipping`);
      return;
    }

    if (!project.homeUrl) {
      this.logger.log(`[thumbnail-refresh] project=${projectId} has no homeUrl, skipping`);
      return;
    }

    if (project.thumbnailManualUpload) {
      this.logger.log(`[thumbnail-refresh] project=${projectId} uses manual upload, skipping`);
      return;
    }

    const launch = this.deps.launch ?? (await this.resolvePuppeteerLaunch());

    if (!launch) {
      this.logger.warn(`[thumbnail-refresh] no Chromium available — skipping project=${projectId}`);
      return;
    }

    const chromiumPath = 'chromiumPath' in this.deps ? this.deps.chromiumPath : detectChromium();

    if (!chromiumPath) {
      this.logger.warn(`[thumbnail-refresh] Chromium executable not found, skipping project=${projectId}`);
      return;
    }

    let browser: BrowserLike | null = null;

    try {
      browser = await launch({
        headless: true,
        executablePath: chromiumPath,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });

      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 720 });
      await page.goto(project.homeUrl, { waitUntil: 'networkidle2', timeout: 30_000 });
      const buffer = await page.screenshot({ type: 'png', fullPage: false });
      await page.close();

      const uploadsDir = this.getUploadsDir();
      await fs.mkdir(uploadsDir, { recursive: true });

      const filename = `${projectId}-auto-${crypto.randomBytes(6).toString('hex')}.png`;
      const fullPath = path.join(uploadsDir, filename);
      await fs.writeFile(fullPath, buffer);

      const publicUrl = `/uploads/thumbnails/${filename}`;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.getTtlMs());

      // Best-effort cleanup of the previous auto file.
      if (project.thumbnailUrl && project.thumbnailUrl.startsWith('/uploads/thumbnails/')) {
        const prevFilename = path.basename(project.thumbnailUrl);

        if (prevFilename !== filename) {
          fs.unlink(path.join(uploadsDir, prevFilename)).catch(() => undefined);
        }
      }

      await prisma.project.update({
        where: { id: projectId },
        data: {
          thumbnailUrl: publicUrl,
          thumbnailUpdatedAt: now,
          thumbnailExpiresAt: expiresAt,
          thumbnailManualUpload: false,
        },
      });

      this.logger.log(`[thumbnail-refresh] project=${projectId} → ${publicUrl}`);
    } catch (err) {

      this.logger.warn(`[thumbnail-refresh] project=${projectId} failed: ${(err as Error).message}`);
    } finally {

      if (browser) await browser.close().catch(() => undefined);
    }
  }


  private async resolvePuppeteerLaunch(): Promise<LaunchFn | null> {

    try {
      const mod = (await import('puppeteer-core')) as unknown as { launch: LaunchFn };
      return mod.launch;
    } catch {
      return null;
    }
  }
}
