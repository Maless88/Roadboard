import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { Logger, ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { optionalEnv } from "@roadboard/config";

import { AppModule } from "./app.module";
import { ApiExceptionFilter } from "./common/api-exception.filter";
import { createValidationPipeOptions } from "./common/validation";


async function bootstrap(): Promise<void> {

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  const port = Number(optionalEnv("CORE_API_PORT", "3001"));
  const logger = new Logger("Bootstrap");

  app.useGlobalPipes(new ValidationPipe(createValidationPipeOptions()));
  app.useGlobalFilters(new ApiExceptionFilter());

  const docsConfig = new DocumentBuilder()
    .setTitle("RoadBoard Core API")
    .setDescription("Projects, phases, milestones, tasks, memory, and decisions.")
    .setVersion("0.0.1")
    .addBearerAuth()
    .build();
  const docsDocument = SwaggerModule.createDocument(app, docsConfig);

  SwaggerModule.setup("docs", app, docsDocument, {
    jsonDocumentUrl: "docs-json",
  });

  await app.listen(port, "0.0.0.0");

  logger.log(`core-api listening on port ${port}`);
  logger.log(`core-api docs available at http://0.0.0.0:${port}/docs`);
}

bootstrap();
