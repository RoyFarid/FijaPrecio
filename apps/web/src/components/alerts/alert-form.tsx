'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import {
  createAlertFormSchema,
  alertTypeValues,
  channelValues,
  type CreateAlertForm,
} from '../../lib/schemas';
import { applyApiIssues } from '../../lib/form-errors';
import type { CreateAlertPayload, UpdateAlertPayload } from '../../lib/api-payloads';
import type { Alert, AlertType } from '../../lib/types';
import { useCreateAlert, useUpdateAlert } from '../../hooks/use-alerts';
import { useProducts } from '../../hooks/use-products';
import { Field } from '../ui/field';
import { SelectField } from '../ui/select';
import { Button } from '../ui/button';
import { Callout } from '../ui/callout';
import { InputAutocomplete } from '../products/input-autocomplete';

const num = (v: string): number | undefined => {
  const s = v.trim();
  if (s === '') return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
};

const needsProduct = (t: AlertType) => t === 'MARGIN_DROP' || t === 'COMPETITOR_PRICE_DROP';
const needsInput = (t: AlertType) => t === 'INPUT_PRICE_RISE' || t === 'CONSENSUS_SHIFT';

export function AlertForm({ alert, onDone }: { alert?: Alert; onDone: () => void }) {
  const t = useTranslations('alerts');
  const tType = useTranslations('alerts.type');
  const tTypeHint = useTranslations('alerts.typeHint');
  const tChannel = useTranslations('alerts.channel');
  const tc = useTranslations('common');
  const editing = Boolean(alert);
  const products = useProducts();
  const create = useCreateAlert();
  const update = useUpdateAlert();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    control,
    watch,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateAlertForm>({
    resolver: zodResolver(createAlertFormSchema),
    defaultValues: {
      name: alert?.name ?? '',
      type: alert?.type ?? 'MARGIN_DROP',
      productId: alert?.productId ?? '',
      canonicalInputId: alert?.canonicalInputId ?? '',
      marginFloorPct: alert?.thresholds.marginFloorPct?.toString() ?? '',
      risePct: alert?.thresholds.risePct?.toString() ?? '',
      dropPct: alert?.thresholds.dropPct?.toString() ?? '',
      channels: alert?.channels ?? ['IN_APP'],
    },
  });

  const type = watch('type') as AlertType;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const thresholds = {
      marginFloorPct: num(values.marginFloorPct),
      risePct: num(values.risePct),
      dropPct: num(values.dropPct),
    };
    try {
      if (editing && alert) {
        const patch: UpdateAlertPayload = {
          name: values.name.trim(),
          thresholds,
          channels: values.channels,
        };
        await update.mutateAsync({ id: alert.id, patch });
      } else {
        const payload: CreateAlertPayload = {
          name: values.name.trim(),
          type: values.type,
          productId: needsProduct(values.type) ? values.productId : undefined,
          canonicalInputId: needsInput(values.type) ? values.canonicalInputId : undefined,
          thresholds,
          channels: values.channels,
        };
        await create.mutateAsync(payload);
      }
      onDone();
    } catch (err) {
      if (!applyApiIssues(err, setError, ['name', 'productId', 'canonicalInputId'])) {
        setFormError(t('genericError'));
      }
    }
  });

  const productOptions = (products.data ?? []).map((p) => ({ value: p.id, label: p.name }));

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {formError ? <Callout tone="danger">{formError}</Callout> : null}

      <Field label={t('fieldName')} error={errors.name?.message} {...register('name')} />

      <div>
        <SelectField
          label={t('fieldType')}
          disabled={editing}
          options={alertTypeValues.map((v) => ({ value: v, label: tType(v) }))}
          {...register('type')}
        />
        <p className="mt-1 text-xs text-fg-muted">{tTypeHint(type)}</p>
      </div>

      {needsProduct(type) ? (
        <SelectField
          label={t('fieldProduct')}
          placeholder={t('selectProduct')}
          disabled={editing}
          options={productOptions}
          error={errors.productId?.message}
          {...register('productId')}
        />
      ) : null}

      {needsInput(type) ? (
        editing ? (
          <Field label={t('fieldInput')} value={alert?.canonicalInputId ?? ''} disabled readOnly />
        ) : (
          <Controller
            control={control}
            name="canonicalInputId"
            render={({ field }) => (
              <div className="space-y-1.5">
                <span className="block text-sm font-medium text-fg">{t('fieldInput')}</span>
                <InputAutocomplete
                  value={field.value}
                  onChange={() => field.onChange('')}
                  onPick={(m) => field.onChange(m.id)}
                  placeholder={t('selectInput')}
                  error={errors.canonicalInputId?.message}
                />
                {field.value ? (
                  <p className="text-xs text-brand-strong">✓ {field.value}</p>
                ) : null}
              </div>
            )}
          />
        )
      ) : null}

      {type === 'MARGIN_DROP' ? (
        <Field
          label={t('fieldMarginFloor')}
          inputMode="decimal"
          error={errors.marginFloorPct?.message}
          {...register('marginFloorPct')}
        />
      ) : null}
      {needsInput(type) ? (
        <Field
          label={t('fieldRisePct')}
          inputMode="decimal"
          error={errors.risePct?.message}
          {...register('risePct')}
        />
      ) : null}
      {type === 'COMPETITOR_PRICE_DROP' ? (
        <Field
          label={t('fieldDropPct')}
          inputMode="decimal"
          error={errors.dropPct?.message}
          {...register('dropPct')}
        />
      ) : null}

      <fieldset>
        <legend className="text-sm font-medium text-fg">{t('fieldChannels')}</legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {channelValues.map((ch) => (
            <label key={ch} className="flex items-center gap-2 text-sm">
              <input type="checkbox" value={ch} {...register('channels')} className="size-4" />
              {tChannel(ch)}
            </label>
          ))}
        </div>
        {errors.channels?.message ? (
          <p className="mt-1 text-sm text-danger">{errors.channels.message}</p>
        ) : null}
      </fieldset>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" onClick={onDone}>
          {tc('cancel')}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {editing ? tc('save') : tc('create')}
        </Button>
      </div>
    </form>
  );
}
