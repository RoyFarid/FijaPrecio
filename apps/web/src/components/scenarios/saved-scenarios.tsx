'use client';

import { useTranslations } from 'next-intl';
import { Card, CardBody, CardHeader } from '../ui/card';
import { Button } from '../ui/button';
import { QueryBoundary } from '../query-boundary';
import { IconTrash } from '../icons';
import { formatMoney, formatPercent, formatRelative } from '../../lib/format';
import {
  useScenarios,
  useDeleteScenario,
  useRecomputeScenario,
  isEntitlementError,
} from '../../hooks/use-scenarios';

export function SavedScenarios({ productId }: { productId: string }) {
  const t = useTranslations('scenarios');
  const tc = useTranslations('common');
  const query = useScenarios(productId);
  const del = useDeleteScenario(productId);
  const recompute = useRecomputeScenario(productId);

  if (query.isError && isEntitlementError(query.error)) return null;

  return (
    <Card>
      <CardHeader title={t('savedList')} />
      <CardBody flush>
        <QueryBoundary
          isLoading={query.isLoading}
          isError={query.isError}
          onRetry={() => void query.refetch()}
        >
          {!query.data || query.data.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-fg-muted">{t('noSaved')}</p>
          ) : (
            <ul className="divide-y divide-border">
              {query.data.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-fg">{s.name}</p>
                    <p className="mt-0.5 text-xs text-fg-subtle">
                      {s.delta
                        ? `${t('metricUnitCost')}: ${s.delta.unitCost > 0 ? '+' : ''}${formatMoney(
                            s.delta.unitCost,
                            s.result?.currency ?? 'PEN',
                          )} · ${t('metricMargin')}: ${
                            s.delta.marginPct != null ? formatPercent(s.delta.marginPct) : '—'
                          }`
                        : formatRelative(s.createdAt)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={recompute.isPending}
                    onClick={() => recompute.mutate(s.id)}
                  >
                    {t('recompute')}
                  </Button>
                  <button
                    type="button"
                    aria-label={tc('delete')}
                    disabled={del.isPending}
                    onClick={() => del.mutate(s.id)}
                    className="grid size-8 place-items-center rounded-md text-fg-muted hover:bg-surface-muted hover:text-danger"
                  >
                    <IconTrash className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </QueryBoundary>
      </CardBody>
    </Card>
  );
}
