import { apiRequest } from './client';
import type { UserProfile, UserProfileUpdate } from './types';

const ME = '/users/me';

/** The signed-in user's profile: name, email, avatar, plan and daily targets. */
export function getMe(): Promise<UserProfile> {
  return apiRequest<UserProfile>(ME, { method: 'GET' });
}

/** Change the display name and/or any of the daily targets; resolves with the updated profile. */
export function updateMe(body: UserProfileUpdate): Promise<UserProfile> {
  return apiRequest<UserProfile>(ME, { method: 'PATCH', body });
}

/**
 * Delete the account: the profile, the whole food log and the Supabase sign-in. Rejects (502 /
 * 503) if the sign-in couldn't be deleted, in which case the account still exists.
 */
export function deleteMe(): Promise<void> {
  // The API also calls Supabase's Admin API, so allow it longer than the default.
  return apiRequest<void>(ME, { method: 'DELETE', timeoutMs: 20_000 });
}
