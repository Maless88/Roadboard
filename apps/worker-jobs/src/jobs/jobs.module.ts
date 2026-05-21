import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { DashboardRefreshProcessor } from './processors/dashboard-refresh.processor';
import { SummaryGenerationProcessor } from './processors/summary-generation.processor';
import { CleanupProcessor } from './processors/cleanup.processor';
import { ThumbnailRefreshProcessor } from './processors/thumbnail-refresh.processor';
import {
  QUEUE_DASHBOARD_REFRESH,
  QUEUE_SUMMARY_GENERATION,
  QUEUE_CLEANUP,
  QUEUE_THUMBNAIL_REFRESH,
} from './queue-names';

export { QUEUE_DASHBOARD_REFRESH, QUEUE_SUMMARY_GENERATION, QUEUE_CLEANUP, QUEUE_THUMBNAIL_REFRESH };


@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUE_DASHBOARD_REFRESH },
      { name: QUEUE_SUMMARY_GENERATION },
      { name: QUEUE_CLEANUP },
      { name: QUEUE_THUMBNAIL_REFRESH },
    ),
  ],
  controllers: [JobsController],
  providers: [
    JobsService,
    DashboardRefreshProcessor,
    SummaryGenerationProcessor,
    CleanupProcessor,
    ThumbnailRefreshProcessor,
  ],
})
export class JobsModule {}
