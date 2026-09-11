'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ProductForm } from '../../../../components/products/product-form';
import { IconArrowLeft } from '../../../../components/icons';

export default function NewProductPage() {
  const t = useTranslations('products.form');

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/products"
          className="inline-flex items-center gap-1.5 text-[13px] text-fg-muted hover:text-fg"
        >
          <IconArrowLeft className="size-4" />
          {t('back')}
        </Link>
        <h1 className="mt-2 text-[26px] font-bold tracking-tight">{t('title')}</h1>
      </div>
      <ProductForm />
    </div>
  );
}
