import { Module } from '@nestjs/common';
import { GraphDbClient } from '@roadboard/graph-db';

import { CodeflowService } from './codeflow.service';
import { GraphService } from './graph.service';
import { GraphSyncService } from './graph-sync.service';
import { DriftService } from './drift.service';
import { RepositoriesController } from './repositories.controller';
import { GraphController } from './graph.controller';


@Module({
  controllers: [RepositoriesController, GraphController],
  providers: [
    CodeflowService,
    GraphService,
    GraphSyncService,
    DriftService,
    {
      provide: 'GRAPH_DB_CLIENT',
      useFactory: () => new GraphDbClient(),
    },
  ],
  exports: [CodeflowService, GraphService, DriftService],
})
export class CodeflowModule {}
