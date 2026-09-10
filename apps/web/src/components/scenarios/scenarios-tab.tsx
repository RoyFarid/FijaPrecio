'use client';

import { useTranslations } from 'next-intl';
import { QueryBoundary } from '../query-boundary';
import { Callout } from '../ui/callout';
import { ScenarioUpsell } from './upsell';
import { ScenarioBuilder } from './scenario-builder';
import { useEffectiveConfig } from '../../hooks/use-config';
import type { ProductDetail } from '../../lib/types';

export function ScenariosTab({
  productId,
  product,
}: {
  productId: string;
  product: ProductDetail;
}) {
  const t = useTranslations('detail');
  const config = useEffectiveConfig();

  if (!product.recipe) return <Callout tone="warning">{t('noRecipe')}</Callout>;

  return (
    <QueryBoundary
      isLoading={config.isLoading}
      isError={config.isError}
      onRetry={() => void config.refetch()}
    >
      {config.data?.['scenario_simulator'] === true ? (
        <ScenarioBuilder productId={productId} product={product} />
      ) : (
        <ScenarioUpsell />
      )}
    </QueryBoundary>
  );
}
