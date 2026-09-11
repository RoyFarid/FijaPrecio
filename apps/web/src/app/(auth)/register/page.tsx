'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { apiFetch, ApiError } from '../../../lib/api';
import { registerFormSchema, type RegisterForm } from '../../../lib/schemas';
import { applyApiIssues } from '../../../lib/form-errors';
import type { AuthResponse } from '../../../lib/types';
import { Field } from '../../../components/ui/field';
import { Button } from '../../../components/ui/button';
import { Callout } from '../../../components/ui/callout';

export default function RegisterPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerFormSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await apiFetch<AuthResponse>('/auth/register', {
        method: 'POST',
        body: values,
        skipRefresh: true,
      });
      router.replace('/dashboard');
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('email', { type: 'server', message: t('emailTaken') });
      } else if (!applyApiIssues(err, setError, ['name', 'organizationName', 'email', 'password'])) {
        setFormError(t('genericError'));
      }
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight">{t('registerTitle')}</h1>
        <p className="mt-1.5 text-[13px] text-fg-muted">{t('registerSubtitle')}</p>
      </div>

      {formError ? <Callout tone="danger">{formError}</Callout> : null}

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field
          label={t('name')}
          autoComplete="name"
          autoFocus
          error={errors.name?.message}
          {...register('name')}
        />
        <Field
          label={t('organizationName')}
          autoComplete="organization"
          error={errors.organizationName?.message}
          {...register('organizationName')}
        />
        <Field
          label={t('email')}
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <Field
          label={t('password')}
          type="password"
          autoComplete="new-password"
          hint={t('passwordHint')}
          error={errors.password?.message}
          {...register('password')}
        />
        <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
          {t('submitRegister')}
        </Button>
      </form>

      <p className="text-center text-[13px] text-fg-muted">
        <Link href="/login" className="font-semibold text-brand-strong hover:underline">
          {t('toLogin')}
        </Link>
      </p>
    </div>
  );
}
