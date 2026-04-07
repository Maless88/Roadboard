import { Module } from '@nestjs/common';

import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { SyncModule } from '../sync/sync.module';


@Module({
  imports: [SyncModule],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
