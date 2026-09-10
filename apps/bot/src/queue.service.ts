import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { QUEUES } from '@fijaprecio/shared-types';
import { env } from './config/env.js';

/** Productor BullMQ del bot: encola el parseo OCR de las boletas recibidas. */
@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  private readonly ocrParse = new Queue(QUEUES.ocrParse, { connection: this.connection });

  async enqueueOcrParse(receiptId: string): Promise<void> {
    try {
      await this.ocrParse.add(QUEUES.ocrParse, { receiptId }, {
        jobId: receiptId,
        removeOnComplete: true,
        removeOnFail: 100,
      });
    } catch (err) {
      this.logger.error(`No se pudo encolar ocr.parse: ${(err as Error).message}`);
      throw err;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.ocrParse.close();
    await this.connection.quit();
  }
}
