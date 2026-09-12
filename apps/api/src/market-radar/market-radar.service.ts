import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { MarketPriceBatch, MarketRadarView, SampleLink } from '@fijaprecio/shared-types';
import type { Prisma } from '@fijaprecio/db';
import { PrismaService } from '../prisma/prisma.service.js';
import { CostingService } from '../costing/costing.service.js';
import { AppConfigService } from '../config/app-config.service.js';
import { env } from '../config/env.js';
import { computeRadarPosition } from './position.js';

export interface MarketHistoryPoint {
  capturedAt: string;
  minPrice: number;
  p25: number | null;
  avgPrice: number;
  medianPrice: number | null;
  p75: number | null;
  premiumPrice: number | null;
  sampleSize: number;
}

export interface MarketHistory {
  productId: string;
  region: string;
  currency: string;
  windowDays: number;
  points: MarketHistoryPoint[];
}

const normalizeQuery = (q: string): string =>
  q
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

export interface RadarTarget {
  productId: string;
  query: string;
  region: string;
  currency: string;
  /** Rubro del producto, para acotar qué fuentes se raspan en el radar. */
  rubro: string | null;
  /** Unidad de venta (de la receta activa), para normalizar paquete → precio unitario. */
  baseUnit: string | null;
}

@Injectable()
export class MarketRadarService {
  private readonly logger = new Logger(MarketRadarService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly costing: CostingService,
    private readonly config: AppConfigService,
  ) {}

