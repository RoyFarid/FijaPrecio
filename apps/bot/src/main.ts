import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { BotService } from './bot.service.js';
import { env } from './config/env.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  const botService = app.get(BotService);
  // Monta el callback del webhook de Telegram en el mismo servidor HTTP.
  app.use(
    botService.bot.webhookCallback(env.TELEGRAM_WEBHOOK_PATH, {
      secretToken: env.TELEGRAM_WEBHOOK_SECRET,
    }),
  );

  await app.listen(env.port, '0.0.0.0');
  app.get(Logger).log(`bot escuchando en :${env.port} (${env.NODE_ENV})`);

  if (env.BOT_PUBLIC_URL.startsWith('https://')) {
    await botService.registerWebhook();
  } else {
    app.get(Logger).warn('BOT_PUBLIC_URL no es https: webhook NO registrado (usa un túnel en local)');
  }
}

void bootstrap();
