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
      // no a /login directo: si `fp_at` venció pero sigue en el navegador, la
      // middleware la ve "con sesión" y rebota /login -> /dashboard -> /login...
      // /api/logout limpia la cookie (Server Component no puede) y recién ahí manda a /login.
      redirect('/api/logout');
    }
    throw err;
  }

  return <AppShell user={user}>{children}</AppShell>;
}
