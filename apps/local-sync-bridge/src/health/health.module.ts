import { Module } from '@nestjs/common';

import { HealthController } from './health.controller';
import { SyncModule } from '../sync/sync.module';


@Module({
  imports: [SyncModule],
  controllers: [HealthController],
})
export class HealthModule {}
