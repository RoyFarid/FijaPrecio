import { Injectable, Logger } from '@nestjs/common';
import type { ConsensusRecalcJob } from '@fijaprecio/shared-types';
import { PrismaService } from '../prisma.js';
import { loadConsensusConfig } from './config.js';
import { computeConsensus, type ConsensusObservation } from './engine.js';

const DAY_MS = 86_400_000;

@Injectable()
export class ConsensusService {
  private readonly log = new Logger(ConsensusService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Recalcula PriceConsensus para un (canonicalInput, region, scope, currency). */
  async recalc(job: ConsensusRecalcJob): Promise<Record<string, unknown>> {
    const input = await this.prisma.client.canonicalInput.findUnique({
      where: { id: job.canonicalInputId },
      select: { baseUnit: true },
    });
    if (!input) return { skipped: 'canonical input inexistente' };

    const config = await loadConsensusConfig(this.prisma.client);
    const since = new Date(Date.now() - config.windowDays * DAY_MS);
    const tuple = {
      canonicalInputId: job.canonicalInputId,
      region: job.region,
      scope: job.scope,
      currency: job.currency,
    };

    const rows = await this.prisma.client.priceObservation.findMany({
      where: {
        ...tuple,
        unit: input.baseUnit, // v1: sin conversión de unidades
        observedAt: { gte: since },
        OR: [
          { status: 'ACTIVE' },
          { status: 'REJECTED', rejectionReason: { startsWith: 'consensus:' } },
        ],
      },
      select: {
        id: true,
        price: true,
        source: true,
        observedAt: true,
        reporterReputation: true,
      },
    });

    const observations: ConsensusObservation[] = rows.map((r) => ({
      id: r.id,
      price: r.price.toNumber(),
      source: r.source,
      observedAt: r.observedAt,
      reporterReputation: r.reporterReputation,
    }));

    const result = computeConsensus(observations, config, new Date());

    if (!result.stats) {
      await this.prisma.client.priceConsensus.deleteMany({ where: tuple });
      return { status: result.status, sampleSize: result.sampleSize };
    }

    const s = result.stats;
    const values = {
      median: s.median,
      p25: s.p25,
      p75: s.p75,
      mean: s.weightedMean,
      mad: s.mad,
      sampleSize: result.sampleSize,
      confidence: s.confidence,
    };
    await this.prisma.client.priceConsensus.upsert({
      where: { canonicalInputId_region_scope_currency: tuple },
      create: { ...tuple, ...values },
      update: values,
    });

    // Transiciones de estado — auditables y reversibles, nunca se borra.
    if (result.rejectedIds.length > 0) {
      await this.prisma.client.priceObservation.updateMany({
        where: { id: { in: result.rejectedIds }, status: 'ACTIVE' },
        data: { status: 'REJECTED', rejectionReason: 'consensus:outlier' },
      });
    }
    if (result.acceptedIds.length > 0) {
      await this.prisma.client.priceObservation.updateMany({
        where: {
          id: { in: result.acceptedIds },
          status: 'REJECTED',
          rejectionReason: { startsWith: 'consensus:' },
        },
        data: { status: 'ACTIVE', rejectionReason: null },
      });
    }

    // TODO(reputación): +OBSERVATION_SURVIVED / -OBSERVATION_REJECTED por
    // transición (necesita idempotencia para no puntuar en cada barrido).

    return {
      status: 'OK',
      sampleSize: result.sampleSize,
      rejected: result.rejectedIds.length,
      confidence: s.confidence,
    };
  }

  /** Enumera los tuples con observaciones recientes y los re-encola. */
  async sweep(enqueue: (job: ConsensusRecalcJob) => Promise<void>): Promise<number> {
    const config = await loadConsensusConfig(this.prisma.client);
    const since = new Date(Date.now() - config.windowDays * DAY_MS);

    const groups = await this.prisma.client.priceObservation.groupBy({
      by: ['canonicalInputId', 'region', 'scope', 'currency'],
      where: {
        status: 'ACTIVE',
        canonicalInputId: { not: null },
        observedAt: { gte: since },
      },
    });

    let enqueued = 0;
    for (const g of groups) {
      if (!g.canonicalInputId) continue;
      await enqueue({
        canonicalInputId: g.canonicalInputId,
        region: g.region,
        scope: g.scope,
        currency: g.currency,
      });
      enqueued++;
    }
    this.log.log(`sweep: ${enqueued} recálculos encolados`);
    return enqueued;
  }
}
