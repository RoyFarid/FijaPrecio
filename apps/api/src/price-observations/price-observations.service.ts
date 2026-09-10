import { Injectable } from '@nestjs/common';
import type {
  ConsensusRecalcJob,
  PriceConsensusView,
  PriceObservationBatch,
  PriceObservationInput,
} from '@fijaprecio/shared-types';
import type { Prisma } from '@fijaprecio/db';
import { PrismaService } from '../prisma/prisma.service.js';
import { AppConfigService } from '../config/app-config.service.js';
import { QueueService } from '../queue/queue.service.js';
import type { ScrapeTarget } from './dto.js';

const tupleKey = (t: ConsensusRecalcJob): string =>
  `${t.canonicalInputId}|${t.region}|${t.scope}|${t.currency}`;

@Injectable()
export class PriceObservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly queue: QueueService,
  ) {}

  /** Aporte manual de un usuario autenticado (source siempre MANUAL). */
  async createManual(
    orgId: string,
    userId: string,
    dto: Omit<PriceObservationInput, 'source'>,
  ): Promise<{ id: string }> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { reputation: true },
    });

    const obs = await this.prisma.client.priceObservation.create({
      data: {
        scope: dto.scope,
        canonicalInputId: dto.canonicalInputId ?? null,
        productQuery: dto.productQuery ?? null,
        organizationId: orgId,
        reporterUserId: userId,
        reporterReputation: user?.reputation ?? 0,
        price: dto.price,
        currency: dto.currency,
        unit: dto.unit,
        region: dto.region,
        source: 'MANUAL',
        observedAt: dto.observedAt ? new Date(dto.observedAt) : new Date(),
      },
      select: { id: true, canonicalInputId: true, region: true, scope: true, currency: true },
    });

    await this.enqueueFor([obs]);
    return { id: obs.id };
  }

  /** Ingesta batch desde servicios internos (scraper / gov / OCR). */
  async ingestBatch(dto: PriceObservationBatch): Promise<{ created: number }> {
    const data: Prisma.PriceObservationCreateManyInput[] = dto.observations.map((o) => ({
      scope: o.scope,
      canonicalInputId: o.canonicalInputId ?? null,
      productQuery: o.productQuery ?? null,
      price: o.price,
      currency: o.currency,
      unit: o.unit,
      region: o.region,
      source: o.source,
      sourceRef: o.sourceRef ?? null,
      observedAt: o.observedAt ? new Date(o.observedAt) : new Date(),
    }));

    const res = await this.prisma.client.priceObservation.createMany({
      data,
      skipDuplicates: true, // idempotencia por @@unique([source, sourceRef])
    });

    await this.enqueueFor(
      dto.observations
        .filter((o) => o.scope === 'INPUT' && o.canonicalInputId)
        .map((o) => ({
          canonicalInputId: o.canonicalInputId as string,
          region: o.region,
          scope: o.scope,
          currency: o.currency,
        })),
    );

    return { created: res.count };
  }

  async getConsensus(
    canonicalInputId: string,
    region: string,
    currency: string,
  ): Promise<PriceConsensusView | null> {
    const row = await this.prisma.client.priceConsensus.findUnique({
      where: {
        canonicalInputId_region_scope_currency: {
          canonicalInputId,
          region,
          scope: 'INPUT',
          currency,
        },
      },
    });
    if (!row) return null;

    const minToShow = await this.config.getGlobal('consensus.confidence_min_to_show');
    return {
      canonicalInputId: row.canonicalInputId,
      region: row.region,
      scope: 'INPUT',
      currency: row.currency,
      median: row.median.toNumber(),
      p25: row.p25.toNumber(),
      p75: row.p75.toNumber(),
      weightedMean: row.mean.toNumber(),
      mad: row.mad.toNumber(),
      sampleSize: row.sampleSize,
      confidence: row.confidence.toNumber(),
      showable: row.confidence.toNumber() >= minToShow,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /**
   * Insumos canónicos que vale la pena raspar: ACTIVE, referenciados por al menos
   * un `OrgInput` vivo, ordenados por consenso más viejo (o inexistente) primero.
   */
  async scrapeTargets(limit: number): Promise<ScrapeTarget[]> {
    // raw + JOIN a OrgInput (tabla de tenant) → asSystem para saltar RLS.
    const rows = await this.prisma.asSystem((tx) =>
      tx.$queryRaw<Array<{ canonicalInputId: string; query: string; baseUnit: string }>>`
        SELECT ci.id AS "canonicalInputId", ci.name AS query, ci."baseUnit" AS "baseUnit"
        FROM "CanonicalInput" ci
        JOIN "OrgInput" oi
          ON oi."canonicalInputId" = ci.id AND oi."archivedAt" IS NULL
        LEFT JOIN "PriceConsensus" pc
          ON pc."canonicalInputId" = ci.id AND pc.scope = 'INPUT'
        WHERE ci.status = 'ACTIVE'
        GROUP BY ci.id, ci.name, ci."baseUnit"
        ORDER BY MIN(pc."updatedAt") ASC NULLS FIRST
        LIMIT ${limit}`,
    );
    return rows;
  }

  // ---------------------------------------------------------------------------

  private async enqueueFor(
    obs: Array<{
      canonicalInputId: string | null;
      region: string;
      scope: string;
      currency: string;
    }>,
  ): Promise<void> {
    const seen = new Map<string, ConsensusRecalcJob>();
    for (const o of obs) {
      if (o.scope !== 'INPUT' || !o.canonicalInputId) continue;
      const job: ConsensusRecalcJob = {
        canonicalInputId: o.canonicalInputId,
        region: o.region,
        scope: 'INPUT',
        currency: o.currency,
      };
      seen.set(tupleKey(job), job);
    }
    for (const job of seen.values()) {
      await this.queue.enqueueConsensusRecalc(job);
    }
  }
}
