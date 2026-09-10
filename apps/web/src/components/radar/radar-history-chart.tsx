'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatDateShort, formatMoney } from '../../lib/format';
import { chartBounds, toChartData } from '../../lib/radar-chart';
import type { MarketHistory } from '../../lib/types';

export function RadarHistoryChart({ history }: { history: MarketHistory }) {
  const t = useTranslations('radar');
  const rows = useMemo(() => toChartData(history.points), [history.points]);
  const bounds = chartBounds(rows);

  if (rows.length < 2 || !bounds) return null;

  const c = history.currency;

  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold">{t('historyTitle')}</h4>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(v: number) => formatDateShort(new Date(v).toISOString())}
              tick={{ fontSize: 11, fill: 'var(--color-fg-subtle)' }}
              stroke="var(--color-border)"
            />
            <YAxis
              domain={[bounds.min, bounds.max]}
              width={54}
              tickFormatter={(v: number) => formatMoney(v, c)}
              tick={{ fontSize: 11, fill: 'var(--color-fg-subtle)' }}
              stroke="var(--color-border)"
            />
            <Tooltip
              labelFormatter={(v) => formatDateShort(new Date(Number(v)).toISOString())}
              formatter={(value: number | number[], name) => {
                if (Array.isArray(value)) {
                  return [`${formatMoney(value[0], c)} – ${formatMoney(value[1], c)}`, t('rangeLabel')];
                }
                return [formatMoney(value, c), name === 'median' ? t('median') : t('avg')];
              }}
              contentStyle={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Area
              dataKey="range"
              stroke="none"
              fill="var(--color-brand)"
              fillOpacity={0.12}
              isAnimationActive={false}
            />
            <Line
              dataKey="median"
              stroke="var(--color-brand-strong)"
              strokeWidth={2}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              dataKey="avg"
              stroke="var(--color-fg-subtle)"
              strokeWidth={1}
              strokeDasharray="4 3"
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-xs text-fg-subtle">
        {t('historyWindow', { days: history.windowDays })}
      </p>
    </div>
  );
}
