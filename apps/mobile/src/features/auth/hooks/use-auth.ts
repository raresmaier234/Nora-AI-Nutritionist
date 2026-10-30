import { use } from 'react';

import { AuthContext, AuthContextValue } from '@/features/auth/auth-provider';

/** The session, the profile and the sign-in / sign-out actions. Needs <AuthProvider> above. */
export function useAuth(): AuthContextValue {
  const auth = use(AuthContext);
  if (!auth) throw new Error('useAuth() must be used inside <AuthProvider> (see src/app/_layout.tsx).');
  return auth;
}
