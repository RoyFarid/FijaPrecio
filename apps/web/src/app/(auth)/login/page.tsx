'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { apiFetch, ApiError } from '../../../lib/api';
import { loginFormSchema, type LoginForm } from '../../../lib/schemas';
import { applyApiIssues, safeNextPath } from '../../../lib/form-errors';
import type { AuthResponse } from '../../../lib/types';
import { Field } from '../../../components/ui/field';
import { Button } from '../../../components/ui/button';
import { Callout } from '../../../components/ui/callout';

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const t = useTranslations('auth');
  const router = useRouter();
  const params = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginFormSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await apiFetch<AuthResponse>('/auth/login', {
        method: 'POST',
        body: values,
        skipRefresh: true,
      });
      router.replace(safeNextPath(params.get('next')));
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setFormError(t('invalidCredentials'));
      } else if (!applyApiIssues(err, setError, ['email', 'password'])) {
        setFormError(t('genericError'));
      }
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight">{t('loginTitle')}</h1>
        <p className="mt-1.5 text-[13px] text-fg-muted">{t('loginSubtitle')}</p>
      </div>

      {formError ? <Callout tone="danger">{formError}</Callout> : null}

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field
          label={t('email')}
          type="email"
          autoComplete="email"
          autoFocus
          error={errors.email?.message}
          {...register('email')}
        />
        <Field
          label={t('password')}
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
          {t('submitLogin')}
        </Button>
      </form>

      <p className="text-center text-[13px] text-fg-muted">
        <Link href="/register" className="font-semibold text-brand-strong hover:underline">
          {t('toRegister')}
        </Link>
      </p>
    </div>
  );
}
