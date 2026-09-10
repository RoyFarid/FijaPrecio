import { Injectable, Logger } from '@nestjs/common';
import { renderTemplate } from '@fijaprecio/shared-types';
import type { Notification, NotificationChannel } from '@fijaprecio/db';
import { PrismaService } from '../prisma.js';
import { env } from '../config/env.js';

@Injectable()
export class NotificationsService {
  private readonly log = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Procesa las notificaciones PENDING cuya `scheduledFor` ya venció. */
  async processPending(): Promise<{ sent: number; failed: number }> {
    const now = new Date();
    const pending = await this.prisma.client.notification.findMany({
      where: {
        status: 'PENDING',
        OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }],
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    let sent = 0;
    let failed = 0;
    for (const n of pending) {
      try {
        await this.deliver(n);
        await this.prisma.client.notification.update({
          where: { id: n.id },
          data: { status: 'SENT', sentAt: new Date() },
        });
        sent += 1;
      } catch (err) {
        await this.prisma.client.notification.update({
          where: { id: n.id },
          data: { status: 'FAILED', error: (err as Error).message.slice(0, 300) },
        });
        failed += 1;
      }
    }
    if (sent + failed > 0) this.log.log(`notificaciones: ${sent} enviadas, ${failed} fallidas`);
    return { sent, failed };
  }

  // ---------------------------------------------------------------------------

  private async deliver(n: Notification): Promise<void> {
    if (n.channel === 'IN_APP') return; // el frontend la lee del centro de notificaciones

    const { subject, body } = await this.render(n);

    if (n.channel === 'EMAIL') return this.deliverEmail(n, subject, body);
    if (n.channel === 'TELEGRAM') return this.deliverTelegram(n, subject, body);
  }

  private async render(n: Notification): Promise<{ subject: string; body: string }> {
    const tpl = await this.prisma.client.notificationTemplate.findUnique({
      where: {
        code_locale_channel: {
          code: n.templateCode,
          locale: 'es-PE',
          channel: n.channel as NotificationChannel,
        },
      },
    });
    const vars = (n.payload ?? {}) as Record<string, unknown>;
    return {
      subject: tpl?.subject ? renderTemplate(tpl.subject, vars) : 'FijaPrecio',
      body: tpl ? renderTemplate(tpl.body, vars) : JSON.stringify(vars),
    };
  }

  private async deliverEmail(n: Notification, subject: string, body: string): Promise<void> {
    if (!env.RESEND_API_KEY) {
      this.log.warn(`EMAIL ${n.id}: sin RESEND_API_KEY, se omite`);
      return;
    }
    if (!n.userId) throw new Error('notificación EMAIL sin userId');
    const user = await this.prisma.client.user.findUnique({
      where: { id: n.userId },
      select: { email: true },
    });
    if (!user?.email) throw new Error('usuario sin email');

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: user.email, subject, text: body }),
    });
    if (!resp.ok) throw new Error(`resend ${resp.status}`);
  }

  private async deliverTelegram(n: Notification, subject: string, body: string): Promise<void> {
    if (!env.BOT_INTERNAL_URL) throw new Error('BOT_INTERNAL_URL no configurada');
    if (!n.userId) throw new Error('notificación TELEGRAM sin userId');

    const resp = await fetch(`${env.BOT_INTERNAL_URL}/internal/send-notification`, {
      method: 'POST',
      headers: {
        'X-Internal-Token': env.INTERNAL_API_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId: n.userId, text: `*${subject}*\n${body}` }),
    });
    if (!resp.ok) throw new Error(`bot ${resp.status}`);
  }
}
