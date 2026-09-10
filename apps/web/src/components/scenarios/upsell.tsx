'use client';

import { useTranslations } from 'next-intl';
import { Card, CardBody } from '../ui/card';

export function ScenarioUpsell() {
  const t = useTranslations('upsell');
  return (
    <Card>
      <CardBody className="space-y-2 text-center">
        <p className="text-sm font-semibold text-fg">{t('title')}</p>
        <p className="mx-auto max-w-md text-sm text-fg-muted">{t('body')}</p>
        <p className="pt-1 text-sm font-medium text-brand-strong">{t('cta')}</p>
      </CardBody>
    </Card>
  );
}
