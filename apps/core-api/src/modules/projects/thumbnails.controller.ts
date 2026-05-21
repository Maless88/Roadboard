import {
  BadRequestException,
  Controller,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { GrantType } from '@roadboard/domain';
import { AuthGuard } from '../../common/auth.guard';
import { GrantCheckGuard } from '../../common/grant-check.guard';
import { RequireGrant } from '../../common/require-grant.decorator';
import { ThumbnailsService } from './thumbnails.service';


const MAX_BYTES = 2 * 1024 * 1024;


@UseGuards(AuthGuard, GrantCheckGuard)
@Controller('projects')
export class ThumbnailsController {

  constructor(@Inject(ThumbnailsService) private readonly thumbnails: ThumbnailsService) {}


  @RequireGrant(GrantType.PROJECT_WRITE)
  @Post(':id/thumbnail')
  async upload(@Param('id') id: string, @Req() req: unknown): Promise<{ thumbnailUrl: string }> {

    const fastifyReq = req as {
      isMultipart?: () => boolean;
      file?: (opts?: { limits?: { fileSize?: number } }) => Promise<{
        filename: string;
        mimetype: string;
        toBuffer: () => Promise<Buffer>;
        file: { truncated: boolean };
      } | undefined>;
    };

    if (typeof fastifyReq.isMultipart !== 'function' || !fastifyReq.isMultipart()) {
      throw new BadRequestException('Expected multipart/form-data');
    }

    if (typeof fastifyReq.file !== 'function') {
      throw new BadRequestException('Multipart plugin not enabled');
    }

    const part = await fastifyReq.file({ limits: { fileSize: MAX_BYTES } });

    if (!part) {
      throw new BadRequestException('Missing file part');
    }

    const buffer = await part.toBuffer();

    if (part.file.truncated) {
      throw new BadRequestException(`File exceeds max size of ${MAX_BYTES} bytes`);
    }

    return this.thumbnails.saveManualUpload(id, {
      buffer,
      mimetype: part.mimetype,
      filename: part.filename,
    });
  }
}
