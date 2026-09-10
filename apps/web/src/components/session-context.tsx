'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { SessionUser } from '../lib/types';

const SessionContext = createContext<SessionUser | null>(null);

export function SessionProvider({ user, children }: { user: SessionUser; children: ReactNode }) {
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}

/** Usuario de la sesión activa (proviene del layout `(app)`, ya verificado). */
export function useCurrentUser(): SessionUser {
  const user = useContext(SessionContext);
  if (!user) throw new Error('useCurrentUser() fuera de <SessionProvider>');
  return user;
}
