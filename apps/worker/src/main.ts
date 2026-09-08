import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { env } from './config/env.js';

/**
 * El `worker` levanta un HTTP mínimo SOLO para el healthcheck de Railway;
 * el trabajo real lo hacen los `Worker` de BullMQ registrados como providers.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  await app.listen(env.healthPort, '0.0.0.0');
  app.get(Logger).log(`worker activo — health en :${env.healthPort} (${env.NODE_ENV})`);
}

void bootstrap();
