'use client';

import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { QueryBoundary } from '../query-boundary';
import { Callout } from '../ui/callout';
import { EmptyState } from '../empty-state';
import { VerdictBadge } from './verdict-badge';
import { MarketScale } from './market-scale';
import { useRadar, useRadarHistory } from '../../hooks/use-costing';

// Recharts es pesado (~100 kB) y sólo aparece en la pestaña Radar con historial.
const RadarHistoryChart = dynamic(
  () => import('./radar-history-chart').then((m) => m.RadarHistoryChart),
  { ssr: false },
);
import { formatMoney, formatPercent, formatRelative } from '../../lib/format';

export function RadarPanel({ productId }: { productId: string }) {
  const t = useTranslations('radar');
  const radar = useRadar(productId);

  return (
    <QueryBoundary
      isLoading={radar.isLoading}
      isError={radar.isError}
      onRetry={() => void radar.refetch()}
    >
      {!radar.data ? null : !radar.data.market ? (
        <EmptyState title={t('unavailable')} description={t('unavailableHint')} />
      ) : (
        <RadarBody data={radar.data} productId={productId} />
      )}
    </QueryBoundary>
  );
}

function RadarBody({
  data,
  productId,
}: {
  data: NonNullable<ReturnType<typeof useRadar>['data']>;
  productId: string;
}) {
  const t = useTranslations('radar');
  const history = useRadarHistory(productId);
  const market = data.market;
  if (!market) return null;
  const c = data.currency;
  const sources = Object.entries(market.sourceBreakdown);

  return (
    <div className="space-y-5">
      {data.position ? (
        <div className="flex flex-wrap items-center gap-3">
          <VerdictBadge verdict={data.position.verdict} />
          <span className="text-sm text-fg-muted">
            {t(`verdictHint.${data.position.verdict}`)}
          </span>
        </div>
      ) : null}

      {data.position?.vsMedianPct != null ? (
        <p className="text-sm text-fg-muted">
          {t('vsMedian', { pct: formatPercent(data.position.vsMedianPct) })}
        </p>
      ) : null}

      <div className="rounded-lg border border-border bg-surface px-4">
        <MarketScale radar={data} />
      </div>

      {history.data && history.data.points.length >= 2 ? (
        <div className="rounded-lg border border-border bg-surface p-4">
          <RadarHistoryChart history={history.data} />
        </div>
      ) : null}

      <p className="text-xs text-fg-subtle">
        {t('sample', { count: market.sampleSize, when: formatRelative(market.capturedAt) })}
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        {data.yourPrice.suggested != null ? (
          <Cell label={t('yourPrice')} value={formatMoney(data.yourPrice.suggested, c)} />
        ) : null}
        {data.yourPrice.target != null ? (
          <Cell label={t('yourTarget')} value={formatMoney(data.yourPrice.target, c)} />
        ) : null}
        <Cell label={t('avg')} value={formatMoney(market.avgPrice, c)} />
      </div>

      {sources.length > 0 ? (
        <div className="text-sm">
          <span className="font-medium text-fg">{t('sources')}: </span>
          <span className="text-fg-muted">
            {sources.map(([name, n]) => `${name} (${n})`).join(' · ')}
          </span>
        </div>
      ) : null}

      {market.medianPrice == null ? (
        <Callout tone="info">{t('unavailableHint')}</Callout>
      ) : null}
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-fg-subtle">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
