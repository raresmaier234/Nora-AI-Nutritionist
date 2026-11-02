import { apiRequest } from './client';
import type { UserProfile, UserProfileUpdate } from './types';

const ME = '/users/me';

/** The signed-in user's profile: name, email, avatar, plan, daily targets and how they're set. */
export function getMe(): Promise<UserProfile> {
  return apiRequest<UserProfile>(ME, { method: 'GET' });
}

/**
 * Change the display name and/or the time zone; resolves with the updated profile. Targets can't
 * be changed here — only by building a nutrition plan.
 */
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
