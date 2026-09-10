'use client';

import { useTranslations } from 'next-intl';
import { Stat } from '../ui/stat';
import { Callout } from '../ui/callout';
import { PriceSourceBadge } from './price-source-badge';
import { formatMoney, formatPercent, formatRelative } from '../../lib/format';
import type { CostingResult } from '../../lib/types';

export function CostBreakdown({ result }: { result: CostingResult }) {
  const t = useTranslations('costing');
  const c = result.currency;
  const withinTarget = result.costGap != null && result.costGap <= 0;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t('unitCost')} value={formatMoney(result.unitCost, c)} />
        <Stat
          label={t('suggestedPrice')}
          value={formatMoney(result.suggestedPrice, c)}
          tone="brand"
        />
        <Stat label={t('marginPct')} value={formatPercent(result.marginPct)} />
        <Stat
          label={t('costGap')}
          value={
            result.costGap == null
              ? '—'
              : withinTarget
                ? t('onTarget')
                : formatMoney(result.costGap, c)
          }
          tone={result.costGap != null && result.costGap > 0 ? 'danger' : 'default'}
          sub={result.targetCost != null ? `${t('targetCost')}: ${formatMoney(result.targetCost, c)}` : undefined}
        />
      </div>

      {result.hasMissingPrices ? <Callout tone="warning">{t('missingPrices')}</Callout> : null}

      <div>
        <h3 className="mb-2 text-sm font-semibold">{t('breakdown')}</h3>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted/50 text-left text-xs uppercase tracking-wide text-fg-subtle">
                <th className="px-3 py-2 font-semibold">{t('colConcept')}</th>
                <th className="px-3 py-2 font-semibold">{t('colSource')}</th>
                <th className="px-3 py-2 text-right font-semibold">{t('colAmount')}</th>
                <th className="px-3 py-2 font-semibold">{t('colPct')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {result.lines.map((line) => (
                <tr key={`${line.kind}:${line.ref}`}>
                  <td className="px-3 py-2">
                    <span className="font-medium text-fg">{line.label}</span>
                  </td>
                  <td className="px-3 py-2">
                    <PriceSourceBadge source={line.priceSource} />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatMoney(line.amount, c)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-muted">
                        <span
                          className="block h-full rounded-full bg-brand"
                          style={{ width: `${Math.min(100, Math.max(2, line.pctOfTotal * 100))}%` }}
                        />
                      </span>
                      <span className="tabular-nums text-xs text-fg-muted">
                        {formatPercent(line.pctOfTotal)}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border font-semibold">
                <td className="px-3 py-2" colSpan={2}>
                  {t('totalCost')}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatMoney(result.totalCost, c)}
                </td>
                <td className="px-3 py-2" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <p className="text-xs text-fg-subtle">
        {t('computedAt', { when: formatRelative(result.computedAt) })}
      </p>
    </div>
  );
}
