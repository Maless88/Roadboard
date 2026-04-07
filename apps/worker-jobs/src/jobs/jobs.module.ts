import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { DashboardRefreshProcessor } from './processors/dashboard-refresh.processor';
import { SummaryGenerationProcessor } from './processors/summary-generation.processor';
import { CleanupProcessor } from './processors/cleanup.processor';
import { QUEUE_DASHBOARD_REFRESH, QUEUE_SUMMARY_GENERATION, QUEUE_CLEANUP } from './queue-names';

export { QUEUE_DASHBOARD_REFRESH, QUEUE_SUMMARY_GENERATION, QUEUE_CLEANUP };


@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUE_DASHBOARD_REFRESH },
      { name: QUEUE_SUMMARY_GENERATION },
      { name: QUEUE_CLEANUP },
    ),
  ],
  controllers: [JobsController],
  providers: [
    JobsService,
    DashboardRefreshProcessor,
    SummaryGenerationProcessor,
    CleanupProcessor,
  ],
})
export class JobsModule {}
