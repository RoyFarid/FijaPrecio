'use client';

import { useTranslations } from 'next-intl';
import { cn } from '../../lib/cn';
import type { MarketRadarVerdict } from '../../lib/types';

const STYLE: Record<MarketRadarVerdict, string> = {
  below_market: 'bg-warning-soft text-fg',
  value: 'bg-brand-soft text-brand-strong',
  competitive: 'bg-success-soft text-brand-strong',
  premium: 'bg-warning-soft text-fg',
  above_market: 'bg-danger-soft text-danger',
};

export function VerdictBadge({ verdict }: { verdict: MarketRadarVerdict }) {
  const t = useTranslations('radar.verdict');
  return (
    <span
      className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-sm font-medium', STYLE[verdict])}
    >
      {t(verdict)}
    </span>
  );
}
