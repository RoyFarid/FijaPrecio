'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { IconLogout } from './icons';
import { useLogout } from '../hooks/use-logout';
import type { SessionUser } from '../lib/types';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('');
}

export function UserMenu({ user }: { user: SessionUser }) {
  const t = useTranslations('common');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const logout = useLogout();

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="grid size-9 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand-strong"
      >
        {initials(user.name)}
      </button>

      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-60 overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
          <div className="border-b border-border px-4 py-3">
            <p className="truncate text-sm font-medium text-fg">{user.name}</p>
            <p className="truncate text-xs text-fg-muted">{user.email}</p>
            <p className="mt-1 truncate text-xs text-fg-subtle">{user.organizationName}</p>
          </div>
          <button
            type="button"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-fg-muted hover:bg-surface-muted hover:text-fg disabled:opacity-60"
          >
            <IconLogout className="size-4" />
            {t('signOut')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
