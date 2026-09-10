'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useCurrentUser } from '../../../components/session-context';
import { useNotifications } from '../../../hooks/use-notifications';
import { Card, CardHeader, CardBody } from '../../../components/ui/card';
import { buttonClasses } from '../../../components/ui/button';
import { QueryBoundary } from '../../../components/query-boundary';
import { IconBox, IconBell, IconPlus } from '../../../components/icons';
import { formatRelative } from '../../../lib/format';

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const user = useCurrentUser();
  const notifications = useNotifications({ limit: 5 });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">{t('welcome', { name: user.name })}</h1>
        <p className="mt-1 text-sm text-fg-muted">{t('orgLine', { org: user.organizationName })}</p>
      </header>

      <Card>
        <CardHeader title={t('quickActions')} />
        <CardBody className="grid gap-3 sm:grid-cols-3">
          <Link href="/products/new" className={buttonClasses('secondary')}>
            <IconPlus className="size-4" />
            {t('actionNewProduct')}
          </Link>
          <Link href="/products" className={buttonClasses('secondary')}>
            <IconBox className="size-4" />
            {t('actionProducts')}
          </Link>
          <Link href="/alerts" className={buttonClasses('secondary')}>
            <IconBell className="size-4" />
            {t('actionAlerts')}
          </Link>
        </CardBody>
      </Card>

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
              <p className="px-5 py-8 text-center text-sm text-fg-muted">{t('noNotifications')}</p>
            ) : (
              <ul className="divide-y divide-border">
                {notifications.data.map((n) => (
                  <li key={n.id} className="px-5 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-sm font-medium text-fg">{n.title}</p>
                      <span className="shrink-0 text-xs text-fg-subtle">
                        {formatRelative(n.createdAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-fg-muted">{n.body}</p>
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
