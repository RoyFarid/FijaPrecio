import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CostingResult,
  ScenarioComparison,
  ScenarioDelta,
  ScenarioOutcome,
  SavedScenario,
} from '@fijaprecio/shared-types';
import type { Prisma } from '@fijaprecio/db';
import { PrismaService } from '../prisma/prisma.service.js';
import { AppConfigService } from '../config/app-config.service.js';
import { CostingService } from '../costing/costing.service.js';
import { computeCosting, type EngineConfig, type EngineInput } from '../costing/engine.js';
import { applyScenarioOverrides, type ScenarioOverride } from '../costing/scenario-engine.js';
import type { CompareScenariosInput, CreateScenarioInput } from './dto.js';

@Injectable()
export class ScenariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly costing: CostingService,
  ) {}

  /** Compara N escenarios ad-hoc contra la receta base. No persiste. */
  async compare(
    orgId: string,
    productId: string,
    dto: CompareScenariosInput,
  ): Promise<ScenarioComparison> {
    const maxOverrides = await this.config.get(orgId, 'scenario_max_overrides');
    for (const s of dto.scenarios) this.assertOverrideLimit(s.overrides.length, maxOverrides);

    const { engineInput, engineConfig } = await this.costing.prepare(orgId, productId);
    const base = this.toResult(computeCosting(engineInput, engineConfig));

    const scenarios = dto.scenarios.map((s) =>
      this.runScenario(engineInput, engineConfig, base, s.name, s.overrides as ScenarioOverride[]),
    );

    return { currency: base.currency, base, scenarios, computedAt: new Date().toISOString() };
  }

  async create(
    orgId: string,
    userId: string,
    productId: string,
    dto: CreateScenarioInput,
  ): Promise<SavedScenario> {
    const maxOverrides = await this.config.get(orgId, 'scenario_max_overrides');
    this.assertOverrideLimit(dto.overrides.length, maxOverrides);

    const product = await this.prisma.client.product.findFirst({
      where: { id: productId, organizationId: orgId },
      include: { recipes: { where: { isActive: true }, select: { id: true } } },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');
    const baseRecipe = product.recipes[0];
    if (!baseRecipe) throw new NotFoundException('El producto no tiene una receta activa');

    const outcome = await this.computeOutcome(orgId, productId, dto.name, dto.overrides as ScenarioOverride[]);

    const scenario = await this.prisma.client.scenario.create({
      data: {
        organizationId: orgId,
        productId,
        baseRecipeId: baseRecipe.id,
        name: dto.name,
        notes: dto.notes ?? null,
        createdById: userId,
        overrides: {
          create: dto.overrides.map((ov) => ({
            type: ov.type,
            targetRef: ov.targetRef,
            patch: ov.patch as Prisma.InputJsonValue,
          })),
        },
        results: { create: [this.resultRow(outcome)] },
      },
      include: this.include(),
    });

    return this.toSaved(scenario);
  }

  async list(orgId: string, productId: string): Promise<SavedScenario[]> {
    const rows = await this.prisma.client.scenario.findMany({
      where: { organizationId: orgId, productId },
      orderBy: { createdAt: 'desc' },
      include: this.include(),
    });
    return rows.map((r) => this.toSaved(r));
  }

  async get(orgId: string, scenarioId: string): Promise<SavedScenario> {
    const row = await this.prisma.client.scenario.findFirst({
      where: { id: scenarioId, organizationId: orgId },
      include: this.include(),
    });
    if (!row) throw new NotFoundException('Escenario no encontrado');
    return this.toSaved(row);
  }

  async recompute(orgId: string, scenarioId: string): Promise<SavedScenario> {
    const row = await this.prisma.client.scenario.findFirst({
      where: { id: scenarioId, organizationId: orgId },
      include: { overrides: true },
    });
    if (!row) throw new NotFoundException('Escenario no encontrado');

    const overrides: ScenarioOverride[] = row.overrides.map((o) => ({
      type: o.type,
      targetRef: o.targetRef,
      patch: (o.patch ?? {}) as Record<string, unknown>,
    }));
    const outcome = await this.computeOutcome(orgId, row.productId, row.name, overrides);

    await this.prisma.client.scenarioResult.create({
      data: { scenarioId, ...this.resultRow(outcome) },
    });

    return this.get(orgId, scenarioId);
  }

  async remove(orgId: string, scenarioId: string): Promise<void> {
    const { count } = await this.prisma.client.scenario.deleteMany({
      where: { id: scenarioId, organizationId: orgId },
    });
    if (count === 0) throw new NotFoundException('Escenario no encontrado');
  }

  // ---------------------------------------------------------------------------

  private assertOverrideLimit(count: number, max: number): void {
    if (max !== -1 && count > max) {
      throw new ForbiddenException(
        `Tu plan permite ${max} ajuste(s) por escenario (pediste ${count})`,
      );
    }
  }

  private async computeOutcome(
    orgId: string,
    productId: string,
    name: string,
    overrides: ScenarioOverride[],
  ): Promise<ScenarioOutcome> {
    const { engineInput, engineConfig } = await this.costing.prepare(orgId, productId);
    const base = this.toResult(computeCosting(engineInput, engineConfig));
    return this.runScenario(engineInput, engineConfig, base, name, overrides);
  }

  private runScenario(
    engineInput: EngineInput,
    engineConfig: EngineConfig,
    base: CostingResult,
    name: string,
    overrides: ScenarioOverride[],
  ): ScenarioOutcome {
    const modified = applyScenarioOverrides(engineInput, overrides);
    const result = this.toResult(computeCosting(modified, engineConfig));
    const delta: ScenarioDelta = {
      unitCost: round(result.unitCost - base.unitCost),
      suggestedPrice: diff(result.suggestedPrice, base.suggestedPrice),
      marginPct: diff(result.marginPct, base.marginPct, 6),
      costGap: diff(result.costGap, base.costGap),
    };
    return {
      name,
      overrides: overrides.map((o) => ({ type: o.type, targetRef: o.targetRef, patch: o.patch })),
      result,
      delta,
    };
  }

  private toResult(r: ReturnType<typeof computeCosting>): CostingResult {
    return { ...r, computedAt: new Date().toISOString() };
  }

  private resultRow(outcome: ScenarioOutcome) {
    return {
      totalCost: outcome.result.totalCost,
      unitCost: outcome.result.unitCost,
      suggestedPrice: outcome.result.suggestedPrice,
      marginPct: outcome.result.marginPct,
      breakdown: { result: outcome.result, delta: outcome.delta } as unknown as Prisma.InputJsonValue,
    };
  }

  private include() {
    return {
      overrides: true,
      results: { orderBy: { computedAt: 'desc' as const }, take: 1 },
    };
  }

  private toSaved(row: {
    id: string;
    productId: string;
    name: string;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
    overrides: Array<{ type: string; targetRef: string | null; patch: Prisma.JsonValue }>;
    results: Array<{ breakdown: Prisma.JsonValue }>;
  }): SavedScenario {
    const stored = row.results[0]?.breakdown as
      | { result: CostingResult; delta: ScenarioDelta }
      | undefined;
    return {
      id: row.id,
      productId: row.productId,
      name: row.name,
      notes: row.notes,
      overrides: row.overrides.map((o) => ({
        type: o.type as SavedScenario['overrides'][number]['type'],
        targetRef: o.targetRef,
        patch: (o.patch ?? {}) as Record<string, unknown>,
      })),
      result: stored?.result ?? null,
      delta: stored?.delta ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

const round = (n: number, dp = 4): number => {
  const f = 10 ** dp;
  return Math.round((n + Number.EPSILON) * f) / f;
};

const diff = (a: number | null, b: number | null, dp = 4): number | null =>
  a == null || b == null ? null : round(a - b, dp);
