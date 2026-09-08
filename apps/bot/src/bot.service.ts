import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Telegraf } from 'telegraf';
import { env } from './config/env.js';

/**
 * Bot de Telegram en modo WEBHOOK (no polling).
 * Flujo objetivo (ver ARQUITECTURA.md §11): foto de boleta -> subir a R2 ->
 * encolar ocr:parse -> responder resumen -> confirmar -> "Precio Verificado".
 */
@Injectable()
export class BotService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(BotService.name);
  readonly bot: Telegraf = new Telegraf(env.TELEGRAM_BOT_TOKEN);

  onModuleInit(): void {
    this.bot.start((ctx) => ctx.reply('FijaPrecio: envíame una foto de tu boleta y la proceso.'));

    this.bot.on('photo', async (ctx) => {
      // TODO: resolver TelegramLink -> org, descargar file, subir a R2,
      //       crear Receipt(channel=TELEGRAM), encolar ocr:parse.
      await ctx.reply('Recibí tu boleta. La estoy procesando…');
    });

    this.log.log('handlers de Telegram registrados');
  }

  async registerWebhook(): Promise<void> {
    const url = new URL(env.TELEGRAM_WEBHOOK_PATH, env.BOT_PUBLIC_URL).toString();
    await this.bot.telegram.setWebhook(url, { secret_token: env.TELEGRAM_WEBHOOK_SECRET });
    this.log.log(`webhook registrado: ${url}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.bot.telegram.deleteWebhook().catch(() => undefined);
  }
}
