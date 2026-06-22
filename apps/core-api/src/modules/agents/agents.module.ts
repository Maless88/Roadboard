import { Module } from "@nestjs/common";
import { AgentExecutorService } from "./agent-executor.service";
import { AgentsController } from "./agents.controller";

@Module({
  controllers: [AgentsController],
  providers: [AgentExecutorService],
  exports: [AgentExecutorService],
})
export class AgentsModule {}
