import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { optionalEnv } from '@roadboard/config';

import { HealthModule } from './health/health.module';
import { JobsModule } from './jobs/jobs.module';


@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: optionalEnv('REDIS_HOST', 'localhost'),
        port: Number(optionalEnv('REDIS_PORT', '6379')),
      },
    }),
    HealthModule,
    JobsModule,
  ],
})
export class AppModule {}
