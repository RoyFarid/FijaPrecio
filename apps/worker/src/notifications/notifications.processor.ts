import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { QUEUES } from '@fijaprecio/shared-types';
import { createRedisConnection } from '../redis.js';
import { env } from '../config/env.js';
import { NotificationsService } from './notifications.service.js';

@Injectable()
export class NotificationsProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(NotificationsProcessor.name);
  private worker?: Worker;
  private queue?: Queue;

  constructor(private readonly service: NotificationsService) {}

  async onModuleInit(): Promise<void> {
    this.queue = new Queue(QUEUES.notificationsSend, { connection: createRedisConnection() });
    this.worker = new Worker(QUEUES.notificationsSend, () => this.service.processPending(), {
      connection: createRedisConnection(),
    });
    this.worker.on('failed', (job, err) =>
      this.log.error(`notifications.send ${job?.id}: ${err.message}`),
    );

    await this.queue.add(
      QUEUES.notificationsSend,
      {},
      {
        jobId: 'periodic',
        repeat: { every: env.NOTIFICATIONS_POLL_MINUTES * 60_000 },
        removeOnComplete: true,
      },
    );
    this.log.log(`notifications.send cada ${env.NOTIFICATIONS_POLL_MINUTES} min`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }
}
