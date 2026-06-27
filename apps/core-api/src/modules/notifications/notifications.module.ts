import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma.module";
import { AgentNotificationsService } from "./notifications.service";
import { AgentNotificationsController } from "./notifications.controller";
import { NotificationsDispatcher } from "./notifications.dispatcher";

@Module({
  imports: [PrismaModule],
  controllers: [AgentNotificationsController],
  providers: [AgentNotificationsService, NotificationsDispatcher],
  exports: [AgentNotificationsService],
})
export class NotificationsModule {}
