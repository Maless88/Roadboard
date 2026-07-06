import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma.module";
import { AgentNotificationsService } from "./notifications.service";
import { AgentNotificationsController } from "./notifications.controller";
import { NotificationsDispatcher } from "./notifications.dispatcher";
import { PushService } from "./push.service";

@Module({
  imports: [PrismaModule],
  controllers: [AgentNotificationsController],
  providers: [AgentNotificationsService, NotificationsDispatcher, PushService],
  exports: [AgentNotificationsService, PushService],
})
export class NotificationsModule {}
