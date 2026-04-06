import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { Logger } from "@nestjs/common";
import { optionalEnv } from "@roadboard/config";

import { AppModule } from "./app.module";


async function bootstrap(): Promise<void> {

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  const port = Number(optionalEnv("CORE_API_PORT", "3001"));
  const logger = new Logger("Bootstrap");

  await app.listen(port, "0.0.0.0");

  logger.log(`core-api listening on port ${port}`);
}

bootstrap();
