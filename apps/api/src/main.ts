import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { env } from './config/env.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  app.use(cookieParser());
  app.setGlobalPrefix('v1', { exclude: ['health', 'health/ready'] });
  app.enableCors({ origin: env.CORS_ORIGINS, credentials: true });

  await app.listen(env.port, '0.0.0.0');
  app.get(Logger).log(`api escuchando en :${env.port} (${env.NODE_ENV})`);
}

void bootstrap();
