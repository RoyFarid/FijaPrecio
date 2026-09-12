'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import {
  createProductFormSchema,
  componentTypeValues,
  calcMethodValues,
  type CreateProductForm,
} from '../../lib/schemas';
import { applyApiIssues } from '../../lib/form-errors';
import {
  EMPTY_LINE,
  EMPTY_COMPONENT,
  productToFormValues,
  formToCreatePayload,
  formToRecipePayload,
  formToUpdatePayload,
} from '../../lib/product-form';
import { useCreateProduct, useReplaceRecipe, useUpdateProduct } from '../../hooks/use-products';
import { useEffectiveConfig } from '../../hooks/use-config';
import type { ProductDetail } from '../../lib/types';
import { Card, CardHeader, CardBody } from '../ui/card';
import { Field } from '../ui/field';
import { FieldMini, SelectMini } from '../ui/field-mini';
import { Button } from '../ui/button';
import { Callout } from '../ui/callout';
import { InputAutocomplete } from './input-autocomplete';
import { IconTrash } from '../icons';

export function ProductForm({ product }: { product?: ProductDetail }) {
  const t = useTranslations('products.form');
  const tc = useTranslations('common');
  const tType = useTranslations('componentType');
  const tCalc = useTranslations('calcMethod');
  const router = useRouter();
  const editing = Boolean(product);

  const create = useCreateProduct();
  const update = useUpdateProduct(product?.id ?? '');
  const replaceRecipe = useReplaceRecipe(product?.id ?? '');
  const config = useEffectiveConfig();
  const [formError, setFormError] = useState<string | null>(null);

  const allowedUnits = Array.isArray(config.data?.['units.allowed'])
    ? (config.data['units.allowed'] as string[])
    : [];

  const {
    register,
    control,
    setValue,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateProductForm>({
    resolver: zodResolver(createProductFormSchema),
    defaultValues: productToFormValues(product),
  });

  const lines = useFieldArray({ control, name: 'lines' });
  const components = useFieldArray({ control, name: 'components' });

  const typeOptions = componentTypeValues.map((v) => ({ value: v, label: tType(v) }));
  const calcOptions = calcMethodValues.map((v) => ({ value: v, label: tCalc(v) }));
  const opt = ` (${tc('optional')})`;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      if (editing && product) {
        await update.mutateAsync(formToUpdatePayload(values));
        await replaceRecipe.mutateAsync(formToRecipePayload(values));
        router.replace(`/products/${product.id}`);
        router.refresh();
      } else {
        const { id } = await create.mutateAsync(formToCreatePayload(values));
        router.replace(`/products/${id}`);
      }
    } catch (err) {
      if (!applyApiIssues(err, setError, ['name', 'rubro', 'radarQuery', 'currency'])) {
        setFormError(t('genericError'));
      }
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      {formError ? <Callout tone="danger">{formError}</Callout> : null}

      <datalist id="units">
        {allowedUnits.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>

      <Card>
        <CardHeader title={t('sectionBasics')} />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label={t('name')} placeholder={t('namePlaceholder')} error={errors.name?.message} {...register('name')} />
          <Field label={t('rubro') + opt} placeholder={t('rubroPlaceholder')} error={errors.rubro?.message} {...register('rubro')} />
          <Field label={t('currency')} maxLength={3} error={errors.currency?.message} {...register('currency')} />
          <div className="sm:col-span-2">
            <Field
              label={t('radarQuery') + opt}
              placeholder={t('radarQueryPlaceholder')}
              hint={t('radarQueryHint')}
              error={errors.radarQuery?.message}
              {...register('radarQuery')}
            />
          </div>
          <Field label={t('outputQuantity')} inputMode="decimal" error={errors.outputQuantity?.message} {...register('outputQuantity')} />
          <Field label={t('outputUnit') + opt} list="units" placeholder={t('outputUnitPlaceholder')} error={errors.outputUnit?.message} {...register('outputUnit')} />
          <Field label={t('laborMinutes') + opt} inputMode="decimal" error={errors.laborMinutes?.message} {...register('laborMinutes')} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={t('sectionRecipe')}
          action={
            <Button variant="secondary" size="sm" onClick={() => lines.append({ ...EMPTY_LINE })}>
              {t('addLine')}
            </Button>
          }
        />
        <CardBody className="space-y-4">
          {typeof errors.lines?.message === 'string' ? (
            <Callout tone="danger">{errors.lines.message}</Callout>
          ) : null}

          {lines.fields.map((field, i) => (
            <div
              key={field.id}
              className="grid gap-3 rounded-md border border-border p-3 md:grid-cols-[minmax(0,1fr)_5rem_5rem_5rem_6rem_auto]"
            >
              <div>
                <label className="mb-1 block text-xs font-medium text-fg-muted">{t('lineName')}</label>
                <Controller
                  control={control}
                  name={`lines.${i}.name`}
                  render={({ field: f }) => (
                    <InputAutocomplete
                      value={f.value}
                      onChange={f.onChange}
                      onPick={(m) => {
                        f.onChange(m.name);
                        setValue(`lines.${i}.unit`, m.baseUnit, { shouldValidate: false });
                      }}
                      placeholder={t('lineNamePlaceholder')}
                      error={errors.lines?.[i]?.name?.message}
                    />
                  )}
                />
              </div>
              <FieldMini label={t('lineUnit')} list="units" error={errors.lines?.[i]?.unit?.message} {...register(`lines.${i}.unit`)} />
              <FieldMini label={t('lineQuantity')} inputMode="decimal" error={errors.lines?.[i]?.quantity?.message} {...register(`lines.${i}.quantity`)} />
              <FieldMini label={t('lineWaste')} inputMode="decimal" error={errors.lines?.[i]?.wastePct?.message} {...register(`lines.${i}.wastePct`)} />
              <FieldMini label={t('lineUnitCost')} inputMode="decimal" error={errors.lines?.[i]?.unitCost?.message} {...register(`lines.${i}.unitCost`)} />
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => lines.remove(i)}
                  disabled={lines.fields.length === 1}
                  aria-label={tc('remove')}
                  className="grid size-9 place-items-center rounded-md text-fg-muted hover:bg-surface-muted disabled:opacity-40"
                >
                  <IconTrash className="size-4" />
                </button>
              </div>
            </div>
          ))}
          <p className="text-xs text-fg-subtle">{t('lineUnitCostHint')}</p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={t('sectionComponents')}
          description={t('componentsHint')}
          action={
            <Button variant="secondary" size="sm" onClick={() => components.append({ ...EMPTY_COMPONENT })}>
              {t('addComponent')}
            </Button>
          }
        />
        {components.fields.length > 0 ? (
          <CardBody className="space-y-4">
            {components.fields.map((field, i) => (
              <div
                key={field.id}
                className="grid gap-3 rounded-md border border-border p-3 md:grid-cols-[10rem_minmax(0,1fr)_12rem_6rem_auto]"
              >
                <SelectMini label={t('componentType')} options={typeOptions} {...register(`components.${i}.type`)} />
                <FieldMini label={t('componentLabel')} error={errors.components?.[i]?.label?.message} {...register(`components.${i}.label`)} />
                <SelectMini label={t('componentCalc')} options={calcOptions} {...register(`components.${i}.calc`)} />
                <FieldMini label={t('componentValue')} inputMode="decimal" error={errors.components?.[i]?.value?.message} {...register(`components.${i}.value`)} />
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => components.remove(i)}
                    aria-label={tc('remove')}
                    className="grid size-9 place-items-center rounded-md text-fg-muted hover:bg-surface-muted"
                  >
                    <IconTrash className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </CardBody>
        ) : null}
      </Card>

      <Card>
        <CardHeader title={t('sectionTarget')} description={t('targetHint')} />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label={t('targetPrice') + opt} inputMode="decimal" error={errors.targetPrice?.message} {...register('targetPrice')} />
          <Field label={t('targetMarginPct') + opt} inputMode="decimal" error={errors.targetMarginPct?.message} {...register('targetMarginPct')} />
        </CardBody>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => router.back()}>
          {t('back')}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {editing ? tc('save') : t('submit')}
        </Button>
      </div>
    </form>
  );
}
