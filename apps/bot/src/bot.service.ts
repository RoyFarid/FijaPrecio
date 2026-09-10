import { randomUUID } from 'node:crypto';
import {
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { Context, Markup, Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import { Prisma } from '@fijaprecio/db';
import { env } from './config/env.js';
import { PrismaService } from './prisma.service.js';
import { QueueService } from './queue.service.js';
import { StorageService } from './storage.service.js';
import { formatReceiptSummary } from './receipt-summary.js';

const LINK_HELP =
  'Para empezar, vincula tu cuenta: en la app de FijaPrecio genera un código y ' +
  'envíamelo con  /link TU-CODIGO';

@Injectable()
export class BotService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(BotService.name);
  readonly bot: Telegraf = new Telegraf(env.TELEGRAM_BOT_TOKEN);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly storage: StorageService,
  ) {}

  onModuleInit(): void {
    this.bot.start((ctx) =>
      ctx.reply(`FijaPrecio: registro precios desde tus boletas.\n\n${LINK_HELP}`),
    );
    this.bot.command('link', (ctx) => this.handleLink(ctx));
    this.bot.on(message('photo'), (ctx) => this.handlePhoto(ctx));
    this.bot.action(/^confirm:(.+)$/, (ctx) => this.handleAction(ctx, 'confirm'));
    this.bot.action(/^discard:(.+)$/, (ctx) => this.handleAction(ctx, 'discard'));
    this.bot.on(message('text'), (ctx) => {
      if (!ctx.message.text.startsWith('/')) {
        return ctx.reply('Envíame una *foto* de tu boleta.', { parse_mode: 'Markdown' });
      }
      return undefined;
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

  /** Manda un mensaje suelto a un usuario por Telegram (alertas). */
  async sendUserMessage(userId: string, text: string): Promise<boolean> {
    const link = await this.prisma.client.telegramLink.findFirst({
      where: { userId, verifiedAt: { not: null } },
      select: { telegramUserId: true },
    });
    if (!link?.telegramUserId) return false;
    await this.bot.telegram.sendMessage(Number(link.telegramUserId), text, {
      parse_mode: 'Markdown',
    });
    return true;
  }

  /** Manda el resumen de una boleta ya parseada con los botones de confirmación. */
  async sendReceiptSummary(receiptId: string): Promise<void> {
    const receipt = await this.prisma.client.receipt.findUnique({
      where: { id: receiptId },
      include: {
        lineItems: {
          orderBy: { lineNo: 'asc' },
          include: { matchedCanonicalInput: { select: { name: true } } },
        },
      },
    });
    if (!receipt) throw new NotFoundException('Boleta no encontrada');

    const link = await this.prisma.client.telegramLink.findFirst({
      where: { userId: receipt.uploadedById, verifiedAt: { not: null } },
      select: { telegramUserId: true },
    });
    if (!link?.telegramUserId) {
      this.log.warn(`boleta ${receiptId}: sin Telegram vinculado, no se notifica`);
      return;
    }

    if (receipt.status === 'FAILED') {
      await this.bot.telegram.sendMessage(
        Number(link.telegramUserId),
        `No pude leer esa boleta 😕${receipt.errorMessage ? `\n(${receipt.errorMessage})` : ''}\nProbá con una foto más nítida.`,
      );
      return;
    }

    const text = formatReceiptSummary({
      issuerRuc: receipt.issuerRuc,
      documentNumber: receipt.documentNumber,
      issuedAt: receipt.issuedAt,
      currency: receipt.currency,
      totalAmount: receipt.totalAmount ? receipt.totalAmount.toNumber() : null,
      lines: receipt.lineItems.map((li) => ({
        lineNo: li.lineNo,
        rawDescription: li.rawDescription,
        quantity: li.quantity ? li.quantity.toNumber() : null,
        unit: li.unit,
        unitPrice: li.unitPrice ? li.unitPrice.toNumber() : null,
        total: li.total ? li.total.toNumber() : null,
        confidence: li.confidence ? li.confidence.toNumber() : 0,
        matchedName: li.matchedCanonicalInput?.name ?? null,
      })),
    });

    await this.bot.telegram.sendMessage(Number(link.telegramUserId), text, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        Markup.button.callback('✅ Confirmar', `confirm:${receiptId}`),
        Markup.button.callback('❌ Descartar', `discard:${receiptId}`),
      ]),
    });
  }

  // ---------------------------------------------------------------------------

  private async handleLink(ctx: Context): Promise<void> {
    const telegramUserId = ctx.from?.id;
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    if (!telegramUserId) return;

    const code = (text.trim().split(/\s+/)[1] ?? '').toUpperCase();
    if (!code) {
      await ctx.reply('Uso:  /link TU-CODIGO');
      return;
    }

    const link = await this.prisma.client.telegramLink.findFirst({
      where: { code, verifiedAt: null, codeExpiresAt: { gt: new Date() } },
    });
    if (!link) {
      await ctx.reply('Código inválido o expirado. Genera uno nuevo en la app.');
      return;
    }

    try {
      await this.prisma.client.telegramLink.update({
        where: { id: link.id },
        data: {
          telegramUserId: BigInt(telegramUserId),
          telegramUsername: ctx.from?.username ?? null,
          verifiedAt: new Date(),
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        await ctx.reply('Este Telegram ya está vinculado a otra cuenta de FijaPrecio.');
        return;
      }
      throw err;
    }
    await ctx.reply('✅ Cuenta vinculada. Ahora envíame una foto de tu boleta.');
  }

  private async handlePhoto(ctx: Context): Promise<void> {
    const telegramUserId = ctx.from?.id;
    if (!telegramUserId) return;

    const link = await this.prisma.client.telegramLink.findFirst({
      where: { telegramUserId: BigInt(telegramUserId), verifiedAt: { not: null } },
      select: { userId: true, organizationId: true },
    });
    if (!link) {
      await ctx.reply(LINK_HELP);
      return;
    }

    const photos = ctx.message && 'photo' in ctx.message ? ctx.message.photo : [];
    const largest = photos.at(-1);
    if (!largest) return;

    const key = `receipts/${link.organizationId}/${randomUUID()}.jpg`;
    try {
      const fileLink = await ctx.telegram.getFileLink(largest.file_id);
      const bytes = Buffer.from(await (await fetch(fileLink.toString())).arrayBuffer());
      await this.storage.client.put(key, bytes, 'image/jpeg');
    } catch (err) {
      this.log.error(`fallo subiendo boleta a storage: ${(err as Error).message}`);
      await ctx.reply('No pude guardar la imagen. Intenta de nuevo en un momento.');
      return;
    }

    const receipt = await this.prisma.client.receipt.create({
      data: {
        organizationId: link.organizationId,
        uploadedById: link.userId,
        channel: 'TELEGRAM',
        status: 'RECEIVED',
        storageKey: key,
      },
      select: { id: true },
    });

    await this.queue.enqueueOcrParse(receipt.id);
    await ctx.reply('📸 Recibí tu boleta. La estoy procesando…');
  }

  private async handleAction(ctx: Context, action: 'confirm' | 'discard'): Promise<void> {
    const match = 'match' in ctx ? (ctx.match as RegExpExecArray | undefined) : undefined;
    const receiptId = match?.[1];
    await ctx.answerCbQuery().catch(() => undefined);
    if (!receiptId) return;

    if (action === 'discard') {
      await this.prisma.client.receipt
        .updateMany({ where: { id: receiptId }, data: { status: 'FAILED', errorMessage: 'descartada por el usuario' } })
        .catch(() => undefined);
      await ctx.editMessageText('Boleta descartada.').catch(() => undefined);
      return;
    }

    try {
      const resp = await fetch(`${env.API_URL}/v1/internal/receipts/${receiptId}/confirm`, {
        method: 'POST',
        headers: { 'X-Internal-Token': env.INTERNAL_API_TOKEN },
      });
      if (!resp.ok) throw new Error(`api ${resp.status}`);
      const body = (await resp.json()) as { created: number };
      await ctx
        .editMessageText(
          `✅ Registrado. ${body.created} precio(s) verificado(s) enviados al consenso. ¡Gracias!`,
        )
        .catch(() => undefined);
    } catch (err) {
      this.log.error(`confirm receipt ${receiptId}: ${(err as Error).message}`);
      await ctx.reply('No pude confirmar ahora. Intenta de nuevo en un momento.');
    }
  }
}
