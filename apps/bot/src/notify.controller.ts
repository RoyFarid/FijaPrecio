import {
  Body,
  Controller,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { BotService } from './bot.service.js';
import { InternalTokenGuard } from './internal-token.guard.js';

@UseGuards(InternalTokenGuard)
@Controller('internal')
export class NotifyController {
  constructor(private readonly bot: BotService) {}

  /** El worker llama aquí cuando terminó de parsear una boleta. */
  @Post('notify')
  @HttpCode(202)
  async notify(@Body('receiptId') receiptId: string): Promise<{ status: string }> {
    await this.bot.sendReceiptSummary(receiptId);
    return { status: 'sent' };
  }

  /** Notificación genérica (alertas) → mensaje de Telegram al usuario. */
  @Post('send-notification')
  @HttpCode(202)
  async send(
    @Body('userId') userId: string,
    @Body('text') text: string,
  ): Promise<{ status: string }> {
    const delivered = await this.bot.sendUserMessage(userId, text);
    return { status: delivered ? 'sent' : 'no-telegram-link' };
  }
}
