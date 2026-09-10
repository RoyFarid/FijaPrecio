'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '../ui/badge';
import type { CostPriceSource } from '../../lib/types';

const TONE: Record<CostPriceSource, 'brand' | 'neutral' | 'danger'> = {
  consensus: 'brand',
  override: 'neutral',
  org_input: 'neutral',
  supplier: 'neutral',
  missing: 'danger',
};

export function PriceSourceBadge({ source }: { source?: CostPriceSource }) {
  const t = useTranslations('costing.source');
  if (!source) return null;
  return <Badge tone={TONE[source]}>{t(source)}</Badge>;
}
