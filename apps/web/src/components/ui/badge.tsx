import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

type Tone = 'neutral' | 'brand' | 'danger' | 'warning' | 'success';

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-muted text-fg-muted',
  brand: 'bg-brand-soft text-brand-strong',
  danger: 'bg-danger-soft text-danger',
  warning: 'bg-warning-soft text-fg',
  success: 'bg-success-soft text-success',
};

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
