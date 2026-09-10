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
import { PrismaService } from '../prisma.js';

const DEFAULT_CRON = '0 * * * *';

/**
 * Dispara la evaluación de alertas según `alerts.check_cron` (AppSetting). La
 * lógica de evaluación vive en la API core (necesita el motor de costeo).
 */
@Injectable()
export class AlertsProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(AlertsProcessor.name);
  private worker?: Worker;
  private queue?: Queue;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    const cron = await this.loadCron();
    this.queue = new Queue(QUEUES.alertsCheck, { connection: createRedisConnection() });
    this.worker = new Worker(QUEUES.alertsCheck, () => this.run(), {
      connection: createRedisConnection(),
    });
    this.worker.on('failed', (job, err) =>
      this.log.error(`alerts.check ${job?.id}: ${err.message}`),
    );

    await this.queue.add(
      QUEUES.alertsCheck,
      {},
      { jobId: 'periodic', repeat: { pattern: cron }, removeOnComplete: true },
    );
    this.log.log(`alerts.check programado (${cron})`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }

  private async run(): Promise<unknown> {
    const resp = await fetch(`${env.API_URL}/v1/internal/alerts/run`, {
      method: 'POST',
      headers: { 'X-Internal-Token': env.INTERNAL_API_TOKEN },
    });
    if (!resp.ok) throw new Error(`api ${resp.status}: ${await resp.text()}`);
    const summary = await resp.json();
    this.log.log(`alerts.check → ${JSON.stringify(summary)}`);
    return summary;
  }

  private async loadCron(): Promise<string> {
    const row = await this.prisma.client.appSetting.findFirst({
      where: { scope: 'GLOBAL', key: 'alerts.check_cron' },
      select: { value: true },
    });
    const cron = typeof row?.value === 'string' ? row.value : DEFAULT_CRON;
    return cron.trim() || DEFAULT_CRON;
  }
}
