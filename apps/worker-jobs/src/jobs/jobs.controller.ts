import { Controller, Post, Get, Body, HttpCode } from '@nestjs/common';

import { JobsService } from './jobs.service';


@Controller('jobs')
export class JobsController {

  constructor(private readonly jobs: JobsService) {}


  @Get('stats')
  async stats(): Promise<unknown> {

    return this.jobs.getQueueStats();
  }


  @Post('dashboard-refresh')
  @HttpCode(202)
  async triggerDashboardRefresh(@Body() body: { projectId: string }): Promise<{ queued: boolean }> {

    await this.jobs.enqueueDashboardRefresh(body.projectId);
    return { queued: true };
  }


  @Post('summary-generation')
  @HttpCode(202)
  async triggerSummaryGeneration(@Body() body: { projectId: string }): Promise<{ queued: boolean }> {

    await this.jobs.enqueueSummaryGeneration(body.projectId);
    return { queued: true };
  }


  @Post('cleanup')
  @HttpCode(202)
  async triggerCleanup(): Promise<{ queued: boolean }> {

    await this.jobs.enqueueCleanup();
    return { queued: true };
  }
}
