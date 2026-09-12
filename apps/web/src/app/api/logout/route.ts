import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { clientEnv, serverEnv } from '../../../env';

/**
 * Rompe el loop de redirects que se da cuando el `fp_at` expiró (15 min) pero
 * el navegador todavía trae la cookie: la middleware ve "hay sesión" → te
 * manda a /dashboard; el layout de (app) pide /auth/me, la API responde 401 →
 * te manda a /login → la middleware te vuelve a mandar a /dashboard...
 *
 * Un Server Component NO puede borrar cookies al renderizar (Next lo prohíbe);
 * un Route Handler sí. Por eso el layout redirige acá en vez de a /login
 * directo. Revoca el refresh token en la API (best-effort) y limpia las
 * cookies de sesión antes de mandar a /login — ahí la middleware ya no ve
 * sesión y no hay vuelta atrás.
 *
 * Excluida del matcher de middleware.ts — si no, esta misma ruta caería en el
 * mismo loop.
 */
export async function GET(req: Request): Promise<NextResponse> {
  const jar = await cookies();
  const cookieHeader = jar
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');

  const base = (serverEnv.API_INTERNAL_URL ?? clientEnv.NEXT_PUBLIC_API_URL).replace(/\/$/, '');
  try {
    await fetch(`${base}/v1/auth/logout`, {
      method: 'POST',
      headers: cookieHeader ? { cookie: cookieHeader } : {},
    });
  } catch {
    // best-effort: si la API no responde, igual limpiamos las cookies del navegador.
  }

  const res = NextResponse.redirect(new URL('/login', req.url));
  res.cookies.delete({ name: 'fp_at', path: '/' });
  res.cookies.delete({ name: 'fp_rt', path: '/v1/auth' });
  return res;
}
