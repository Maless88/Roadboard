import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { optionalEnv } from '@roadboard/config';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { createValidationPipeOptions } from './common/validation';


async function bootstrap(): Promise<void> {

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  app.useGlobalPipes(new ValidationPipe(createValidationPipeOptions()));
  app.useGlobalFilters(new ApiExceptionFilter());

  const port = Number(optionalEnv('AUTH_ACCESS_PORT', '3002'));
  const docsConfig = new DocumentBuilder()
    .setTitle('RoadBoard Auth Access API')
    .setDescription('Users, teams, memberships, grants, sessions, and MCP tokens.')
    .setVersion('0.0.1')
    .addBearerAuth()
    .build();
  const docsDocument = SwaggerModule.createDocument(app, docsConfig);

  SwaggerModule.setup('docs', app, docsDocument, {
    jsonDocumentUrl: 'docs-json',
  });

  await app.listen(port, '0.0.0.0');
  console.log(`auth-access listening on port ${port}`);
  console.log(`auth-access docs available at http://0.0.0.0:${port}/docs`);
}

bootstrap();
