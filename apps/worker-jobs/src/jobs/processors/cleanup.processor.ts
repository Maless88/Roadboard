import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { optionalEnv } from '@roadboard/config';

import { QUEUE_CLEANUP } from '../queue-names';


const AUTH_URL = `http://${optionalEnv('AUTH_ACCESS_HOST', 'localhost')}:${optionalEnv('AUTH_ACCESS_PORT', '3002')}`;
const WORKER_TOKEN = optionalEnv('WORKER_MCP_TOKEN', '');


@Processor(QUEUE_CLEANUP)
export class CleanupProcessor extends WorkerHost {

  private readonly logger = new Logger(CleanupProcessor.name);


  async process(_job: Job): Promise<void> {

    this.logger.log('[cleanup] starting session and token cleanup');

    if (!WORKER_TOKEN) {
      this.logger.warn('[cleanup] WORKER_MCP_TOKEN not set, skipping');
      return;
    }

    const res = await fetch(`${AUTH_URL}/sessions/cleanup`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${WORKER_TOKEN}` },
    }).catch(() => null);

    if (res?.ok) {
      const data = (await res.json()) as { deleted: number };
      this.logger.log(`[cleanup] deleted ${data.deleted} expired sessions`);
    } else {
      this.logger.warn('[cleanup] sessions/cleanup endpoint not available, skipping');
    }
  }
}
