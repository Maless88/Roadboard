import { Module } from '@nestjs/common';

import { MemoryController } from './memory.controller';
import { MemoryService } from './memory.service';
import { SyncModule } from '../sync/sync.module';


@Module({
  imports: [SyncModule],
  controllers: [MemoryController],
  providers: [MemoryService],
})
export class MemoryModule {}
