import { NextResponse, type NextRequest } from 'next/server';

const ACCESS_COOKIE = 'fp_at';
const AUTH_PAGES = ['/login', '/register'];

/**
 * Portón rápido de sesión (sin validar el JWT — eso lo hace la API).
 *  - Ruta protegida sin cookie de acceso → /login (con `next` para volver).
 *  - Página de auth con cookie → /dashboard.
 * La verificación real y el refresh ocurren en el layout de `(app)` y el cliente.
 */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const hasSession = req.cookies.has(ACCESS_COOKIE);
  const isAuthPage = AUTH_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (isAuthPage) {
    if (hasSession) return NextResponse.redirect(new URL('/dashboard', req.url));
    return NextResponse.next();
  }

  if (!hasSession) {
    const url = new URL('/login', req.url);
    if (pathname !== '/') url.searchParams.set('next', pathname + search);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Todo salvo estáticos, la API interna de Next, el healthcheck y /api/logout
  // (esa ruta limpia la cookie de sesión vencida — si la interceptáramos acá
  // con `hasSession`, sería el mismo loop que existe para resolver).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/health|api/logout).*)'],
};
