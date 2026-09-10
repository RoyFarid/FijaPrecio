'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '../components/ui/button';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors');

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="max-w-sm text-center">
        <h1 className="text-lg font-semibold">{t('pageTitle')}</h1>
        <p className="mt-2 text-sm text-fg-muted">{t('server')}</p>
        <Button className="mt-5" onClick={reset}>
          {t('pageRetry')}
        </Button>
      </div>
    </div>
  );
}
