'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardBody, CardHeader } from '../ui/card';
import { Button } from '../ui/button';
import { Callout } from '../ui/callout';
import { IconTrash, IconPlus } from '../icons';
import { OverrideEditor } from './override-editor';
import { ComparisonTable } from './comparison-table';
import { SavedScenarios } from './saved-scenarios';
import {
  emptyOverride,
  emptyScenario,
  scenarioToPayload,
  toComparePayload,
  type DraftOverride,
  type DraftScenario,
} from '../../lib/scenario-draft';
import { useCompareScenarios, useCreateScenario } from '../../hooks/use-scenarios';
import type { ProductDetail } from '../../lib/types';

export function ScenarioBuilder({
  productId,
  product,
}: {
  productId: string;
  product: ProductDetail;
}) {
  const t = useTranslations('scenarios');
  const [scenarios, setScenarios] = useState<DraftScenario[]>(() => [emptyScenario('Escenario 1')]);
  const [notice, setNotice] = useState<string | null>(null);

  const compare = useCompareScenarios(productId);
  const create = useCreateScenario(productId);

  const lineOpts = useMemo(
    () => (product.recipe?.lines ?? []).map((l) => ({ id: l.id, label: l.displayName })),
    [product],
  );
  const componentOpts = useMemo(
    () => (product.recipe?.components ?? []).map((c) => ({ id: c.id, label: c.label })),
    [product],
  );

  const patchScenario = (id: string, patch: Partial<DraftScenario>) =>
    setScenarios((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const patchOverride = (sid: string, oid: string, next: DraftOverride) =>
    setScenarios((prev) =>
      prev.map((s) =>
        s.id === sid
          ? { ...s, overrides: s.overrides.map((o) => (o.id === oid ? next : o)) }
          : s,
      ),
    );

  const runCompare = () => {
    setNotice(null);
    const payload = toComparePayload(scenarios);
    if (!payload) {
      setNotice(t('nothingToCompare'));
      return;
    }
    compare.mutate(payload, { onError: () => setNotice(t('compareError')) });
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-fg-muted">{t('intro')}</p>

      {scenarios.map((scenario, si) => (
        <Card key={scenario.id}>
          <CardHeader
            title={
              <input
                value={scenario.name}
                onChange={(e) => patchScenario(scenario.id, { name: e.target.value })}
                aria-label={t('scenarioName')}
                className="w-52 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm font-semibold hover:border-border focus:border-brand focus:outline-none"
              />
            }
            action={
              scenarios.length > 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    setScenarios((prev) => prev.filter((s) => s.id !== scenario.id))
                  }
                  aria-label={t('removeScenario')}
                  className="grid size-8 place-items-center rounded-md text-fg-muted hover:bg-surface-muted hover:text-danger"
                >
                  <IconTrash className="size-4" />
                </button>
              ) : null
            }
          />
          <CardBody className="space-y-3">
            {scenario.overrides.map((ov) => (
              <OverrideEditor
                key={ov.id}
                override={ov}
                lines={lineOpts}
                components={componentOpts}
                onChange={(next) => patchOverride(scenario.id, ov.id, next)}
                onRemove={() =>
                  patchScenario(scenario.id, {
                    overrides: scenario.overrides.filter((o) => o.id !== ov.id),
                  })
                }
              />
            ))}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  patchScenario(scenario.id, {
                    overrides: [...scenario.overrides, emptyOverride()],
                  })
                }
              >
                <IconPlus className="size-4" />
                {t('addOverride')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={create.isPending || !scenarioToPayload(scenario)}
                onClick={() => {
                  const payload = scenarioToPayload(scenario);
                  if (payload) create.mutate(payload);
                }}
              >
                {t('save')}
              </Button>
              {si === scenarios.length - 1 ? (
                <span className="text-xs text-fg-subtle">
                  {create.isSuccess ? t('saved') : ''}
                </span>
              ) : null}
            </div>
          </CardBody>
        </Card>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            setScenarios((prev) => [...prev, emptyScenario(`Escenario ${prev.length + 1}`)])
          }
        >
          <IconPlus className="size-4" />
          {t('addScenario')}
        </Button>
        <Button onClick={runCompare} disabled={compare.isPending}>
          {compare.isPending ? t('comparing') : t('compare')}
        </Button>
      </div>

      {notice ? <Callout tone="warning">{notice}</Callout> : null}

      {compare.data ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">{t('results')}</h3>
          <ComparisonTable comparison={compare.data} />
        </div>
      ) : null}

      <SavedScenarios productId={productId} />
    </div>
  );
}
