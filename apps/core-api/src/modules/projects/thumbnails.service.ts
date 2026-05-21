import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@roadboard/database';
import { optionalEnv } from '@roadboard/config';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';


const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_BYTES = 2 * 1024 * 1024;


function extFromMime(mime: string): string {

  if (mime === 'image/png') return 'png';

  if (mime === 'image/jpeg') return 'jpg';

  if (mime === 'image/webp') return 'webp';

  return 'bin';
}


@Injectable()
export class ThumbnailsService {

  private readonly logger = new Logger(ThumbnailsService.name);
  private readonly uploadsDir: string;


  constructor(@Inject('PRISMA') private readonly prisma: PrismaClient) {

    const root = optionalEnv('THUMBNAIL_UPLOAD_DIR', path.resolve(process.cwd(), 'uploads/thumbnails'));
    this.uploadsDir = root;
  }


  getUploadsDir(): string {

    return this.uploadsDir;
  }


  private async ensureDir(): Promise<void> {

    await fs.mkdir(this.uploadsDir, { recursive: true });
  }


  async saveManualUpload(
    projectId: string,
    payload: { buffer: Buffer; mimetype: string; filename: string },
  ): Promise<{ thumbnailUrl: string }> {

    const project = await this.prisma.project.findUnique({ where: { id: projectId } });

    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    if (!ALLOWED_MIME.has(payload.mimetype)) {
      throw new BadRequestException(`Unsupported mimetype: ${payload.mimetype}`);
    }

    if (payload.buffer.length === 0) {
      throw new BadRequestException('Empty upload');
    }

    if (payload.buffer.length > MAX_BYTES) {
      throw new BadRequestException(`File exceeds max size of ${MAX_BYTES} bytes`);
    }

    await this.ensureDir();

    const ext = extFromMime(payload.mimetype);
    const hash = crypto.randomBytes(8).toString('hex');
    const filename = `${projectId}-${hash}.${ext}`;
    const fullPath = path.join(this.uploadsDir, filename);
    await fs.writeFile(fullPath, payload.buffer);

    const publicUrl = `/uploads/thumbnails/${filename}`;
    const now = new Date();

    // Best-effort cleanup of any previous file for this project
    if (project.thumbnailUrl) {
      this.cleanupPrevious(project.thumbnailUrl).catch(() => undefined);
    }

    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        thumbnailUrl: publicUrl,
        thumbnailUpdatedAt: now,
        thumbnailExpiresAt: null,
        thumbnailManualUpload: true,
      },
    });

    return { thumbnailUrl: publicUrl };
  }


  private async cleanupPrevious(url: string): Promise<void> {

    if (!url.startsWith('/uploads/thumbnails/')) return;

    const filename = path.basename(url);
    const fullPath = path.join(this.uploadsDir, filename);
    await fs.unlink(fullPath).catch(() => undefined);
  }
}
