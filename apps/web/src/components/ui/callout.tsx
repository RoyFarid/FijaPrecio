import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

type Tone = 'info' | 'danger' | 'warning' | 'success';

const TONES: Record<Tone, string> = {
  info: 'bg-surface-muted text-fg-muted border-border',
  danger: 'bg-danger-soft text-danger border-danger/30',
  warning: 'bg-warning-soft text-fg border-warning/40',
  success: 'bg-success-soft text-brand-strong border-brand/30',
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
      className={cn('rounded-md border px-3 py-2 text-sm', TONES[tone], className)}
    >
      {children}
    </div>
  );
}
