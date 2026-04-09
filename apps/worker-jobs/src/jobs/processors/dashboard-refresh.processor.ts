import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { optionalEnv } from '@roadboard/config';

import { QUEUE_DASHBOARD_REFRESH } from '../queue-names';


const CORE_API_URL = `http://${optionalEnv('CORE_API_HOST', 'localhost')}:${optionalEnv('CORE_API_PORT', '3001')}`;


@Processor(QUEUE_DASHBOARD_REFRESH)
export class DashboardRefreshProcessor extends WorkerHost {

  private readonly logger = new Logger(DashboardRefreshProcessor.name);


  async process(job: Job<{ projectId: string; token?: string }>): Promise<void> {

    const { projectId, token } = job.data;
    this.logger.log(`[dashboard-refresh] project=${projectId}`);

    const headers: Record<string, string> = {};

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const [projectRes, snapshotRes] = await Promise.all([
      fetch(`${CORE_API_URL}/projects/${projectId}`, { headers }).catch(() => null),
      fetch(`${CORE_API_URL}/projects/${projectId}/dashboard`, { headers }).catch(() => null),
    ]);

    if (!projectRes?.ok) {
      this.logger.warn(`[dashboard-refresh] project ${projectId} not reachable, skipping`);
      return;
    }

    const project = (await projectRes.json()) as { name: string; status: string };

    if (snapshotRes?.ok) {
      const snapshot = (await snapshotRes.json()) as { tasksByStatus: Record<string, number> };
      this.logger.log(
        `[dashboard-refresh] project "${project.name}" tasks=${JSON.stringify(snapshot.tasksByStatus)}`,
      );
    } else {
      this.logger.log(`[dashboard-refresh] project "${project.name}" status=${project.status} — OK`);
    }
  }
}
