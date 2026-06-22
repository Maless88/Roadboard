import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AgentExecutorService } from "./agent-executor.service";
import { AgentsController } from "./agents.controller";

@Module({
  imports: [AuditModule],
  controllers: [AgentsController],
  providers: [AgentExecutorService],
  exports: [AgentExecutorService],
})
export class AgentsModule {}
