import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import fastifyMultipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { Logger, ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { optionalEnv } from "@roadboard/config";
import * as path from "node:path";
import { promises as fs } from "node:fs";

import { AppModule } from "./app.module";
import { ApiExceptionFilter } from "./common/api-exception.filter";
import { createValidationPipeOptions } from "./common/validation";


const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;


async function bootstrap(): Promise<void> {

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  const port = Number(optionalEnv("CORE_API_PORT", "3001"));
  const logger = new Logger("Bootstrap");

  // Multipart for thumbnail upload.
  await app.register(fastifyMultipart as never, {
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  });

  // Static serve of thumbnail uploads.
  const uploadsRoot = optionalEnv("THUMBNAIL_UPLOAD_DIR", path.resolve(process.cwd(), "uploads/thumbnails"));
  await fs.mkdir(uploadsRoot, { recursive: true });
  await app.register(fastifyStatic as never, {
    root: uploadsRoot,
    prefix: "/uploads/thumbnails/",
    decorateReply: false,
  });

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
