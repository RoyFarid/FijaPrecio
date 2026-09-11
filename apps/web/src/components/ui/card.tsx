import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-2xl border border-border bg-surface', className)} {...props} />
  );
}

export function CardHeader({
  title,
  action,
  description,
}: {
  title: ReactNode;
  action?: ReactNode;
  description?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
      <div>
        <h2 className="text-[15px] font-semibold text-fg">{title}</h2>
        {description ? <p className="mt-0.5 text-[13px] text-fg-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function CardBody({
  className,
  flush = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & { flush?: boolean }) {
  return <div className={cn(!flush && 'px-6 py-5', className)} {...props} />;
}
