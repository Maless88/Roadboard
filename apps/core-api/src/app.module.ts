import { Module } from "@nestjs/common";

import { PrismaModule } from "./prisma.module";
import { CommonModule } from "./common/common.module";
import { HealthModule } from "./modules/health/health.module";
import { VersionModule } from "./modules/version/version.module";
import { ReleaseModule } from "./modules/release/release.module";
import { ProjectsModule } from "./modules/projects/projects.module";
import { PhasesModule } from "./modules/phases/phases.module";
import { TasksModule } from "./modules/tasks/tasks.module";
import { MemoryModule } from "./modules/memory/memory.module";
import { DecisionsModule } from "./modules/decisions/decisions.module";
import { DashboardsModule } from "./modules/dashboards/dashboards.module";
import { AuditModule } from "./modules/audit/audit.module";
import { CodeflowModule } from "./modules/codeflow/codeflow.module";
import { ProjectRepositoriesModule } from "./modules/projects/repositories/project-repositories.module";
import { ChatbotModule } from "./modules/chatbot/chatbot.module";
import { OpsModule } from "./modules/ops/ops.module";
import { AgentsModule } from "./modules/agents/agents.module";


@Module({
  imports: [
    PrismaModule,
    CommonModule,
    HealthModule,
    VersionModule,
    ReleaseModule,
    ProjectsModule,
    PhasesModule,
    TasksModule,
    MemoryModule,
    DecisionsModule,
    DashboardsModule,
    AuditModule,
    CodeflowModule,
    ProjectRepositoriesModule,
    ChatbotModule,
    OpsModule,
    AgentsModule,
  ],
})
export class AppModule {}
