import type { MembershipRole } from '@fijaprecio/db';

/** Identidad resuelta por JwtAuthGuard y adjuntada a `request.auth`. */
export interface RequestAuth {
  userId: string;
  organizationId: string;
  role: MembershipRole;
}

declare module 'express' {
  interface Request {
    auth?: RequestAuth;
  }
}
