'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useCurrentUser } from '../../../components/session-context';
import { useEffectiveConfig, PLAN_ENTITLEMENT_KEYS } from '../../../hooks/use-config';
import { Card, CardHeader, CardBody } from '../../../components/ui/card';
import { QueryBoundary } from '../../../components/query-boundary';
import { Button } from '../../../components/ui/button';
import { formatNumber } from '../../../lib/format';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="text-fg-muted">{label}</span>
      <span className="text-right font-medium text-fg">{value}</span>
    </div>
  );
}

export default function SettingsPage() {
  const t = useTranslations('settings');
  const tRoles = useTranslations('settings.roles');
  const tEnt = useTranslations('settings.entitlements');
  const user = useCurrentUser();
  const config = useEffectiveConfig();
  const [showRaw, setShowRaw] = useState(false);

  const fmt = (value: unknown): string => {
    if (typeof value === 'boolean') return value ? t('yes') : t('no');
    if (typeof value === 'number') return value === -1 ? t('unlimited') : formatNumber(value, 0);
    if (value == null) return '—';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-[26px] font-bold tracking-tight">{t('title')}</h1>

      <Card>
        <CardHeader title={t('account')} />
        <CardBody className="divide-y divide-border py-1">
          <Row label={t('accountName')} value={user.name} />
          <Row label={t('accountEmail')} value={user.email} />
          <Row label={t('accountOrg')} value={user.organizationName} />
          <Row label={t('accountRole')} value={tRoles(user.role)} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t('plan')} description={t('planHint')} />
        <CardBody flush>
          <QueryBoundary
            isLoading={config.isLoading}
            isError={config.isError}
            onRetry={() => void config.refetch()}
          >
            <div className="divide-y divide-border px-5 py-1">
              {PLAN_ENTITLEMENT_KEYS.map((key) => (
                <Row key={key} label={tEnt(key)} value={fmt(config.data?.[key])} />
              ))}
            </div>
          </QueryBoundary>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={t('effectiveConfig')}
          description={t('effectiveConfigHint')}
          action={
            <Button variant="ghost" size="sm" onClick={() => setShowRaw((v) => !v)}>
              {showRaw ? t('hideConfig') : t('showConfig')}
            </Button>
          }
        />
        {showRaw ? (
          <CardBody flush>
            <QueryBoundary isLoading={config.isLoading} isError={config.isError}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-fg-subtle">
                      <th className="px-5 py-2 font-semibold">{t('key')}</th>
                      <th className="px-5 py-2 font-semibold">{t('value')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {Object.entries(config.data ?? {})
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([key, value]) => (
                        <tr key={key}>
                          <td className="px-5 py-2 font-mono text-xs text-fg-muted">{key}</td>
                          <td className="px-5 py-2 font-mono text-xs text-fg">{fmt(value)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </QueryBoundary>
          </CardBody>
        ) : null}
      </Card>
    </div>
  );
}
