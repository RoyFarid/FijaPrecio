'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { cn } from '../lib/cn';
import { formatRelative } from '../lib/format';
import { IconBell } from './icons';
import { Spinner } from './ui/spinner';
import { useNotifications, useUnreadCount, useMarkAllRead } from '../hooks/use-notifications';

export function NotificationsBell() {
  const t = useTranslations('notifications');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const unread = useUnreadCount();
  const list = useNotifications({ limit: 8 });
  const markAll = useMarkAllRead();
  const count = unread.data?.count ?? 0;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('open')}
        aria-expanded={open}
        className="relative grid size-9 place-items-center rounded-md text-fg-muted hover:bg-surface-muted hover:text-fg"
      >
        <IconBell />
        {count > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-4 text-white">
            {count > 9 ? '9+' : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-80 overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-sm font-semibold">{t('title')}</span>
            {count > 0 ? (
              <button
                type="button"
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
                className="text-xs font-medium text-brand-strong hover:underline disabled:opacity-60"
              >
                {t('markAllRead')}
              </button>
            ) : null}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {list.isLoading ? (
              <div className="grid place-items-center py-8">
                <Spinner className="text-fg-subtle" />
              </div>
            ) : !list.data || list.data.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-fg-muted">{t('empty')}</p>
            ) : (
              <ul className="divide-y divide-border">
                {list.data.map((n) => (
                  <li
                    key={n.id}
                    className={cn('px-4 py-3', n.readAt ? 'opacity-60' : 'bg-brand-soft/40')}
                  >
                    <p className="text-sm font-medium text-fg">{n.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-sm text-fg-muted">{n.body}</p>
                    <p className="mt-1 text-xs text-fg-subtle">{formatRelative(n.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-border px-4 py-2.5 text-center text-sm font-medium text-brand-strong hover:bg-surface-muted"
          >
            {t('title')}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
