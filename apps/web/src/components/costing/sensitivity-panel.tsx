'use client';

import { Fragment, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Callout } from '../ui/callout';
import { Badge } from '../ui/badge';
import { IconChevronDown, IconExternalLink } from '../icons';
import { cn } from '../../lib/cn';
import { sourceLabel } from '../../lib/store-labels';
import { formatMoney, formatPercent } from '../../lib/format';
import type { SensitivityDriver, SensitivityResult } from '../../lib/types';

export function SensitivityPanel({ result }: { result: SensitivityResult }) {
  const t = useTranslations('sensitivity');
  const c = result.currency;
  const [expandedRef, setExpandedRef] = useState<string | null>(null);

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
            {result.drivers.map((d) => {
              const hasOptions = (d.marketSampleLinks?.length ?? 0) > 0;
              const expanded = expandedRef === d.ref;
              return (
                <Fragment key={`${d.kind}:${d.ref}`}>
                  <tr>
                    <td className="px-3 py-2">
                      <span className="font-medium text-fg">{d.label}</span>
                      {d.marketMedianPrice != null ? (
                        <span className="mt-0.5 block text-xs text-fg-subtle">
                          {t('marketHint', { price: formatMoney(d.marketMedianPrice, c) })}
                          {hasOptions ? (
                            <button
                              type="button"
                              onClick={() => setExpandedRef(expanded ? null : d.ref)}
                              className="ml-1.5 inline-flex items-center gap-0.5 font-medium text-brand-strong hover:underline"
                            >
                              {expanded ? t('hideOptions') : t('viewOptions')}
                              <IconChevronDown
                                className={cn('size-3 transition-transform', expanded && 'rotate-180')}
                              />
                            </button>
                          ) : null}
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
                  {expanded && hasOptions ? (
                    <tr>
                      <td colSpan={5} className="bg-surface-muted/30 px-3 py-3">
                        <MarketOptionsTable driver={d} currency={c} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MarketOptionsTable({ driver, currency }: { driver: SensitivityDriver; currency: string }) {
  const t = useTranslations('sensitivity');
  const links = driver.marketSampleLinks ?? [];

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="max-h-64 overflow-y-auto">
        <table className="w-full text-[13px]">
          <thead className="sticky top-0 bg-surface">
            <tr className="border-b border-border text-left text-[10.5px] font-bold uppercase tracking-[0.07em] text-fg-subtle">
              <th className="px-4 py-2 font-bold">{t('optionsSource')}</th>
              <th className="px-4 py-2 font-bold">{t('optionsProduct')}</th>
              <th className="px-4 py-2 text-right font-bold">{t('optionsPrice')}</th>
              <th className="px-4 py-2">
                <span className="sr-only">{t('optionsView')}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {links.map((link, i) => (
              <tr key={`${link.source}-${i}`} className="transition-colors hover:bg-surface-muted/50">
                <td className="px-4 py-2 text-fg-muted">{sourceLabel(link.source)}</td>
                <td className="max-w-[220px] truncate px-4 py-2 font-medium text-fg" title={link.title}>
                  {link.title}
                </td>
                <td className="px-4 py-2 text-right font-semibold tabular-nums">
                  {formatMoney(link.price, currency)}
                </td>
                <td className="px-4 py-2 text-right">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t('optionsView')}
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
        {t('optionsNote')}
      </p>
    </div>
  );
}
