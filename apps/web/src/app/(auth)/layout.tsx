import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { IconTrendUp, IconRadar, IconBell } from '../../components/icons';

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('brand');
  const ta = await getTranslations('auth');

  const feats = [
    { icon: IconTrendUp, label: ta('featCosting') },
    { icon: IconRadar, label: ta('featRadar') },
    { icon: IconBell, label: ta('featAlerts') },
  ];

  return (
    <div className="min-h-dvh bg-bg lg:grid lg:grid-cols-[1.05fr_1fr]">
      <div className="hidden flex-col justify-between p-14 lg:flex">
        <p className="text-lg font-bold tracking-tight">{t('name')}</p>
        <div className="max-w-md space-y-6">
          <h1 className="text-[46px] font-bold leading-[1.08] tracking-tight">{t('tagline')}</h1>
          <p className="text-[15px] leading-relaxed text-fg-muted">{t('pitch')}</p>
          <ul className="space-y-3 pt-1">
            {feats.map((f) => {
              const Icon = f.icon;
              return (
                <li key={f.label} className="flex items-center gap-3 text-[13px] text-fg-muted">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand-strong">
                    <Icon className="size-4" />
                  </span>
                  {f.label}
                </li>
              );
            })}
          </ul>
        </div>
        <div />
      </div>

      <div className="flex items-center justify-center border-border bg-surface px-6 py-12 lg:border-l">
        <div className="w-full max-w-sm">
          <p className="mb-8 text-lg font-bold tracking-tight lg:hidden">{t('name')}</p>
          {children}
        </div>
      </div>
    </div>
  );
}
