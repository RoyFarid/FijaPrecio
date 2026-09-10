import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { buttonClasses } from '../components/ui/button';

export default async function NotFound() {
  const t = await getTranslations('errors');

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="max-w-sm text-center">
        <h1 className="text-lg font-semibold">{t('notFoundTitle')}</h1>
        <p className="mt-2 text-sm text-fg-muted">{t('notFoundBody')}</p>
        <Link href="/dashboard" className={`${buttonClasses('primary')} mt-5`}>
          {t('goHome')}
        </Link>
      </div>
    </div>
  );
}
