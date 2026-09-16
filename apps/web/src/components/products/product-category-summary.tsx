'use client';

import { useTranslations } from 'next-intl';
import { useProductCategory } from '../../hooks/use-product-categories';

/** Muestra la categoría elegida (rubro > ... > tipo) y los atributos llenados,
 *  con sus etiquetas legibles — para que lo que se llenó en el formulario no
 *  desaparezca de la vista una vez guardado. */
export function ProductCategorySummary({
  categoryId,
  attributes,
}: {
  categoryId: string | null;
  attributes: Record<string, unknown>;
}) {
  const t = useTranslations('products.form');
  const category = useProductCategory(categoryId);

  if (!categoryId || !category.data) return null;

  const crumbs = [...category.data.breadcrumb.map((b) => b.name), category.data.name];
  const filled = category.data.attributeDefs.filter((def) => attributes[def.key] != null && attributes[def.key] !== '');

  return (
    <div className="rounded-lg border border-border bg-surface-muted/30 p-3">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-fg-subtle">
        {t('sectionCategory')}
      </p>
      <p className="mt-1 text-[13px] text-fg">{crumbs.join(' › ')}</p>
      {filled.length > 0 ? (
        <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">
          {filled.map((def) => (
            <div key={def.key} className="flex justify-between gap-2 text-[13px] sm:justify-start">
              <dt className="text-fg-muted">{def.label}:</dt>
              <dd className="font-medium text-fg">
                {String(attributes[def.key])}
                {def.unit ? ` ${def.unit}` : ''}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
