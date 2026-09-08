import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Worker } from 'bullmq';
import { createRedisConnection } from '../redis.js';
import { QUEUES } from '../queues.js';
import { env } from '../config/env.js';
import { PrismaService } from '../prisma.js';

/**
 * Recalcula PriceConsensus para (canonicalInput, region, scope).
 * Implementación real: ver ARQUITECTURA.md §9.5 (ventana temporal, pesos por
 * fuente, MAD, decaimiento por recencia). Todos los parámetros salen de
 * AppSetting, no del código.
 */
@Injectable()
export class ConsensusProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(ConsensusProcessor.name);
  private worker?: Worker;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    this.worker = new Worker(
      QUEUES.consensusRecalc,
      async (job) => {
        const { canonicalInputId, region } = job.data as {
          canonicalInputId: string;
          region: string;
        };
        this.log.log(`recalculando consenso: ${canonicalInputId} / ${region}`);
        // TODO: leer AppSetting (window_days, mad_threshold, source_weights...),
        //       cargar observaciones, filtrar outliers (MAD), upsert PriceConsensus.
        void this.prisma;
      },
      { connection: createRedisConnection(), concurrency: env.WORKER_CONCURRENCY },
    );

    this.worker.on('failed', (job, err) => this.log.error(`job ${job?.id} falló: ${err.message}`));
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
