'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { cn } from '../lib/cn';
import { Nav } from './nav';
import { NotificationsBell } from './notifications-bell';
import { UserMenu } from './user-menu';
import { SessionProvider } from './session-context';
import type { SessionUser } from '../lib/types';

export function AppShell({ user, children }: { user: SessionUser; children: ReactNode }) {
  const t = useTranslations('brand');
  const [mobileNav, setMobileNav] = useState(false);

  return (
    <SessionProvider user={user}>
      <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
        <aside
          className={cn(
            'flex-col border-r border-border bg-surface',
            'fixed inset-y-0 left-0 z-30 w-64 lg:static lg:flex',
            mobileNav ? 'flex' : 'hidden',
          )}
        >
          <div className="flex h-14 items-center border-b border-border px-5">
            <Link href="/dashboard" className="font-semibold tracking-tight">
              {t('name')}
            </Link>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <Nav />
          </div>
        </aside>

        {mobileNav ? (
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setMobileNav(false)}
            className="fixed inset-0 z-20 bg-black/20 lg:hidden"
          />
        ) : null}

        <div className="flex min-w-0 flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-bg/90 px-4 backdrop-blur lg:px-6">
            <button
              type="button"
              onClick={() => setMobileNav(true)}
              aria-label="Abrir menú"
              className="grid size-9 place-items-center rounded-md text-fg-muted hover:bg-surface-muted lg:hidden"
            >
              <span className="space-y-1">
                <span className="block h-0.5 w-5 bg-current" />
                <span className="block h-0.5 w-5 bg-current" />
                <span className="block h-0.5 w-5 bg-current" />
              </span>
            </button>
            <div className="flex-1" />
            <NotificationsBell />
            <UserMenu user={user} />
          </header>

          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 lg:px-6 lg:py-8">
            {children}
          </main>
        </div>
      </div>
    </SessionProvider>
  );
}
