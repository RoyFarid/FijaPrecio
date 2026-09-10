'use client';

import { useTranslations } from 'next-intl';
import { formatMoney } from '../../lib/format';
import type { MarketRadarView } from '../../lib/types';

interface Marker {
  value: number;
  label: string;
  key: string;
}

/** Escala horizontal min→premium con bandas y un puntero para tu precio. */
export function MarketScale({ radar }: { radar: MarketRadarView }) {
  const t = useTranslations('radar');
  const m = radar.market;
  if (!m) return null;

  const c = radar.currency;
  const ticks: Marker[] = [
    { value: m.minPrice, label: t('min'), key: 'min' },
    ...(m.p25 != null ? [{ value: m.p25, label: t('p25'), key: 'p25' }] : []),
    ...(m.medianPrice != null ? [{ value: m.medianPrice, label: t('median'), key: 'median' }] : []),
    ...(m.p75 != null ? [{ value: m.p75, label: t('p75'), key: 'p75' }] : []),
    ...(m.premiumPrice != null ? [{ value: m.premiumPrice, label: t('premium'), key: 'premium' }] : []),
  ];

  const yours = radar.yourPrice.suggested;
  const target = radar.yourPrice.target;
  const all = [
    ...ticks.map((x) => x.value),
    m.avgPrice,
    ...(yours != null ? [yours] : []),
    ...(target != null ? [target] : []),
  ];
  const rawLo = Math.min(...all);
  const rawHi = Math.max(...all);
  const pad = (rawHi - rawLo || rawHi || 1) * 0.08;
  const lo = rawLo - pad;
  const hi = rawHi + pad;
  const pct = (v: number) => ((v - lo) / (hi - lo)) * 100;

  const valueBand =
    m.p25 != null && m.p75 != null
      ? { left: pct(m.p25), width: pct(m.p75) - pct(m.p25) }
      : null;

  return (
    <div className="pt-8 pb-10">
      <div className="relative h-2 rounded-full bg-surface-muted">
        {valueBand ? (
          <div
            className="absolute inset-y-0 rounded-full bg-brand-soft"
            style={{ left: `${valueBand.left}%`, width: `${valueBand.width}%` }}
          />
        ) : null}

        {ticks.map((tick) => (
          <div
            key={tick.key}
            className="absolute -top-1 flex -translate-x-1/2 flex-col items-center"
            style={{ left: `${pct(tick.value)}%` }}
          >
            <span className="h-4 w-px bg-fg-subtle" />
            <span className="mt-1 whitespace-nowrap text-[11px] text-fg-subtle">
              {tick.label}
            </span>
            <span className="whitespace-nowrap text-[11px] tabular-nums text-fg-muted">
              {formatMoney(tick.value, c)}
            </span>
          </div>
        ))}

        {yours != null ? (
          <Pointer left={pct(yours)} label={t('yourPrice')} value={formatMoney(yours, c)} tone="brand" />
        ) : null}
        {target != null ? (
          <Pointer left={pct(target)} label={t('yourTarget')} value={formatMoney(target, c)} tone="muted" />
        ) : null}
      </div>
    </div>
  );
}

function Pointer({
  left,
  label,
  value,
  tone,
}: {
  left: number;
  label: string;
  value: string;
  tone: 'brand' | 'muted';
}) {
  return (
    <div
      className="absolute -bottom-1 flex -translate-x-1/2 flex-col items-center"
      style={{ left: `${Math.min(100, Math.max(0, left))}%` }}
    >
      <span
        className={
          tone === 'brand'
            ? 'size-3 rotate-45 rounded-sm bg-brand'
            : 'size-3 rotate-45 rounded-sm border border-fg-subtle bg-surface'
        }
      />
      <span className="mt-1.5 whitespace-nowrap text-[11px] font-medium text-fg">{label}</span>
      <span className="whitespace-nowrap text-[11px] tabular-nums text-fg-muted">{value}</span>
    </div>
  );
}
