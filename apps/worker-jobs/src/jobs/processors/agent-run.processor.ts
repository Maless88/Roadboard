import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { QUEUE_AGENT_RUN } from '../queue-names';
import { AgentRunRunner } from '../agent-run.runner';

interface AgentRunJobData {
  activityId: string;
  runId: string;
}

@Processor(QUEUE_AGENT_RUN)
export class AgentRunProcessor extends WorkerHost {

  private readonly logger = new Logger(AgentRunProcessor.name);


  constructor(private readonly runner: AgentRunRunner) {
    super();
  }


  async process(job: Job<AgentRunJobData>): Promise<void> {

    const { activityId, runId } = job.data;

    this.logger.log(`[agent-run] job ${job.id} activity=${activityId} run=${runId}`);

    await this.runner.run(activityId, runId);
  }
}
