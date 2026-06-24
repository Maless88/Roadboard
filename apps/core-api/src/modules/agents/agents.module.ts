import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AgentExecutorService } from "./agent-executor.service";
import { AgentsService } from "./agents.service";
import { ChatService } from "./chat.service";
import { CoordinatorService } from "./coordinator.service";
import { AgentsController } from "./agents.controller";
import { RoomsService } from "./rooms.service";
import { RoomsController } from "./rooms.controller";

@Module({
  imports: [AuditModule],
  controllers: [AgentsController, RoomsController],
  providers: [AgentExecutorService, AgentsService, ChatService, CoordinatorService, RoomsService],
  exports: [AgentExecutorService],
})
export class AgentsModule {}
