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
import { AgentCredentialsService } from "./credentials.service";
import { AgentCredentialsController } from "./credentials.controller";
import { AgentSkillsService } from "./skills.service";
import { AgentSkillsController } from "./skills.controller";
import { ImageGenService } from "./image-gen.service";

@Module({
  imports: [AuditModule],
  controllers: [AgentsController, RoomsController, AgentCredentialsController, AgentSkillsController],
  providers: [AgentExecutorService, AgentsService, ChatService, CoordinatorService, RoomsService, RoomOrchestratorService, AgentCredentialsService, AgentSkillsService, ImageGenService],
  exports: [AgentExecutorService],
})
export class AgentsModule {}
