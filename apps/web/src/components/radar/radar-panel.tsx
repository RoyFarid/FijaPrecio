'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { QueryBoundary } from '../query-boundary';
import { Callout } from '../ui/callout';
import { EmptyState } from '../empty-state';
import { VerdictBadge } from './verdict-badge';
import { MarketScale } from './market-scale';
import { IconExternalLink } from '../icons';
import { cn } from '../../lib/cn';
import { useRadar, useRadarHistory } from '../../hooks/use-costing';

// Nombre lindo para las fuentes de scraping — el slug es lo único que hay en la
// data. Sin entrada acá, se cae al slug tal cual (nunca queda sin etiqueta).
const SOURCE_LABELS: Record<string, string> = {
  promart: 'Promart',
  'sodimac-pe': 'Sodimac',
  'plaza-vea': 'Plaza Vea',
  metro: 'Metro',
  wong: 'Wong',
  tottus: 'Tottus',
  'mercadolibre-pe': 'MercadoLibre',
};
const sourceLabel = (slug: string): string => SOURCE_LABELS[slug] ?? slug;

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
  const [activeSources, setActiveSources] = useState<Set<string>>(new Set());
  const toggleSource = (slug: string): void => {
    setActiveSources((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };
  const allLinks = useMemo(() => {
    if (!market) return [];
    // una sola tabla con todo lo encontrado, mezclando fuentes — de más barato a
    // más caro, para comparar el mercado de un vistazo (no solo dentro de una tienda).
    return [...market.sampleLinks].sort((a, b) => a.price - b.price);
  }, [market]);
  // las pastillas de fuentes filtran la tabla; sin ninguna activa, se muestra todo.
  const visibleLinks =
    activeSources.size === 0 ? allLinks : allLinks.filter((link) => activeSources.has(link.source));
  if (!market) return null;
  const c = data.currency;
  const sources = Object.entries(market.sourceBreakdown);
  const hasLinks = allLinks.length > 0;

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
        <div>
          <p className="mb-2 text-[13px] font-semibold text-fg">{t('sources')}</p>
          <div className="flex flex-wrap gap-2">
            {sources.map(([slug, count]) => {
              const active = activeSources.has(slug);
              return (
                <button
                  key={slug}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleSource(slug)}
                  className={cn(
                    'inline-flex items-center rounded-full border px-3 py-1 text-[12.5px] font-medium transition-colors',
                    active
                      ? 'border-brand/40 bg-brand-soft/40 text-brand-strong'
                      : 'border-border bg-surface text-fg-muted hover:bg-surface-muted/50',
                  )}
                >
                  {sourceLabel(slug)} ({count})
                </button>
              );
            })}
          </div>

          {hasLinks ? (
            <div className="mt-3 overflow-hidden rounded-lg border border-border">
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-[13px]">
                  <thead className="sticky top-0 bg-surface">
                    <tr className="border-b border-border text-left text-[10.5px] font-bold uppercase tracking-[0.07em] text-fg-subtle">
                      <th className="px-4 py-2.5 font-bold">{t('tableSource')}</th>
                      <th className="px-4 py-2.5 font-bold">{t('tableProduct')}</th>
                      <th className="px-4 py-2.5 text-right font-bold">{t('tablePrice')}</th>
                      <th className="px-4 py-2.5">
                        <span className="sr-only">{t('tableView')}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {visibleLinks.map((link, i) => (
                      <tr
                        key={`${link.source}-${i}`}
                        className="transition-colors hover:bg-surface-muted/50"
                      >
                        <td className="px-4 py-2.5 text-fg-muted">{sourceLabel(link.source)}</td>
                        <td
                          className="max-w-[220px] truncate px-4 py-2.5 font-medium text-fg"
                          title={link.title}
                        >
                          {link.title}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                          {formatMoney(link.price, c)}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={t('tableView')}
                            className="inline-flex text-fg-subtle hover:text-brand-strong"
                          >
                            <IconExternalLink className="size-4" />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="border-t border-border bg-surface-muted/40 px-4 py-2 text-[11px] text-fg-subtle">
                {t('tableNote')}
              </p>
            </div>
          ) : null}
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
