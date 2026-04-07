import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { HealthModule } from './health/health.module';
import { JournalModule } from './journal/journal.module';
import { SyncModule } from './sync/sync.module';
import { TasksModule } from './tasks/tasks.module';
import { MemoryModule } from './memory/memory.module';


@Module({
  imports: [
    ScheduleModule.forRoot(),
    HealthModule,
    JournalModule,
    SyncModule,
    TasksModule,
    MemoryModule,
  ],
})
export class AppModule {}
