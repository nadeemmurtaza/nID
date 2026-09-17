import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { loadEnv } from './core/config/env';

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  await app.listen(env.apiPort);
  // eslint-disable-next-line no-console
  console.log(`nID API listening on :${env.apiPort}`);
}

bootstrap().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
