'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { PageHeader } from '../../../components/page-header';
import { Card, CardBody } from '../../../components/ui/card';
import { buttonClasses } from '../../../components/ui/button';
import { QueryBoundary } from '../../../components/query-boundary';
import { EmptyState } from '../../../components/empty-state';
import { StatusBadge } from '../../../components/products/status-badge';
import { useProducts } from '../../../hooks/use-products';
import { formatMoney, formatRelative } from '../../../lib/format';

export default function ProductsPage() {
  const t = useTranslations('products');
  const products = useProducts();

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        actions={
          <Link href="/products/new" className={buttonClasses('primary', 'sm')}>
            {t('new')}
          </Link>
        }
      />

      <QueryBoundary
        isLoading={products.isLoading}
        isError={products.isError}
        onRetry={() => void products.refetch()}
      >
        {!products.data || products.data.length === 0 ? (
          <EmptyState
            title={t('empty')}
            action={
              <Link href="/products/new" className={buttonClasses('primary', 'sm')}>
                {t('emptyCta')}
              </Link>
            }
          />
        ) : (
          <Card>
            <CardBody flush>
              <div className="overflow-x-auto">
                <table className="w-full text-[13.5px]">
                  <thead>
                    <tr className="border-b border-border text-left text-[10.5px] font-bold uppercase tracking-[0.07em] text-fg-subtle">
                      <th className="px-5 py-3 font-bold">{t('colName')}</th>
                      <th className="px-5 py-3 font-bold">{t('colRubro')}</th>
                      <th className="px-5 py-3 font-bold">{t('colLines')}</th>
                      <th className="px-5 py-3 text-right font-bold">{t('colTarget')}</th>
                      <th className="px-5 py-3 font-bold">{t('colUpdated')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {products.data.map((p) => (
                      <tr key={p.id} className="transition-colors hover:bg-surface-muted/50">
                        <td className="px-5 py-3.5">
                          <Link
                            href={`/products/${p.id}`}
                            className="font-semibold text-fg hover:text-brand-strong"
                          >
                            {p.name}
                          </Link>
                          <span className="ml-2 align-middle">
                            <StatusBadge status={p.status} />
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-fg-muted">{p.rubro ?? '—'}</td>
                        <td className="px-5 py-3.5 text-fg-muted">
                          {t('lineCount', { count: p.lineCount })}
                        </td>
                        <td className="px-5 py-3.5 text-right tabular-nums">
                          {formatMoney(p.targetPrice, p.currency)}
                        </td>
                        <td className="px-5 py-3.5 text-fg-subtle">{formatRelative(p.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        )}
      </QueryBoundary>
    </div>
  );
}
