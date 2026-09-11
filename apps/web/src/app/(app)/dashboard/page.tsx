'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useCurrentUser } from '../../../components/session-context';
import { useNotifications } from '../../../hooks/use-notifications';
import { Card, CardHeader, CardBody } from '../../../components/ui/card';
import { buttonClasses } from '../../../components/ui/button';
import { QueryBoundary } from '../../../components/query-boundary';
import { IconBox, IconBell, IconPlus, IconArrowRight } from '../../../components/icons';
import { formatRelative } from '../../../lib/format';

const QUICK_ACTIONS = [
  { href: '/products/new', icon: IconPlus, key: 'actionNewProduct' },
  { href: '/products', icon: IconBox, key: 'actionProducts' },
  { href: '/alerts', icon: IconBell, key: 'actionAlerts' },
] as const;

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const user = useCurrentUser();
  const notifications = useNotifications({ limit: 5 });

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-[28px] font-bold tracking-tight">
          {t('welcome', { name: user.name })}
        </h1>
        <p className="mt-1.5 text-[13px] text-fg-muted">
          {t('orgLine', { org: user.organizationName })}
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        {QUICK_ACTIONS.map(({ href, icon: Icon, key }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-4 transition-colors hover:border-brand/40 hover:bg-brand-soft/40"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-strong">
              <Icon className="size-4" />
            </span>
            <span className="flex-1 text-[13.5px] font-semibold text-fg">{t(key)}</span>
            <IconArrowRight className="size-4 text-fg-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-brand-strong" />
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader
          title={t('recentNotifications')}
          action={
            <Link href="/notifications" className={buttonClasses('ghost', 'sm')}>
              {t('seeAll')}
            </Link>
          }
        />
        <CardBody flush>
          <QueryBoundary
            isLoading={notifications.isLoading}
            isError={notifications.isError}
            onRetry={() => void notifications.refetch()}
          >
            {!notifications.data || notifications.data.length === 0 ? (
              <p className="px-6 py-10 text-center text-[13px] text-fg-muted">
                {t('noNotifications')}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {notifications.data.map((n) => (
                  <li key={n.id} className="px-6 py-3.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-[13.5px] font-semibold text-fg">{n.title}</p>
                      <span className="shrink-0 text-[11px] text-fg-subtle">
                        {formatRelative(n.createdAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[13px] text-fg-muted">{n.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </QueryBoundary>
        </CardBody>
      </Card>
    </div>
  );
}
