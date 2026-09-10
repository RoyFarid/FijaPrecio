'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Spinner } from './ui/spinner';
import { Button } from './ui/button';
import { Callout } from './ui/callout';

interface Props {
  isLoading: boolean;
  isError: boolean;
  onRetry?: () => void;
  children: ReactNode;
}

/** Envuelve el contenido de una query: muestra spinner / error, o los hijos. */
export function QueryBoundary({ isLoading, isError, onRetry, children }: Props) {
  const t = useTranslations('state');

  if (isLoading) {
    return (
      <div className="grid place-items-center py-16">
        <Spinner className="text-fg-subtle" />
      </div>
    );
  }

  if (isError) {
    return (
      <Callout tone="danger" className="flex items-center justify-between gap-4">
        <span>{t('loadError')}</span>
        {onRetry ? (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            {t('retry')}
          </Button>
        ) : null}
      </Callout>
    );
  }

  return <>{children}</>;
}