  /** Serie temporal de precios de mercado del producto (para el gráfico). */
  async historyForProduct(
    orgId: string,
    productId: string,
    region?: string,
  ): Promise<MarketHistory> {
    const product = await this.prisma.client.product.findFirst({
      where: { id: productId, organizationId: orgId },
      include: { organization: { select: { region: true } } },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');

    const resolvedRegion = region ?? product.organization.region;
    const windowDays = await this.config.get(orgId, 'radar_history_days');
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    const rows = await this.prisma.client.marketPrice.findMany({
      where: {
        productId,
        region: resolvedRegion,
        currency: product.currency,
        capturedAt: { gte: since },
      },
      orderBy: { capturedAt: 'asc' },
      take: 365,
    });

    return {
      productId,
      region: resolvedRegion,
      currency: product.currency,
      windowDays,
      points: rows.map((r) => ({
        capturedAt: r.capturedAt.toISOString(),
        minPrice: r.minPrice.toNumber(),
        p25: r.p25?.toNumber() ?? null,
        avgPrice: r.avgPrice.toNumber(),
        medianPrice: r.medianPrice?.toNumber() ?? null,
        p75: r.p75?.toNumber() ?? null,
        premiumPrice: r.premiumPrice?.toNumber() ?? null,
        sampleSize: r.sampleSize,
      })),
    };
  }

  /** Ingesta de snapshots agregados desde el scraper. */
  async ingest(batch: MarketPriceBatch): Promise<{ created: number }> {
    const data: Prisma.MarketPriceCreateManyInput[] = batch.snapshots.map((s) => ({
      productId: s.productId,
      productQuery: s.productQuery,
      normalizedQuery: normalizeQuery(s.productQuery),
      region: s.region,
      currency: s.currency,
      minPrice: s.minPrice,
      p25: s.p25,
      avgPrice: s.avgPrice,
      medianPrice: s.medianPrice,
      p75: s.p75,
      premiumPrice: s.premiumPrice,
      sampleSize: s.sampleSize,
      sourceBreakdown: s.sourceBreakdown as Prisma.InputJsonValue,
      sampleLinks: s.sampleLinks as unknown as Prisma.InputJsonValue,
      scrapingJobId: s.scrapingJobId,
    }));
    const res = await this.prisma.client.marketPrice.createMany({ data });
    return { created: res.count };
  }

  /** Productos que conviene raspar para el radar (snapshot más viejo primero). */
  async radarTargets(limit: number): Promise<RadarTarget[]> {
    // raw + JOIN a Product/Organization (tablas de tenant) → asSystem para saltar RLS.
    const rows = await this.prisma.asSystem((tx) =>
      tx.$queryRaw<
        Array<{
          productId: string;
          query: string;
          region: string;
          currency: string;
          rubro: string | null;
          baseUnit: string | null;
        }>
      >`
        SELECT p.id AS "productId", COALESCE(p."radarQuery", p.name) AS query,
               o.region AS region, p.currency AS currency, p.rubro AS rubro,
               pr."outputUnit" AS "baseUnit"
        FROM "Product" p
        JOIN "Organization" o ON o.id = p."organizationId"
        LEFT JOIN "MarketPrice" mp ON mp."productId" = p.id
        LEFT JOIN "ProductRecipe" pr ON pr."productId" = p.id AND pr."isActive" = true
        WHERE p.status != 'ARCHIVED' AND p."archivedAt" IS NULL
        GROUP BY p.id, p.name, p."radarQuery", o.region, p.currency, p.rubro, pr."outputUnit"
        ORDER BY MAX(mp."capturedAt") ASC NULLS FIRST
        LIMIT ${limit}`,
    );
    return rows;
  }

  /** Radar para un producto: mercado + tu precio + posición. */
  async forProduct(
    orgId: string,
    productId: string,
    region?: string,
  ): Promise<MarketRadarView> {
    const product = await this.prisma.client.product.findFirst({
      where: { id: productId, organizationId: orgId },
      include: { organization: { select: { region: true } } },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');

    const resolvedRegion = region ?? product.organization.region;

    const latest = await this.prisma.client.marketPrice.findFirst({
      where: { productId, region: resolvedRegion, currency: product.currency },
      orderBy: { capturedAt: 'desc' },
    });

    let suggested: number | null = null;
    try {
      suggested = (await this.costing.computeForProduct(orgId, productId)).suggestedPrice;
    } catch {
      suggested = null; // sin receta activa aún
    }
    const target = product.targetPrice ? product.targetPrice.toNumber() : null;

    if (!latest) {
      return {
        productId,
        region: resolvedRegion,
        currency: product.currency,
        market: null,
        yourPrice: { suggested, target },
        position: null,
      };
    }

    const market = {
      minPrice: latest.minPrice.toNumber(),
      p25: latest.p25?.toNumber() ?? null,
      avgPrice: latest.avgPrice.toNumber(),
      medianPrice: latest.medianPrice?.toNumber() ?? null,
      p75: latest.p75?.toNumber() ?? null,
      premiumPrice: latest.premiumPrice?.toNumber() ?? null,
    };

    return {
      productId,
      region: resolvedRegion,
      currency: product.currency,
      market: {
        ...market,
        sampleSize: latest.sampleSize,
        sourceBreakdown: (latest.sourceBreakdown ?? {}) as Record<string, number>,
        sampleLinks: (latest.sampleLinks ?? []) as unknown as SampleLink[],
        capturedAt: latest.capturedAt.toISOString(),
      },
      yourPrice: { suggested, target },
      position: suggested != null ? computeRadarPosition(suggested, market) : null,
    };
  }

  /**
   * Dispara un scrape del radar para UN producto recién creado, ya (sin
   * esperar al próximo barrido nocturno). Best-effort: si falla o el
   * scraper no responde, el producto igual entra al barrido periódico —
   * `radarTargets()` prioriza los que nunca tuvieron snapshot (NULLS FIRST).
   */
  async triggerScan(productId: string): Promise<void> {
    const product = await this.prisma.asSystem((tx) =>
      tx.product.findFirst({
        where: { id: productId },
        include: {
          organization: { select: { region: true } },
          recipes: { where: { isActive: true }, take: 1, select: { outputUnit: true } },
        },
      }),
    );
    if (!product) return;

    const body = {
      scope: 'FINAL_PRODUCT',
      productId: product.id,
      query: product.radarQuery ?? product.name,
      region: product.organization.region,
      currency: product.currency,
      rubro: product.rubro,
      baseUnit: product.recipes[0]?.outputUnit ?? null,
    };

    try {
      const res = await fetch(`${env.SCRAPER_URL}/internal/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Internal-Token': env.INTERNAL_API_TOKEN },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) {
        this.logger.warn(`scan inmediato respondió ${res.status} para producto ${productId}`);
      }
    } catch (err) {
      this.logger.warn(`No se pudo disparar el scan inmediato de ${productId}: ${(err as Error).message}`);
    }
  }
}
