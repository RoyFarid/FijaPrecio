import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('brand');

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-lg font-semibold tracking-tight">{t('name')}</p>
          <p className="mt-1 text-sm text-fg-muted">{t('tagline')}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
