import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { optionalEnv } from '@roadboard/config';

import {
  QUEUE_DASHBOARD_REFRESH,
  QUEUE_SUMMARY_GENERATION,
  QUEUE_CLEANUP,
  QUEUE_THUMBNAIL_REFRESH,
  QUEUE_DEEP_CODE_SCAN,
} from './queue-names';


export interface DeepCodeScanRequest {
  projectId: string;
  repoPath: string;
  delta?: string[];
}


const CORE_API_URL = `http://${optionalEnv('CORE_API_HOST', 'localhost')}:${optionalEnv('CORE_API_PORT', '3001')}`;
const WORKER_TOKEN = optionalEnv('WORKER_MCP_TOKEN', '');


@Injectable()
export class JobsService {

  constructor(
    @InjectQueue(QUEUE_DASHBOARD_REFRESH) private readonly dashboardRefreshQueue: Queue,
    @InjectQueue(QUEUE_SUMMARY_GENERATION) private readonly summaryGenerationQueue: Queue,
    @InjectQueue(QUEUE_CLEANUP) private readonly cleanupQueue: Queue,
    @InjectQueue(QUEUE_THUMBNAIL_REFRESH) private readonly thumbnailRefreshQueue: Queue,
    @InjectQueue(QUEUE_DEEP_CODE_SCAN) private readonly deepCodeScanQueue: Queue,
  ) {}


  async enqueueDeepCodeScan(req: DeepCodeScanRequest): Promise<{ jobId: string }> {

    const job = await this.deepCodeScanQueue.add(
      'scan',
      req,
      {
        removeOnComplete: 50,
        removeOnFail: 20,
        attempts: 1,
      },
    );

    return { jobId: String(job.id) };
  }


  async enqueueThumbnailRefresh(projectId: string): Promise<void> {

    await this.thumbnailRefreshQueue.add(
      'refresh',
      { projectId },
      {
        jobId: `thumbnail-${projectId}`,
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 2,
        backoff: { type: 'fixed', delay: 60_000 },
      },
    );
  }


  async enqueueDashboardRefresh(projectId: string): Promise<void> {

    await this.dashboardRefreshQueue.add('refresh', { projectId });
  }


  async enqueueSummaryGeneration(projectId: string): Promise<void> {

    await this.summaryGenerationQueue.add('generate', { projectId });
  }


  async enqueueAllProjectsSummary(): Promise<number> {

    if (!WORKER_TOKEN) return 0;

    const res = await fetch(`${CORE_API_URL}/projects`, {
      headers: { Authorization: `Bearer ${WORKER_TOKEN}` },
    }).catch(() => null);

    if (!res?.ok) return 0;

    const projects = (await res.json()) as Array<{ id: string }>;

    await Promise.all(
      projects.map((p) => this.summaryGenerationQueue.add('generate', { projectId: p.id })),
    );

    return projects.length;
  }


  async enqueueCleanup(): Promise<void> {

    await this.cleanupQueue.add('cleanup', {});
  }


  async getQueueStats(): Promise<Record<string, { waiting: number; active: number; completed: number; failed: number }>> {

    const [drCounts, sgCounts, clCounts, trCounts, dcsCounts] = await Promise.all([
      this.dashboardRefreshQueue.getJobCounts(),
      this.summaryGenerationQueue.getJobCounts(),
      this.cleanupQueue.getJobCounts(),
      this.thumbnailRefreshQueue.getJobCounts(),
      this.deepCodeScanQueue.getJobCounts(),
    ]);

    return {
      [QUEUE_DASHBOARD_REFRESH]: drCounts as { waiting: number; active: number; completed: number; failed: number },
      [QUEUE_SUMMARY_GENERATION]: sgCounts as { waiting: number; active: number; completed: number; failed: number },
      [QUEUE_CLEANUP]: clCounts as { waiting: number; active: number; completed: number; failed: number },
      [QUEUE_THUMBNAIL_REFRESH]: trCounts as { waiting: number; active: number; completed: number; failed: number },
      [QUEUE_DEEP_CODE_SCAN]: dcsCounts as { waiting: number; active: number; completed: number; failed: number },
    };
  }
}
