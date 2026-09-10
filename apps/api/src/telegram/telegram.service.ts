import { randomInt } from 'node:crypto';
import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

// Sin caracteres ambiguos (0/O, 1/I/L).
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomCode(len = 8): string {
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

@Injectable()
export class TelegramService {
  constructor(private readonly prisma: PrismaService) {}

  /** Genera (o regenera) el código que el usuario envía al bot para vincular. */
  async createLinkCode(
    orgId: string,
    userId: string,
  ): Promise<{ code: string; expiresAt: string }> {
    const existing = await this.prisma.client.telegramLink.findUnique({
      where: { userId },
      select: { verifiedAt: true },
    });
    if (existing?.verifiedAt) {
      throw new ConflictException('Tu cuenta ya está vinculada a Telegram');
    }

    const code = randomCode();
    const codeExpiresAt = new Date(Date.now() + 15 * 60_000);

    await this.prisma.client.telegramLink.upsert({
      where: { userId },
      create: { userId, organizationId: orgId, code, codeExpiresAt },
      update: {
        organizationId: orgId,
        code,
        codeExpiresAt,
        telegramUserId: null,
        telegramUsername: null,
        verifiedAt: null,
      },
    });

    return { code, expiresAt: codeExpiresAt.toISOString() };
  }
}
