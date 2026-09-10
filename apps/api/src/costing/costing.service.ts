import { createHash } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import type { CostingResult } from '@fijaprecio/shared-types';
import type { Prisma } from '@fijaprecio/db';
import { PrismaService } from '../prisma/prisma.service.js';
import { AppConfigService } from '../config/app-config.service.js';
import {
  computeCosting,
  type EngineComponent,
  type EngineConfig,
  type EngineInput,
  type EngineLine,
  type PriceSource,
} from './engine.js';

const dec = (v: Prisma.Decimal | null | undefined): number | null =>
  v == null ? null : v.toNumber();

@Injectable()
export class CostingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  /** Costea la receta activa del producto. No persiste. */
  async computeForProduct(orgId: string, productId: string): Promise<CostingResult> {
    const { engineInput } = await this.buildEngineInput(orgId, productId);
    const engineConfig = await this.loadConfig(orgId);
    const result = computeCosting(engineInput, engineConfig);
    return { ...result, computedAt: new Date().toISOString() };
  }

  /**
   * Prepara `engineInput` + `engineConfig` + medianas de mercado (consenso) de la
   * receta activa. Lo consumen el costeo y el análisis de sensibilidad.
   */
  async prepare(
    orgId: string,
    productId: string,
  ): Promise<{
    engineInput: EngineInput;
    engineConfig: EngineConfig;
    marketMedians: Record<string, number | null>;
  }> {
    const [{ engineInput, marketMedians }, engineConfig] = await Promise.all([
      this.buildEngineInput(orgId, productId),
      this.loadConfig(orgId),
    ]);
    return { engineInput, engineConfig, marketMedians };
  }

  /** Costea y guarda un CostingSnapshot auditable. */
  async snapshotForProduct(orgId: string, productId: string): Promise<CostingResult & { id: string }> {
    const { product, recipe, engineInput } = await this.buildEngineInput(orgId, productId);
    const engineConfig = await this.loadConfig(orgId);
    const result = computeCosting(engineInput, engineConfig);
    const computedAt = new Date();

    const snapshot = await this.prisma.client.costingSnapshot.create({
      data: {
        productId: product.id,
        recipeId: recipe.id,
        organizationId: orgId,
        currency: result.currency,
        totalCost: result.totalCost,
        unitCost: result.unitCost,
        suggestedPrice: result.suggestedPrice,
        marginPct: result.marginPct,
        targetPrice: result.targetPrice,
        targetCost: result.targetCost,
        costGap: result.costGap,
        breakdown: result.lines as unknown as Prisma.InputJsonValue,
        configUsed: result.configUsed as unknown as Prisma.InputJsonValue,
        inputsHash: this.hashInputs(engineInput, engineConfig),
        computedAt,
      },
      select: { id: true },
    });

    return { ...result, computedAt: computedAt.toISOString(), id: snapshot.id };
  }

  // ---------------------------------------------------------------------------

  private async loadConfig(orgId: string): Promise<EngineConfig> {
    const [igvRate, defaultMarginPct, priceFromMarkupOnPrice] = await Promise.all([
      this.config.get(orgId, 'tax.igv_rate'),
      this.config.get(orgId, 'costing.default_margin_pct'),
      this.config.get(orgId, 'costing.price_from_markup_on_price'),
    ]);
    return { igvRate, defaultMarginPct, priceFromMarkupOnPrice };
  }

  private async buildEngineInput(orgId: string, productId: string) {
    const product = await this.prisma.client.product.findFirst({
      where: { id: productId, organizationId: orgId },
      include: {
        organization: { select: { region: true } },
        recipes: {
          where: { isActive: true },
          include: {
            lines: { orderBy: { sortOrder: 'asc' }, include: { orgInput: true } },
            costComponents: { orderBy: { sortOrder: 'asc' } },
          },
        },
      },
    });

    if (!product) throw new NotFoundException('Producto no encontrado');
    const recipe = product.recipes[0];
    if (!recipe) throw new NotFoundException('El producto no tiene una receta activa');

    // Consenso de mercado: una sola query para todos los insumos de la receta.
    const canonicalIds = [
      ...new Set(
        recipe.lines
          .map((l) => l.orgInput.canonicalInputId)
          .filter((id): id is string => id != null),
      ),
    ];
    let consensusByCanonical = new Map<string, { median: number; confidence: number }>();
    let minConfidenceToUse = 1;
    if (canonicalIds.length > 0) {
      const [rows, minShow] = await Promise.all([
        this.prisma.client.priceConsensus.findMany({
          where: {
            canonicalInputId: { in: canonicalIds },
            region: product.organization.region,
            scope: 'INPUT',
            currency: product.currency,
          },
          select: { canonicalInputId: true, median: true, confidence: true },
        }),
        this.config.getGlobal('consensus.confidence_min_to_show'),
      ]);
      minConfidenceToUse = minShow;
      consensusByCanonical = new Map(
        rows.map((r) => [
          r.canonicalInputId,
          { median: r.median.toNumber(), confidence: r.confidence.toNumber() },
        ]),
      );
    }

    const marketMedians: Record<string, number | null> = {};

    const lines: EngineLine[] = recipe.lines.map((l) => {
      const consensus = l.orgInput.canonicalInputId
        ? consensusByCanonical.get(l.orgInput.canonicalInputId)
        : undefined;
      marketMedians[l.id] = consensus?.median ?? null;

      let unitCost = 0;
      let priceSource: PriceSource = 'missing';
      if (l.unitCostOverride != null) {
        unitCost = l.unitCostOverride.toNumber();
        priceSource = 'override';
      } else if (l.orgInput.lastKnownPrice != null) {
        unitCost = l.orgInput.lastKnownPrice.toNumber();
        priceSource = 'org_input';
      } else if (consensus && consensus.confidence >= minConfidenceToUse) {
        unitCost = consensus.median;
        priceSource = 'consensus';
      }
      return {
        ref: l.id,
        label: l.orgInput.displayName,
        quantity: l.quantity.toNumber(),
        unit: l.unit,
        wastePct: l.wastePct.toNumber(),
        unitCost,
        priceSource,
      };
    });

    const components: EngineComponent[] = recipe.costComponents.map((c) => ({
      ref: c.id,
      label: c.label,
      type: c.type,
      calc: c.calc,
      value: c.value.toNumber(),
    }));

    const engineInput: EngineInput = {
      currency: product.currency,
      outputQuantity: recipe.outputQuantity.toNumber(),
      laborMinutes: dec(recipe.laborMinutes) ?? 0,
      lines,
      components,
      targetPrice: dec(product.targetPrice),
      targetMarginPct: dec(product.targetMarginPct),
    };

    return { product, recipe, engineInput, marketMedians };
  }

  private hashInputs(input: EngineInput, config: EngineConfig): string {
    const canonical = JSON.stringify({
      o: input.outputQuantity,
      lm: input.laborMinutes,
      tp: input.targetPrice,
      tm: input.targetMarginPct,
      l: input.lines.map((x) => [x.ref, x.quantity, x.wastePct, x.unitCost, x.priceSource]),
      c: input.components.map((x) => [x.ref, x.calc, x.value]),
      cfg: [config.igvRate, config.defaultMarginPct, config.priceFromMarkupOnPrice],
    });
    return createHash('sha256').update(canonical).digest('hex');
  }
}
