import { Module } from '@nestjs/common';

import { CodeflowService } from './codeflow.service';
import { GraphService } from './graph.service';
import { RepositoriesController } from './repositories.controller';
import { GraphController } from './graph.controller';


@Module({
  controllers: [RepositoriesController, GraphController],
  providers: [CodeflowService, GraphService],
  exports: [CodeflowService, GraphService],
})
export class CodeflowModule {}
