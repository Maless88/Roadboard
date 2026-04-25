import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { optionalEnv } from '@roadboard/config';

import { HealthModule } from './health/health.module';
import { JobsModule } from './jobs/jobs.module';
import { GraphProjectionModule } from './modules/graph-projection/graph-projection.module';


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
    GraphProjectionModule,
  ],
})
export class AppModule {}
