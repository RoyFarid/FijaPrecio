'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ComponentType, SVGProps } from 'react';
import { cn } from '../lib/cn';
import { IconHome, IconBox, IconTag, IconRadar, IconBell, IconSettings } from './icons';

type Item = {
  href: string;
  labelKey: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  ready: boolean;
};

const MAIN: Item[] = [
  { href: '/dashboard', labelKey: 'dashboard', icon: IconHome, ready: true },
  { href: '/products', labelKey: 'products', icon: IconBox, ready: true },
  { href: '/alerts', labelKey: 'alerts', icon: IconBell, ready: true },
  { href: '/catalog', labelKey: 'catalog', icon: IconTag, ready: false },
  { href: '/radar', labelKey: 'radar', icon: IconRadar, ready: false },
];

const ACCOUNT: Item[] = [
  { href: '/settings', labelKey: 'settings', icon: IconSettings, ready: true },
];

function NavLink({ item, active }: { item: Item; active: boolean }) {
  const t = useTranslations('nav');
  const Icon = item.icon;
  const content = (
    <>
      <Icon className="size-[18px] shrink-0" />
      <span className="flex-1">{t(item.labelKey)}</span>
      {!item.ready ? (
        <span className="rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-fg-subtle">
          pronto
        </span>
      ) : null}
    </>
  );

  const cls = cn(
    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
    active ? 'bg-brand-soft text-brand-strong' : 'text-fg-muted hover:bg-surface-muted hover:text-fg',
    !item.ready && 'cursor-not-allowed opacity-60 hover:bg-transparent hover:text-fg-muted',
  );

  if (!item.ready) {
    return (
      <span className={cls} aria-disabled>
        {content}
      </span>
    );
  }
  return (
    <Link href={item.href} className={cls} aria-current={active ? 'page' : undefined}>
      {content}
    </Link>
  );
}

export function Nav() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="flex flex-col gap-6">
      <div className="space-y-1">
        <p className="px-3 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
          {t('sectionMain')}
        </p>
        {MAIN.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} />
        ))}
      </div>
      <div className="space-y-1">
        <p className="px-3 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
          {t('sectionAccount')}
        </p>
        {ACCOUNT.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} />
        ))}
      </div>
    </nav>
  );
}
