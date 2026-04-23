import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PhasesController } from './phases.controller';
import { PhasesService } from './phases.service';


@Module({
  imports: [AuditModule],
  controllers: [PhasesController],
  providers: [PhasesService],
  exports: [PhasesService],
})
export class PhasesModule {}
