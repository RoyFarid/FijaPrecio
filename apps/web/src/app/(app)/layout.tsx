import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { serverApiFetch } from '../../lib/api-server';
import { ApiError } from '../../lib/api-error';
import { AppShell } from '../../components/app-shell';
import type { SessionUser } from '../../lib/types';

export default async function AppLayout({ children }: { children: ReactNode }) {
  let user: SessionUser;
  try {
    user = await serverApiFetch<SessionUser>('/auth/me');
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
      redirect('/login');
    }
    throw err;
  }

  return <AppShell user={user}>{children}</AppShell>;
}
