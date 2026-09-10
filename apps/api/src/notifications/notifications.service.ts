import { Injectable } from '@nestjs/common';
import { renderTemplate, type NotificationView } from '@fijaprecio/shared-types';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Centro de notificaciones in-app del usuario. */
  async list(
    orgId: string,
    userId: string,
    opts: { unreadOnly: boolean; limit: number },
  ): Promise<NotificationView[]> {
    const rows = await this.prisma.client.notification.findMany({
      where: {
        organizationId: orgId,
        OR: [{ userId }, { userId: null }],
        status: { not: 'CANCELED' },
        ...(opts.unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: opts.limit,
    });

    const codes = [...new Set(rows.map((r) => r.templateCode))];
    const templates = await this.prisma.client.notificationTemplate.findMany({
      where: { code: { in: codes }, locale: 'es-PE', channel: 'IN_APP' },
    });
    const byCode = new Map(templates.map((t) => [t.code, t]));

    return rows.map((n) => {
      const tpl = byCode.get(n.templateCode);
      const vars = (n.payload ?? {}) as Record<string, unknown>;
      return {
        id: n.id,
        channel: n.channel,
        templateCode: n.templateCode,
        payload: vars,
        title: tpl?.subject ? renderTemplate(tpl.subject, vars) : n.templateCode,
        body: tpl ? renderTemplate(tpl.body, vars) : JSON.stringify(vars),
        status: n.status,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
      };
    });
  }

  async unreadCount(orgId: string, userId: string): Promise<{ count: number }> {
    const count = await this.prisma.client.notification.count({
      where: {
        organizationId: orgId,
        OR: [{ userId }, { userId: null }],
        readAt: null,
        status: { notIn: ['CANCELED', 'FAILED'] },
      },
    });
    return { count };
  }

  async markRead(orgId: string, userId: string, id: string): Promise<void> {
    await this.prisma.client.notification.updateMany({
      where: { id, organizationId: orgId, OR: [{ userId }, { userId: null }], readAt: null },
      data: { readAt: new Date(), status: 'READ' },
    });
  }

  async markAllRead(orgId: string, userId: string): Promise<{ updated: number }> {
    const { count } = await this.prisma.client.notification.updateMany({
      where: {
        organizationId: orgId,
        OR: [{ userId }, { userId: null }],
        readAt: null,
        status: { notIn: ['CANCELED', 'FAILED'] },
      },
      data: { readAt: new Date(), status: 'READ' },
    });
    return { updated: count };
  }
}
