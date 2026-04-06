import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { optionalEnv } from '@roadboard/config';
import { AppModule } from './app.module';


async function bootstrap(): Promise<void> {

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  const port = Number(optionalEnv('AUTH_ACCESS_PORT', '3002'));

  await app.listen(port, '0.0.0.0');
  console.log(`auth-access listening on port ${port}`);
}

bootstrap();
