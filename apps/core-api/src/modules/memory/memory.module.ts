import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { MemoryController } from './memory.controller';
import { MemoryService } from './memory.service';


@Module({
  imports: [AuditModule],
  controllers: [MemoryController],
  providers: [MemoryService],
  exports: [MemoryService],
})
export class MemoryModule {}
