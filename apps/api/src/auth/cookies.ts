import type { CookieOptions, Response } from 'express';
import { env } from '../config/env.js';

export const ACCESS_COOKIE = 'fp_at';
export const REFRESH_COOKIE = 'fp_rt';

/** La cookie de refresh solo viaja al endpoint que la necesita. */
const REFRESH_PATH = '/v1/auth';

function baseOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV !== 'development',
    sameSite: 'lax',
    domain: env.AUTH_COOKIE_DOMAIN,
  };
}

export function setSessionCookies(
  res: Response,
  args: { accessToken: string; refreshToken: string; refreshExpiresAt: Date },
): void {
  res.cookie(ACCESS_COOKIE, args.accessToken, { ...baseOptions(), path: '/' });
  res.cookie(REFRESH_COOKIE, args.refreshToken, {
    ...baseOptions(),
    path: REFRESH_PATH,
    expires: args.refreshExpiresAt,
  });
}

export function clearSessionCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, { ...baseOptions(), path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...baseOptions(), path: REFRESH_PATH });
}
