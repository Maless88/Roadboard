import { Module } from "@nestjs/common";
import { AgentExecutorService } from "./agent-executor.service";

@Module({
  providers: [AgentExecutorService],
  exports: [AgentExecutorService],
})
export class AgentsModule {}
