'use client';

import { useTranslations } from 'next-intl';
import { cn } from '../../../lib/cn';
import { formatRelative } from '../../../lib/format';
import { Card, CardHeader, CardBody } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { QueryBoundary } from '../../../components/query-boundary';
import { useNotifications, useUnreadCount, useMarkAllRead } from '../../../hooks/use-notifications';

export default function NotificationsPage() {
  const t = useTranslations('notifications');
  const list = useNotifications({ limit: 50 });
  const unread = useUnreadCount();
  const markAll = useMarkAllRead();
  const count = unread.data?.count ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-fg-muted">{t('unreadCount', { count })}</p>
        </div>
        {count > 0 ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending}
          >
            {t('markAllRead')}
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader title={t('title')} />
        <CardBody flush>
          <QueryBoundary
            isLoading={list.isLoading}
            isError={list.isError}
            onRetry={() => void list.refetch()}
          >
            {!list.data || list.data.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-fg-muted">{t('empty')}</p>
            ) : (
              <ul className="divide-y divide-border">
                {list.data.map((n) => (
                  <li
                    key={n.id}
                    className={cn('px-5 py-4', !n.readAt && 'bg-brand-soft/30')}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-sm font-medium text-fg">{n.title}</p>
                      <span className="shrink-0 text-xs text-fg-subtle">
                        {formatRelative(n.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-fg-muted">{n.body}</p>
                    {!n.readAt ? (
                      <Badge tone="brand" className="mt-2">
                        {t('new')}
                      </Badge>
                    ) : null}
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
