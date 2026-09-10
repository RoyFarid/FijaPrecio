import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { QUEUES, type ConsensusRecalcJob } from '@fijaprecio/shared-types';
import { env } from '../config/env.js';

/** Productor BullMQ del `api`. El consumo lo hace el `worker`. */
@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

  private readonly consensusRecalc = new Queue<ConsensusRecalcJob>(QUEUES.consensusRecalc, {
    connection: this.connection,
  });

  async enqueueConsensusRecalc(job: ConsensusRecalcJob): Promise<void> {
    try {
      await this.consensusRecalc.add(QUEUES.consensusRecalc, job, {
        // BullMQ prohíbe ":" en el jobId (igual que en el nombre de cola).
        jobId: `${job.canonicalInputId}~${job.region}~${job.scope}~${job.currency}`,
        removeOnComplete: true,
        removeOnFail: 100,
      });
    } catch (err) {
      // Encolar es best-effort: el barrido periódico del worker recupera lo perdido.
      this.logger.warn(`No se pudo encolar recálculo de consenso: ${(err as Error).message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.consensusRecalc.close();
    await this.connection.quit();
  }
}
