import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { QUEUE_AGENT_RUN } from '../queue-names';

interface AgentRunJobData {
  capability: string;
  input: string;
  sessionId?: string;
  projectId?: string;
}

@Processor(QUEUE_AGENT_RUN)
export class AgentRunProcessor extends WorkerHost {

  private readonly logger = new Logger(AgentRunProcessor.name);


  async process(job: Job<AgentRunJobData>): Promise<void> {

    const { capability, input } = job.data;

    this.logger.log(
      `[agent-run] job ${job.id} capability=${capability} input="${input.slice(0, 80)}"`,
    );

    // TODO Wave 2: route by capability -> executor (provider/model) -> ActivityEvent -> result
  }
}
