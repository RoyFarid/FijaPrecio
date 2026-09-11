import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

type Tone = 'info' | 'danger' | 'warning' | 'success';

const TONES: Record<Tone, string> = {
  info: 'bg-surface-muted text-fg-muted border-border',
  danger: 'bg-danger-soft text-danger border-danger/25',
  warning: 'bg-warning-soft text-fg border-warning/35',
  success: 'bg-success-soft text-success border-success/25',
};

export function Callout({
  children,
  tone = 'info',
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : undefined}
      className={cn('rounded-xl border px-3.5 py-2.5 text-[13px]', TONES[tone], className)}
    >
      {children}
    </div>
  );
}
