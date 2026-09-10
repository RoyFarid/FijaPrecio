import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { QUEUES, type ConsensusRecalcJob } from '@fijaprecio/shared-types';
import { createRedisConnection } from '../redis.js';
import { env } from '../config/env.js';
import { ConsensusService } from './consensus.service.js';

// BullMQ prohíbe ":" en el jobId (igual que en el nombre de cola).
const recalcJobId = (j: ConsensusRecalcJob): string =>
  `${j.canonicalInputId}~${j.region}~${j.scope}~${j.currency}`;

/**
 * Cablea el motor de consenso a BullMQ:
 *  - Worker `consensus.recalc` → ConsensusService.recalc
 *  - Worker `consensus.sweep`  → ConsensusService.sweep (re-encola recálculos)
 *  - Job repetible que dispara el sweep cada CONSENSUS_SWEEP_INTERVAL_MINUTES
 */
@Injectable()
export class ConsensusProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(ConsensusProcessor.name);
  private readonly workers: Worker[] = [];
  private readonly queues: Queue[] = [];

  constructor(private readonly service: ConsensusService) {}

  async onModuleInit(): Promise<void> {
    const recalcQueue = new Queue(QUEUES.consensusRecalc, { connection: createRedisConnection() });
    const sweepQueue = new Queue(QUEUES.consensusSweep, { connection: createRedisConnection() });
    this.queues.push(recalcQueue, sweepQueue);

    this.workers.push(
      new Worker<ConsensusRecalcJob>(
        QUEUES.consensusRecalc,
        (job) => this.service.recalc(job.data),
        { connection: createRedisConnection(), concurrency: env.WORKER_CONCURRENCY },
      ),
      new Worker(
        QUEUES.consensusSweep,
        () =>
          this.service.sweep(async (j) => {
            await recalcQueue.add(QUEUES.consensusRecalc, j, {
              jobId: recalcJobId(j),
              removeOnComplete: true,
              removeOnFail: 100,
            });
          }),
        { connection: createRedisConnection() },
      ),
    );

    for (const w of this.workers) {
      w.on('failed', (job, err) => this.log.error(`${job?.name} ${job?.id}: ${err.message}`));
    }

    await sweepQueue.add(
      QUEUES.consensusSweep,
      {},
      {
        jobId: 'periodic-sweep',
        repeat: { every: env.CONSENSUS_SWEEP_INTERVAL_MINUTES * 60_000 },
        removeOnComplete: true,
      },
    );
    this.log.log(
      `consenso listo — sweep cada ${env.CONSENSUS_SWEEP_INTERVAL_MINUTES} min`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.workers.map((w) => w.close()));
    await Promise.all(this.queues.map((q) => q.close()));
  }
}
