'use client';

import { useTranslations } from 'next-intl';
import { Callout } from '../ui/callout';
import { Badge } from '../ui/badge';
import { formatMoney, formatPercent } from '../../lib/format';
import type { SensitivityResult } from '../../lib/types';

export function SensitivityPanel({ result }: { result: SensitivityResult }) {
  const t = useTranslations('sensitivity');
  const c = result.currency;

  if (result.costGap == null || result.costGap <= 0) {
    return <Callout tone="success">{t('noGap')}</Callout>;
  }

  return (
    <div className="space-y-4">
      {result.headline ? <Callout tone="info">{result.headline}</Callout> : null}

      {result.overallReductionPct != null ? (
        <p className="text-sm text-fg-muted">
          {t('reductionNeeded', { pct: formatPercent(result.overallReductionPct) })}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-muted/50 text-left text-xs uppercase tracking-wide text-fg-subtle">
              <th className="px-3 py-2 font-semibold">{t('colDriver')}</th>
              <th className="px-3 py-2 font-semibold">{t('colContribution')}</th>
              <th className="px-3 py-2 text-right font-semibold">{t('colCurrent')}</th>
              <th className="px-3 py-2 text-right font-semibold">{t('colTarget')}</th>
              <th className="px-3 py-2 font-semibold">{t('colFeasible')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {result.drivers.map((d) => (
              <tr key={`${d.kind}:${d.ref}`}>
                <td className="px-3 py-2">
                  <span className="font-medium text-fg">{d.label}</span>
                  {d.marketMedianPrice != null ? (
                    <span className="mt-0.5 block text-xs text-fg-subtle">
                      {t('marketHint', { price: formatMoney(d.marketMedianPrice, c) })}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2 tabular-nums text-fg-muted">
                  {formatPercent(d.contributionPct)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatMoney(d.currentUnitPrice, c)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {d.gapCloseUnitPrice != null ? formatMoney(d.gapCloseUnitPrice, c) : '—'}
                </td>
                <td className="px-3 py-2">
                  <Badge tone={d.feasibleAlone ? 'brand' : 'neutral'}>
                    {d.feasibleAlone ? t('feasibleYes') : t('feasibleNo')}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
