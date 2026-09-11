'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { PageHeader } from '../../../components/page-header';
import { Card, CardBody } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Toggle } from '../../../components/ui/toggle';
import { Dialog } from '../../../components/ui/dialog';
import { QueryBoundary } from '../../../components/query-boundary';
import { EmptyState } from '../../../components/empty-state';
import { AlertForm } from '../../../components/alerts/alert-form';
import { IconTrash } from '../../../components/icons';
import { useAlerts, useUpdateAlert, useDeleteAlert } from '../../../hooks/use-alerts';
import { formatRelative } from '../../../lib/format';
import type { Alert } from '../../../lib/types';

export default function AlertsPage() {
  const t = useTranslations('alerts');
  const tType = useTranslations('alerts.type');
  const tChannel = useTranslations('alerts.channel');
  const tc = useTranslations('common');
  const alerts = useAlerts();
  const update = useUpdateAlert();
  const remove = useDeleteAlert();
  const [dialog, setDialog] = useState<{ mode: 'new' } | { mode: 'edit'; alert: Alert } | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        actions={
          <Button size="sm" onClick={() => setDialog({ mode: 'new' })}>
            {t('new')}
          </Button>
        }
      />

      <QueryBoundary
        isLoading={alerts.isLoading}
        isError={alerts.isError}
        onRetry={() => void alerts.refetch()}
      >
        {!alerts.data || alerts.data.length === 0 ? (
          <EmptyState
            title={t('empty')}
            action={
              <Button size="sm" onClick={() => setDialog({ mode: 'new' })}>
                {t('new')}
              </Button>
            }
          />
        ) : (
          <Card>
            <CardBody flush>
              <ul className="divide-y divide-border">
                {alerts.data.map((a) => (
                  <li key={a.id} className="flex items-start gap-4 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13.5px] font-semibold text-fg">{a.name}</span>
                        <Badge tone="neutral">{tType(a.type)}</Badge>
                        {a.channels.map((ch) => (
                          <Badge key={ch} tone="brand">
                            {tChannel(ch)}
                          </Badge>
                        ))}
                      </div>
                      <p className="mt-1 text-xs text-fg-subtle">
                        {a.lastTriggeredAt
                          ? t('lastTriggered', { when: formatRelative(a.lastTriggeredAt) })
                          : t('neverTriggered')}
                      </p>
                    </div>

                    <Toggle
                      label={t('colEnabled')}
                      checked={a.enabled}
                      disabled={update.isPending}
                      onChange={(next) =>
                        update.mutate({ id: a.id, patch: { enabled: next } })
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setDialog({ mode: 'edit', alert: a })}
                      className="text-[12px] font-semibold text-brand-strong hover:underline"
                    >
                      {tc('edit')}
                    </button>
                    <button
                      type="button"
                      aria-label={tc('delete')}
                      onClick={() => {
                        if (window.confirm(tc('confirmDelete', { name: a.name }))) remove.mutate(a.id);
                      }}
                      className="grid size-8 place-items-center rounded-lg text-fg-muted hover:bg-surface-muted hover:text-danger"
                    >
                      <IconTrash className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        )}
      </QueryBoundary>

      <Dialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        title={dialog?.mode === 'edit' ? t('edit') : t('new')}
      >
        {dialog ? (
          <AlertForm
            alert={dialog.mode === 'edit' ? dialog.alert : undefined}
            onDone={() => setDialog(null)}
          />
        ) : null}
      </Dialog>
    </div>
  );
}
