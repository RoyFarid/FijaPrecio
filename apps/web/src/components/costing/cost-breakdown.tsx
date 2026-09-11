'use client';

import { useTranslations } from 'next-intl';
import { cn } from '../../lib/cn';
import { Stat } from '../ui/stat';
import { Callout } from '../ui/callout';
import { PriceSourceBadge } from './price-source-badge';
import { formatMoney, formatPercent, formatRelative } from '../../lib/format';
import type { CostBreakdownLine, CostingResult, CostPriceSource } from '../../lib/types';

const BAR: Record<CostPriceSource, string> = {
  consensus: 'bg-brand',
  org_input: 'bg-fg-subtle',
  override: 'bg-fg-muted',
  supplier: 'bg-fg-muted',
  missing: 'bg-danger',
};

function barClass(line: CostBreakdownLine): string {
  if (line.kind === 'component') return 'bg-fg-subtle/60';
  return line.priceSource ? BAR[line.priceSource] : 'bg-fg-subtle';
}

export function CostBreakdown({ result }: { result: CostingResult }) {
  const t = useTranslations('costing');
  const c = result.currency;
  const withinTarget = result.costGap != null && result.costGap <= 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t('unitCost')} value={formatMoney(result.unitCost, c)} sub={`${t('totalCost')}: ${formatMoney(result.totalCost, c)}`} />
        <Stat label={t('suggestedPrice')} value={formatMoney(result.suggestedPrice, c)} tone="brand" sub={result.marginPct != null ? `${t('marginPct')} ${formatPercent(result.marginPct)}` : undefined} />
        <Stat label={t('marginPct')} value={formatPercent(result.marginPct)} sub={result.targetPrice != null ? `${t('targetPrice')}: ${formatMoney(result.targetPrice, c)}` : undefined} />
        <Stat
          label={t('costGap')}
          value={
            result.costGap == null ? '—' : withinTarget ? t('onTarget') : formatMoney(result.costGap, c)
          }
          tone={result.costGap != null && result.costGap > 0 ? 'danger' : 'default'}
          sub={result.targetCost != null ? `${t('targetCost')}: ${formatMoney(result.targetCost, c)}` : undefined}
        />
      </div>

      {result.hasMissingPrices ? <Callout tone="warning">{t('missingPrices')}</Callout> : null}

      <div className="rounded-2xl border border-border bg-surface p-6">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-[15px] font-semibold">{t('breakdown')}</h3>
          <span className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-fg-subtle">
            {formatMoney(result.unitCost, c)} · 100%
          </span>
        </div>
        <p className="mb-6 text-[12.5px] text-fg-muted">{t('breakdownHint')}</p>

        <div className="flex flex-col gap-3.5">
          {result.lines.map((line) => (
            <div
              key={`${line.kind}:${line.ref}`}
              className="grid grid-cols-[minmax(0,10rem)_1fr_5rem] items-center gap-4"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-[13.5px] font-semibold text-fg">{line.label}</span>
                <span>
                  <PriceSourceBadge source={line.priceSource} />
                </span>
              </div>
              <div className="h-8 overflow-hidden rounded-lg bg-surface-muted">
                <div
                  className={cn('h-full rounded-lg', barClass(line))}
                  style={{ width: `${Math.min(100, Math.max(2.5, line.pctOfTotal * 100))}%` }}
                />
              </div>
              <div
                className={cn(
                  'text-right text-[13px] font-semibold tabular-nums',
                  line.priceSource === 'missing' && 'text-danger',
                )}
              >
                {line.priceSource === 'missing' ? '—' : formatMoney(line.amount, c)}
                <span className="mt-0.5 block text-[11px] font-normal text-fg-subtle">
                  {formatPercent(line.pctOfTotal)}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2 border-t border-border pt-4 text-[11.5px] text-fg-muted">
          <Legend className="bg-brand" label={t('source.consensus')} />
          <Legend className="bg-fg-subtle" label={t('source.org_input')} />
          <Legend className="bg-fg-subtle/60" label={t('otherCosts')} />
          <Legend className="bg-danger" label={t('source.missing')} />
        </div>
      </div>

      <p className="text-xs text-fg-subtle">
        {t('computedAt', { when: formatRelative(result.computedAt) })}
      </p>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={cn('size-2.5 rounded-[3px]', className)} />
      {label}
    </span>
  );
}
