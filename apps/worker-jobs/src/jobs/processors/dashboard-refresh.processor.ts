import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { optionalEnv } from '@roadboard/config';

import { QUEUE_DASHBOARD_REFRESH } from '../queue-names';


const CORE_API_URL = `http://localhost:${optionalEnv('CORE_API_PORT', '3001')}`;


@Processor(QUEUE_DASHBOARD_REFRESH)
export class DashboardRefreshProcessor extends WorkerHost {

  private readonly logger = new Logger(DashboardRefreshProcessor.name);


  async process(job: Job<{ projectId: string }>): Promise<void> {

    const { projectId } = job.data;
    this.logger.log(`[dashboard-refresh] project=${projectId}`);

    const res = await fetch(`${CORE_API_URL}/projects/${projectId}`).catch(() => null);

    if (!res?.ok) {
      this.logger.warn(`[dashboard-refresh] project ${projectId} not reachable, skipping`);
      return;
    }

    const project = (await res.json()) as { name: string; status: string };
    this.logger.log(`[dashboard-refresh] project "${project.name}" status=${project.status} — OK`);
  }
}
