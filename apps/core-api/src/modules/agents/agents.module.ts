import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AgentExecutorService } from "./agent-executor.service";
import { AgentsService } from "./agents.service";
import { ChatService } from "./chat.service";
import { CoordinatorService } from "./coordinator.service";
import { AgentsController } from "./agents.controller";
import { RoomsService } from "./rooms.service";
import { RoomsController } from "./rooms.controller";
import { RoomOrchestratorService } from "./rooms-orchestrator.service";

@Module({
  imports: [AuditModule],
  controllers: [AgentsController, RoomsController],
  providers: [AgentExecutorService, AgentsService, ChatService, CoordinatorService, RoomsService, RoomOrchestratorService],
  exports: [AgentExecutorService],
})
export class AgentsModule {}
