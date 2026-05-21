import { Module } from '@nestjs/common';
import { GraphDbClient } from '@roadboard/graph-db';

import { AuditModule } from '../audit/audit.module';
import { CodeflowService } from './codeflow.service';
import { GraphService } from './graph.service';
import { GraphSyncService } from './graph-sync.service';
import { DriftService } from './drift.service';
import { DomainGroupsService } from './domain-groups.service';
import { RepositoriesController } from './repositories.controller';
import { GraphController } from './graph.controller';
import { DomainGroupsController } from './domain-groups.controller';


@Module({
  imports: [AuditModule],
  controllers: [RepositoriesController, GraphController, DomainGroupsController],
  providers: [
    CodeflowService,
    GraphService,
    GraphSyncService,
    DriftService,
    DomainGroupsService,
    {
      provide: 'GRAPH_DB_CLIENT',
      useFactory: () => new GraphDbClient(),
    },
  ],
  exports: [CodeflowService, GraphService, DriftService, DomainGroupsService],
})
export class CodeflowModule {}
