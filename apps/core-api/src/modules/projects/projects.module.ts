import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ThumbnailsService } from './thumbnails.service';
import { ThumbnailsController } from './thumbnails.controller';


@Module({
  imports: [AuditModule],
  controllers: [ProjectsController, ThumbnailsController],
  providers: [ProjectsService, ThumbnailsService],
  exports: [ProjectsService, ThumbnailsService],
})
export class ProjectsModule {}
