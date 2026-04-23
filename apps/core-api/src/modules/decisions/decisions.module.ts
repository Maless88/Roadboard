import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { DecisionsController } from './decisions.controller';
import { DecisionsService } from './decisions.service';


@Module({
  imports: [AuditModule],
  controllers: [DecisionsController],
  providers: [DecisionsService],
  exports: [DecisionsService],
})
export class DecisionsModule {}
