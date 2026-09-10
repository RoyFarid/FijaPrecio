import { Controller, HttpCode, Post } from '@nestjs/common';
import { TelegramService } from './telegram.service.js';
import { CurrentOrg } from '../tenancy/current-org.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';

@Controller('telegram')
export class TelegramController {
  constructor(private readonly telegram: TelegramService) {}

  /** Devuelve un código de un solo uso para vincular la cuenta con el bot. */
  @Post('link-code')
  @HttpCode(200)
  linkCode(
    @CurrentOrg() orgId: string,
    @CurrentUser('userId') userId: string,
  ): Promise<{ code: string; expiresAt: string }> {
    return this.telegram.createLinkCode(orgId, userId);
  }
}
