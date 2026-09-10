import { Injectable, Logger } from '@nestjs/common';
import type { AlertThresholds } from '@fijaprecio/shared-types';
import type { Alert, Prisma } from '@fijaprecio/db';
import { PrismaService } from '../prisma/prisma.service.js';
import { AppConfigService } from '../config/app-config.service.js';
import { CostingService } from '../costing/costing.service.js';
import {
  evaluateCompetitorDrop,
  evaluateInputPriceRise,
  evaluateMarginDrop,
  type RuleResult,
} from './rules.js';
import { nextCronOccurrence } from './cron.js';

const TEMPLATE_CODE: Record<string, string> = {
  MARGIN_DROP: 'alert.margin_drop',
  INPUT_PRICE_RISE: 'alert.input_price_rise',
  COMPETITOR_PRICE_DROP: 'alert.competitor_price_drop',
  CONSENSUS_SHIFT: 'alert.consensus_shift',
};

const pct = (n: number | undefined): string =>
  n == null ? '—' : `${(n * 100).toFixed(1)}%`;
const money = (n: number | undefined): string => (n == null ? '—' : n.toFixed(2));

interface Evaluation {
  result: RuleResult;
  vars: Record<string, string>;
}

@Injectable()
export class AlertsEvaluatorService {
  private readonly log = new Logger(AlertsEvaluatorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
    private readonly costing: CostingService,
  ) {}

  /** Recorre todas las alertas activas y crea las notificaciones que correspondan. */
  async runAll(): Promise<{ checked: number; triggered: number; notifications: number }> {
    const [dedupHours, digestCron] = await Promise.all([
      this.config.getGlobal('notify.dedup_hours'),
      this.config.getGlobal('alerts.digest_cron_free'),
    ]);
    const now = new Date();
    const dedupSince = new Date(now.getTime() - dedupHours * 3_600_000);

    const alerts = await this.prisma.client.alert.findMany({ where: { enabled: true } });

    let triggered = 0;
    let notifications = 0;

    for (const alert of alerts) {
      let evaluation: Evaluation | null = null;
      try {
        evaluation = await this.evaluate(alert);
      } catch (err) {
        this.log.warn(`alerta ${alert.id} (${alert.type}): ${(err as Error).message}`);
      }
      await this.prisma.client.alert.update({
        where: { id: alert.id },
        data: { lastCheckedAt: now },
      });

      if (!evaluation?.result.triggered) continue;
      if (alert.lastTriggeredAt && alert.lastTriggeredAt > dedupSince) continue; // dedup

      triggered += 1;
      await this.prisma.client.alert.update({
        where: { id: alert.id },
        data: { lastTriggeredAt: now },
      });

      const scheduledFor = (await this.isFreePlan(alert.organizationId))
        ? nextCronOccurrence(digestCron, now)
        : null;

      for (const channel of alert.channels) {
        await this.prisma.client.notification.create({
          data: {
            organizationId: alert.organizationId,
            userId: alert.createdById,
            channel,
            templateCode: TEMPLATE_CODE[alert.type] ?? 'alert.margin_drop',
            payload: evaluation.vars as Prisma.InputJsonValue,
            scheduledFor,
          },
        });
        notifications += 1;
      }
    }

    return { checked: alerts.length, triggered, notifications };
  }

  // ---------------------------------------------------------------------------

  private async evaluate(alert: Alert): Promise<Evaluation> {
    const th = (alert.thresholds ?? {}) as AlertThresholds;

    if (alert.type === 'MARGIN_DROP' && alert.productId) {
      const product = await this.prisma.client.product.findUnique({
        where: { id: alert.productId },
        select: { name: true },
      });
      const costing = await this.costing.computeForProduct(alert.organizationId, alert.productId);
      const result = evaluateMarginDrop(costing.marginPct, th.marginFloorPct ?? 0);
      return {
        result,
        vars: {
          productName: product?.name ?? 'tu producto',
          marginPct: pct(result.context.marginPct),
          marginFloorPct: pct(th.marginFloorPct),
          suggestedPrice: money(costing.suggestedPrice ?? undefined),
        },
      };
    }

    if (alert.type === 'INPUT_PRICE_RISE' && alert.canonicalInputId) {
      const { name, median, baseline } = await this.inputContext(
        alert.organizationId,
        alert.canonicalInputId,
      );
      const result = evaluateInputPriceRise(median, baseline, th.risePct ?? Infinity);
      return {
        result,
        vars: {
          inputName: name,
          marketPrice: money(result.context.marketPrice),
          yourPrice: money(result.context.yourPrice),
          changePct: pct(result.context.changePct),
        },
      };
    }

    if (alert.type === 'COMPETITOR_PRICE_DROP' && alert.productId) {
      const product = await this.prisma.client.product.findUnique({
        where: { id: alert.productId },
        select: { name: true },
      });
      const snaps = await this.prisma.client.marketPrice.findMany({
        where: { productId: alert.productId },
        orderBy: { capturedAt: 'desc' },
        take: 2,
        select: { medianPrice: true },
      });
      const latest = snaps[0]?.medianPrice?.toNumber() ?? null;
      const prev = snaps[1]?.medianPrice?.toNumber() ?? null;
      const result = evaluateCompetitorDrop(latest, prev, th.dropPct ?? Infinity);
      return {
        result,
        vars: {
          productName: product?.name ?? 'tu producto',
          currentMedian: money(result.context.currentMedian),
          previousMedian: money(result.context.previousMedian),
          changePct: pct(result.context.changePct),
        },
      };
    }

    // CONSENSUS_SHIFT necesita histórico de PriceConsensus — pendiente.
    return { result: { triggered: false, context: {} }, vars: {} };
  }

  private async inputContext(
    orgId: string,
    canonicalInputId: string,
  ): Promise<{ name: string; median: number | null; baseline: number | null }> {
    const [input, org] = await Promise.all([
      this.prisma.client.canonicalInput.findUnique({
        where: { id: canonicalInputId },
        select: { name: true },
      }),
      this.prisma.client.organization.findUnique({
        where: { id: orgId },
        select: { region: true, currency: true },
      }),
    ]);
    const consensus = await this.prisma.client.priceConsensus.findFirst({
      where: {
        canonicalInputId,
        scope: 'INPUT',
        region: org?.region ?? 'PE',
        currency: org?.currency ?? 'PEN',
      },
      select: { median: true },
    });
    const orgInput = await this.prisma.client.orgInput.findFirst({
      where: { organizationId: orgId, canonicalInputId, lastKnownPrice: { not: null } },
      select: { lastKnownPrice: true },
    });
    return {
      name: input?.name ?? 'ese insumo',
      median: consensus?.median.toNumber() ?? null,
      baseline: orgInput?.lastKnownPrice?.toNumber() ?? null,
    };
  }

  private async isFreePlan(orgId: string): Promise<boolean> {
    const sub = await this.prisma.client.subscription.findUnique({
      where: { organizationId: orgId },
      select: { plan: { select: { code: true } } },
    });
    return (sub?.plan.code ?? 'FREE') === 'FREE';
  }
}
