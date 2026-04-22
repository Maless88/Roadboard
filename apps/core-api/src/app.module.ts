import { Module } from "@nestjs/common";

import { PrismaModule } from "./prisma.module";
import { CommonModule } from "./common/common.module";
import { HealthModule } from "./modules/health/health.module";
import { VersionModule } from "./modules/version/version.module";
import { ProjectsModule } from "./modules/projects/projects.module";
import { PhasesModule } from "./modules/phases/phases.module";
import { TasksModule } from "./modules/tasks/tasks.module";
import { MemoryModule } from "./modules/memory/memory.module";
import { DecisionsModule } from "./modules/decisions/decisions.module";
import { DashboardsModule } from "./modules/dashboards/dashboards.module";
import { AuditModule } from "./modules/audit/audit.module";
import { CodeflowModule } from "./modules/codeflow/codeflow.module";


@Module({
  imports: [
    PrismaModule,
    CommonModule,
    HealthModule,
    VersionModule,
    ProjectsModule,
    PhasesModule,
    TasksModule,
    MemoryModule,
    DecisionsModule,
    DashboardsModule,
    AuditModule,
    CodeflowModule,
  ],
})
export class AppModule {}
