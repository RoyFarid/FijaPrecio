import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export function Stat({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'default' | 'brand' | 'danger';
}) {
  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-3.5',
        tone === 'brand'
          ? 'border-brand/25 bg-brand-soft'
          : tone === 'danger'
            ? 'border-danger/20 bg-danger-soft'
            : 'border-border bg-surface',
      )}
    >
      <p
        className={cn(
          'text-[10.5px] font-bold uppercase tracking-[0.06em]',
          tone === 'brand' ? 'text-brand-strong' : tone === 'danger' ? 'text-danger' : 'text-fg-subtle',
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          'mt-1.5 text-[26px] font-semibold tracking-tight tabular-nums',
          tone === 'brand' && 'text-brand-strong',
          tone === 'danger' && 'text-danger',
        )}
      >
        {value}
      </p>
      {sub ? (
        <p
          className={cn(
            'mt-1 text-xs',
            tone === 'brand' ? 'text-brand-strong/75' : tone === 'danger' ? 'text-danger/80' : 'text-fg-muted',
          )}
        >
          {sub}
        </p>
      ) : null}
    </div>
  );
}
