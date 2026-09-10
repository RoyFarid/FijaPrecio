'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '../ui/badge';
import type { ProductStatus } from '../../lib/types';

const TONE: Record<ProductStatus, 'brand' | 'neutral' | 'warning'> = {
  ACTIVE: 'brand',
  DRAFT: 'warning',
  ARCHIVED: 'neutral',
};

export function StatusBadge({ status }: { status: ProductStatus }) {
  const t = useTranslations('products.status');
  return <Badge tone={TONE[status]}>{t(status)}</Badge>;
}
