import { Module } from '@nestjs/common';
import { GraphProjectionService } from './graph-projection.service';


@Module({
  providers: [GraphProjectionService],
})
export class GraphProjectionModule {}
