'use client';

import { useTranslations } from 'next-intl';
import { cn } from '../../lib/cn';
import { formatMoney, formatPercent } from '../../lib/format';
import type { ScenarioComparison } from '../../lib/types';

type MetricKey = 'unitCost' | 'suggestedPrice' | 'marginPct' | 'costGap';

const METRICS: { key: MetricKey; labelKey: string; kind: 'money' | 'pct'; betterWhen: 'lower' | 'higher' }[] = [
  { key: 'unitCost', labelKey: 'metricUnitCost', kind: 'money', betterWhen: 'lower' },
  { key: 'suggestedPrice', labelKey: 'metricSuggested', kind: 'money', betterWhen: 'higher' },
  { key: 'marginPct', labelKey: 'metricMargin', kind: 'pct', betterWhen: 'higher' },
  { key: 'costGap', labelKey: 'metricGap', kind: 'money', betterWhen: 'lower' },
];

export function ComparisonTable({ comparison }: { comparison: ScenarioComparison }) {
  const t = useTranslations('scenarios');
  const c = comparison.currency;

  const fmt = (kind: 'money' | 'pct', v: number | null) =>
    v == null ? '—' : kind === 'money' ? formatMoney(v, c) : formatPercent(v);

  const baseValue = (key: MetricKey): number | null => {
    if (key === 'marginPct') return comparison.base.marginPct;
    if (key === 'suggestedPrice') return comparison.base.suggestedPrice;
    if (key === 'costGap') return comparison.base.costGap;
    return comparison.base.unitCost;
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-muted/50 text-left text-xs uppercase tracking-wide text-fg-subtle">
            <th className="px-3 py-2 font-semibold">{t('colMetric')}</th>
            <th className="px-3 py-2 text-right font-semibold">{t('colBase')}</th>
            {comparison.scenarios.map((s, i) => (
              <th key={i} className="px-3 py-2 text-right font-semibold text-fg">
                {s.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {METRICS.map((metric) => {
            const base = baseValue(metric.key);
            return (
              <tr key={metric.key}>
                <td className="px-3 py-2 font-medium text-fg">{t(metric.labelKey)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-fg-muted">
                  {fmt(metric.kind, base)}
                </td>
                {comparison.scenarios.map((s, i) => {
                  const delta: number | null = s.delta[metric.key];
                  const value =
                    metric.key === 'unitCost'
                      ? s.result.unitCost
                      : metric.key === 'suggestedPrice'
                        ? s.result.suggestedPrice
                        : metric.key === 'marginPct'
                          ? s.result.marginPct
                          : s.result.costGap;
                  const improved =
                    delta == null || delta === 0
                      ? null
                      : metric.betterWhen === 'lower'
                        ? delta < 0
                        : delta > 0;
                  return (
                    <td key={i} className="px-3 py-2 text-right tabular-nums">
                      <span className="text-fg">{fmt(metric.kind, value)}</span>
                      {delta != null && delta !== 0 ? (
                        <span
                          className={cn(
                            'ml-1 text-xs',
                            improved === true && 'text-success',
                            improved === false && 'text-danger',
                          )}
                        >
                          ({delta > 0 ? '+' : ''}
                          {metric.kind === 'money' ? delta.toFixed(2) : formatPercent(delta)})
                        </span>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
