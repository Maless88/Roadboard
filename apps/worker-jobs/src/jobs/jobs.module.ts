import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { DashboardRefreshProcessor } from './processors/dashboard-refresh.processor';
import { SummaryGenerationProcessor } from './processors/summary-generation.processor';
import { CleanupProcessor } from './processors/cleanup.processor';
import { ThumbnailRefreshProcessor } from './processors/thumbnail-refresh.processor';
import { DeepCodeScanProcessor } from './processors/deep-code-scan.processor';
import { AgentRunProcessor } from './processors/agent-run.processor';
import {
  QUEUE_DASHBOARD_REFRESH,
  QUEUE_SUMMARY_GENERATION,
  QUEUE_CLEANUP,
  QUEUE_THUMBNAIL_REFRESH,
  QUEUE_DEEP_CODE_SCAN,
  QUEUE_AGENT_RUN,
} from './queue-names';

export {
  QUEUE_DASHBOARD_REFRESH,
  QUEUE_SUMMARY_GENERATION,
  QUEUE_CLEANUP,
  QUEUE_THUMBNAIL_REFRESH,
  QUEUE_DEEP_CODE_SCAN,
  QUEUE_AGENT_RUN,
};


@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUE_DASHBOARD_REFRESH },
      { name: QUEUE_SUMMARY_GENERATION },
      { name: QUEUE_CLEANUP },
      { name: QUEUE_THUMBNAIL_REFRESH },
      { name: QUEUE_DEEP_CODE_SCAN },
      { name: QUEUE_AGENT_RUN },
    ),
  ],
  controllers: [JobsController],
  providers: [
    JobsService,
    DashboardRefreshProcessor,
    SummaryGenerationProcessor,
    CleanupProcessor,
    ThumbnailRefreshProcessor,
    DeepCodeScanProcessor,
    AgentRunProcessor,
  ],
})
export class JobsModule {}
