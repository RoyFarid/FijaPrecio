'use client';

import { useTranslations } from 'next-intl';
import { SelectMini, FieldMini } from '../ui/field-mini';
import { IconTrash } from '../icons';
import {
  PATCH_FIELDS,
  REQUIRES_COMPONENT,
  REQUIRES_LINE,
  type DraftOverride,
} from '../../lib/scenario-draft';
import type { ScenarioOverrideType } from '../../lib/types';

const TYPES: ScenarioOverrideType[] = [
  'INPUT_PRICE',
  'SUPPLIER_SWAP',
  'RECIPE_LINE',
  'COST_COMPONENT',
  'MARGIN',
];

interface Opt {
  id: string;
  label: string;
}

export function OverrideEditor({
  override,
  lines,
  components,
  onChange,
  onRemove,
}: {
  override: DraftOverride;
  lines: Opt[];
  components: Opt[];
  onChange: (next: DraftOverride) => void;
  onRemove: () => void;
}) {
  const t = useTranslations('scenarios');
  const tKind = useTranslations('scenarios.overrideKind');
  const tPatch = useTranslations('scenarios.patch');

  const needsLine = REQUIRES_LINE.includes(override.type);
  const needsComponent = REQUIRES_COMPONENT.includes(override.type);

  const setType = (type: ScenarioOverrideType) =>
    onChange({ ...override, type, targetRef: '', patch: {} });

  return (
    <div className="grid gap-3 rounded-md border border-border p-3 md:grid-cols-[minmax(0,1fr)_auto]">
      <div className="space-y-3">
        <SelectMini
          label={t('overrideType')}
          value={override.type}
          onChange={(e) => setType(e.target.value as ScenarioOverrideType)}
          options={TYPES.map((v) => ({ value: v, label: tKind(v) }))}
        />

        {needsLine ? (
          <SelectMini
            label={t('line')}
            value={override.targetRef}
            onChange={(e) => onChange({ ...override, targetRef: e.target.value })}
            options={[
              { value: '', label: t('selectLine') },
              ...lines.map((l) => ({ value: l.id, label: l.label })),
            ]}
          />
        ) : null}

        {needsComponent ? (
          <SelectMini
            label={t('component')}
            value={override.targetRef}
            onChange={(e) => onChange({ ...override, targetRef: e.target.value })}
            options={[
              { value: '', label: t('selectComponent') },
              ...components.map((c) => ({ value: c.id, label: c.label })),
            ]}
          />
        ) : null}

        <div className="grid gap-3 sm:grid-cols-3">
          {PATCH_FIELDS[override.type].map((field) => (
            <FieldMini
              key={field}
              label={tPatch(field)}
              inputMode="decimal"
              value={override.patch[field] ?? ''}
              onChange={(e) =>
                onChange({
                  ...override,
                  patch: { ...override.patch, [field]: e.target.value },
                })
              }
            />
          ))}
        </div>
      </div>

      <div className="flex items-start justify-end">
        <button
          type="button"
          onClick={onRemove}
          aria-label={t('removeOverride')}
          className="grid size-9 place-items-center rounded-md text-fg-muted hover:bg-surface-muted hover:text-danger"
        >
          <IconTrash className="size-4" />
        </button>
      </div>
    </div>
  );
}
