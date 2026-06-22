import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AgentExecutorService } from "./agent-executor.service";
import { AgentsService } from "./agents.service";
import { AgentsController } from "./agents.controller";

@Module({
  imports: [AuditModule],
  controllers: [AgentsController],
  providers: [AgentExecutorService, AgentsService],
  exports: [AgentExecutorService],
})
export class AgentsModule {}
