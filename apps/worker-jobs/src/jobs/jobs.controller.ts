import { Controller, Post, Get, Body, HttpCode, BadRequestException } from '@nestjs/common';

import { JobsService } from './jobs.service';


export interface DeepCodeScanRequestDto {
  projectId: string;
  repoPath: string;
  delta?: string[];
}


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


  @Post('summary-generation-all')
  @HttpCode(202)
  async triggerSummaryGenerationAll(): Promise<{ queued: number }> {

    const count = await this.jobs.enqueueAllProjectsSummary();
    return { queued: count };
  }


  @Post('cleanup')
  @HttpCode(202)
  async triggerCleanup(): Promise<{ queued: boolean }> {

    await this.jobs.enqueueCleanup();
    return { queued: true };
  }


  @Post('deep-code-scan')
  @HttpCode(202)
  async triggerDeepCodeScan(@Body() body: DeepCodeScanRequestDto): Promise<{ queued: boolean; jobId: string }> {

    if (!body?.projectId || typeof body.projectId !== 'string') {
      throw new BadRequestException('projectId is required');
    }

    if (!body?.repoPath || typeof body.repoPath !== 'string') {
      throw new BadRequestException('repoPath is required');
    }

    if (body.delta !== undefined && !Array.isArray(body.delta)) {
      throw new BadRequestException('delta must be an array of file paths');
    }

    const { jobId } = await this.jobs.enqueueDeepCodeScan({
      projectId: body.projectId,
      repoPath: body.repoPath,
      delta: body.delta,
    });

    return { queued: true, jobId };
  }


  @Post('thumbnail-refresh')
  @HttpCode(202)
  async triggerThumbnailRefresh(@Body() body: { projectId: string }): Promise<{ queued: boolean }> {

    await this.jobs.enqueueThumbnailRefresh(body.projectId);
    return { queued: true };
  }
}
