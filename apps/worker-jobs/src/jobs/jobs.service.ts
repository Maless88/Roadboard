import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import {
  QUEUE_DASHBOARD_REFRESH,
  QUEUE_SUMMARY_GENERATION,
  QUEUE_CLEANUP,
} from './queue-names';


@Injectable()
export class JobsService {

  constructor(
    @InjectQueue(QUEUE_DASHBOARD_REFRESH) private readonly dashboardRefreshQueue: Queue,
    @InjectQueue(QUEUE_SUMMARY_GENERATION) private readonly summaryGenerationQueue: Queue,
    @InjectQueue(QUEUE_CLEANUP) private readonly cleanupQueue: Queue,
  ) {}


  async enqueueDashboardRefresh(projectId: string): Promise<void> {

    await this.dashboardRefreshQueue.add('refresh', { projectId });
  }


  async enqueueSummaryGeneration(projectId: string): Promise<void> {

    await this.summaryGenerationQueue.add('generate', { projectId });
  }


  async enqueueCleanup(): Promise<void> {

    await this.cleanupQueue.add('cleanup', {});
  }


  async getQueueStats(): Promise<Record<string, { waiting: number; active: number; completed: number; failed: number }>> {

    const [drCounts, sgCounts, clCounts] = await Promise.all([
      this.dashboardRefreshQueue.getJobCounts(),
      this.summaryGenerationQueue.getJobCounts(),
      this.cleanupQueue.getJobCounts(),
    ]);

    return {
      [QUEUE_DASHBOARD_REFRESH]: drCounts as { waiting: number; active: number; completed: number; failed: number },
      [QUEUE_SUMMARY_GENERATION]: sgCounts as { waiting: number; active: number; completed: number; failed: number },
      [QUEUE_CLEANUP]: clCounts as { waiting: number; active: number; completed: number; failed: number },
    };
  }
}
