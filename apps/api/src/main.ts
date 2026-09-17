import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { loadEnv } from './core/config/env';

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule);
  // apps/verify-ui and apps/dashboard call this API directly from the
  // browser. Phase 0 has no per-tenant CORS config, so this is wide open —
  // acceptable because every route is already authenticated by API key or
  // session token, not by origin; tightening this to a per-tenant allowlist
  // is real work for whenever a tenant's own web app needs to embed the
  // hosted flow, not before.
  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  await app.listen(env.apiPort);
  // eslint-disable-next-line no-console
  console.log(`nID API listening on :${env.apiPort}`);
}

bootstrap().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
