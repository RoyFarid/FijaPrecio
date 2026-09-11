import type { ReactNode } from 'react';

export function EmptyState({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface-muted/40 px-6 py-14 text-center">
      <p className="text-[15px] font-semibold text-fg">{title}</p>
      {description ? (
        <p className="mx-auto mt-1.5 max-w-sm text-[13px] text-fg-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
