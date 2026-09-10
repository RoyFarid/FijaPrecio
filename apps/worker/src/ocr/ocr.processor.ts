import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { Worker } from 'bullmq';
import { QUEUES } from '@fijaprecio/shared-types';
import { createRedisConnection } from '../redis.js';
import { env } from '../config/env.js';
import { OcrService } from './ocr.service.js';

@Injectable()
export class OcrProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(OcrProcessor.name);
  private worker?: Worker<{ receiptId: string }>;

  constructor(private readonly service: OcrService) {}

  onModuleInit(): void {
    this.worker = new Worker<{ receiptId: string }>(
      QUEUES.ocrParse,
      (job) => this.service.process(job.data.receiptId),
      { connection: createRedisConnection(), concurrency: Math.min(env.WORKER_CONCURRENCY, 3) },
    );
    this.worker.on('failed', (job, err) =>
      this.log.error(`ocr.parse ${job?.id}: ${err.message}`),
    );
    this.log.log('processor ocr.parse listo');
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
