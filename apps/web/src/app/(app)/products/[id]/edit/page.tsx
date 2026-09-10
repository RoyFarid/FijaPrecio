'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ProductForm } from '../../../../../components/products/product-form';
import { QueryBoundary } from '../../../../../components/query-boundary';
import { Callout } from '../../../../../components/ui/callout';
import { IconArrowLeft } from '../../../../../components/icons';
import { useProduct } from '../../../../../hooks/use-products';

export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const t = useTranslations('products.form');
  const td = useTranslations('detail');
  const product = useProduct(id);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/products/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg"
        >
          <IconArrowLeft className="size-4" />
          {t('backToProduct')}
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">{t('editTitle')}</h1>
      </div>

      <QueryBoundary
        isLoading={product.isLoading}
        isError={product.isError}
        onRetry={() => void product.refetch()}
      >
        {!product.data ? (
          <Callout tone="danger">{td('notFound')}</Callout>
        ) : (
          <ProductForm product={product.data} />
        )}
      </QueryBoundary>
    </div>
  );
}
