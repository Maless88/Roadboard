import { Module } from "@nestjs/common";

import { PrismaModule } from "./prisma.module";
import { HealthModule } from "./modules/health/health.module";
import { ProjectsModule } from "./modules/projects/projects.module";
import { PhasesModule } from "./modules/phases/phases.module";
import { MilestonesModule } from "./modules/milestones/milestones.module";
import { TasksModule } from "./modules/tasks/tasks.module";
import { MemoryModule } from "./modules/memory/memory.module";
import { DecisionsModule } from "./modules/decisions/decisions.module";
import { DashboardsModule } from "./modules/dashboards/dashboards.module";
import { AuditModule } from "./modules/audit/audit.module";
import { CodeflowModule } from "./modules/codeflow/codeflow.module";


@Module({
  imports: [
    PrismaModule,
    HealthModule,
    ProjectsModule,
    PhasesModule,
    MilestonesModule,
    TasksModule,
    MemoryModule,
    DecisionsModule,
    DashboardsModule,
    AuditModule,
    CodeflowModule,
  ],
})
export class AppModule {}
