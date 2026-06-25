import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { optionalEnv } from "@roadboard/config";
import { ScheduledActivityService } from "./scheduled-activity.service";
import { SchedulingController } from "./scheduling.controller";
import { SchedulingDispatcher } from "./scheduling.dispatcher";
import { QUEUE_AGENT_RUN } from "./scheduling.constants";

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: optionalEnv("REDIS_HOST", "localhost"),
        port: Number(optionalEnv("REDIS_PORT", "6379")),
      },
    }),
    BullModule.registerQueue({ name: QUEUE_AGENT_RUN }),
  ],
  controllers: [SchedulingController],
  providers: [ScheduledActivityService, SchedulingDispatcher],
  exports: [ScheduledActivityService],
})
export class SchedulingModule {}
