import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { z } from 'zod';
import type { NotificationView } from '@fijaprecio/shared-types';
import { NotificationsService } from './notifications.service.js';
import { ZodBody } from '../common/zod-validation.pipe.js';
import { CurrentOrg } from '../tenancy/current-org.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';

const listQuerySchema = z.object({
  unreadOnly: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
type ListQuery = z.infer<typeof listQuerySchema>;

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @CurrentOrg() orgId: string,
    @CurrentUser('userId') userId: string,
    @Query(new ZodBody(listQuerySchema)) query: ListQuery,
  ): Promise<NotificationView[]> {
    return this.notifications.list(orgId, userId, query);
  }

  @Get('unread-count')
  unreadCount(
    @CurrentOrg() orgId: string,
    @CurrentUser('userId') userId: string,
  ): Promise<{ count: number }> {
    return this.notifications.unreadCount(orgId, userId);
  }

  @Post('read-all')
  @HttpCode(200)
  readAll(
    @CurrentOrg() orgId: string,
    @CurrentUser('userId') userId: string,
  ): Promise<{ updated: number }> {
    return this.notifications.markAllRead(orgId, userId);
  }

  @Post(':id/read')
  @HttpCode(204)
  read(
    @CurrentOrg() orgId: string,
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.notifications.markRead(orgId, userId, id);
  }
}
