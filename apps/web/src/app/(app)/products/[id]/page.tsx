'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { PageHeader } from '../../../../components/page-header';
import { QueryBoundary } from '../../../../components/query-boundary';
import { Callout } from '../../../../components/ui/callout';
import { Tabs } from '../../../../components/ui/tabs';
import { StatusBadge } from '../../../../components/products/status-badge';
import { CostBreakdown } from '../../../../components/costing/cost-breakdown';
import { SensitivityPanel } from '../../../../components/costing/sensitivity-panel';
import { RadarPanel } from '../../../../components/radar/radar-panel';
import { ScenariosTab } from '../../../../components/scenarios/scenarios-tab';
import { buttonClasses } from '../../../../components/ui/button';
import { IconArrowLeft } from '../../../../components/icons';
import { useProduct } from '../../../../hooks/use-products';
import { useCosting, useSensitivity } from '../../../../hooks/use-costing';

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const t = useTranslations('detail');
  const tc = useTranslations('costing');
  const ts = useTranslations('sensitivity');
  const tf = useTranslations('products.form');
  const tp = useTranslations('products');

  const product = useProduct(id);
  const costing = useCosting(id);
  const sensitivity = useSensitivity(id, Boolean(product.data?.recipe));

  return (
    <div className="space-y-6">
      <Link
        href="/products"
        className="inline-flex items-center gap-1.5 text-[13px] text-fg-muted hover:text-fg"
      >
        <IconArrowLeft className="size-4" />
        {tf('back')}
      </Link>

      <QueryBoundary
        isLoading={product.isLoading}
        isError={product.isError}
        onRetry={() => void product.refetch()}
      >
        {!product.data ? (
          <Callout tone="danger">{t('notFound')}</Callout>
        ) : (
          <>
            <PageHeader
              title={
                <span className="flex items-center gap-3">
                  {product.data.name}
                  <StatusBadge status={product.data.status} />
                </span>
              }
              actions={
                <Link href={`/products/${id}/edit`} className={buttonClasses('secondary', 'sm')}>
                  {tp('edit')}
                </Link>
              }
              description={
                product.data.recipe
                  ? t('recipeMeta', {
                      qty: product.data.recipe.outputQuantity,
                      unit: product.data.recipe.outputUnit ?? 'u',
                      version: product.data.recipe.version,
                    })
                  : (product.data.rubro ?? undefined)
              }
            />

            {!product.data.recipe ? (
              <Callout tone="warning">{t('noRecipe')}</Callout>
            ) : (
              <Tabs
                tabs={[
                  {
                    id: 'costing',
                    label: t('tabCosting'),
                    content: (
                      <QueryBoundary
                        isLoading={costing.isLoading}
                        isError={costing.isError}
                        onRetry={() => void costing.refetch()}
                      >
                        {costing.data ? (
                          <CostBreakdown result={costing.data} />
                        ) : (
                          <Callout tone="info">{tc('unavailable')}</Callout>
                        )}
                      </QueryBoundary>
                    ),
                  },
                  {
                    id: 'sensitivity',
                    label: t('tabSensitivity'),
                    content: (
                      <QueryBoundary
                        isLoading={sensitivity.isLoading}
                        isError={sensitivity.isError}
                        onRetry={() => void sensitivity.refetch()}
                      >
                        {sensitivity.data ? (
                          <SensitivityPanel result={sensitivity.data} />
                        ) : (
                          <Callout tone="info">{ts('unavailable')}</Callout>
                        )}
                      </QueryBoundary>
                    ),
                  },
                  {
                    id: 'radar',
                    label: t('tabRadar'),
                    content: <RadarPanel productId={id} />,
                  },
                  {
                    id: 'scenarios',
                    label: t('tabScenarios'),
                    content: <ScenariosTab productId={id} product={product.data} />,
                  },
                ]}
              />
            )}
          </>
        )}
      </QueryBoundary>
    </div>
  );
}
