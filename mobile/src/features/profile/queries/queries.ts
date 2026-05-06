import { getProfile, type ProfileResponse } from '@/services/api/profile';
import { profileCache } from '@/services/cache/profile';

import { responseToRow, rowToResponse } from './mappers';

/**
 * Profile read with cache fallback. Profile is single-row, so either the
 * network result is the source of truth (write-through) or the cached row
 * is surfaced when offline.
 */
export const profileQuery = (userId: string | null) => ({
  queryKey: ['profile', userId] as const,
  enabled: !!userId,
  queryFn: async (): Promise<ProfileResponse> => {
    if (!userId) {
      throw new Error('profile query called without userId');
    }
    try {
      const resp = await getProfile();
      await profileCache.upsert(responseToRow(resp), { fromServer: true });
      return resp;
    } catch (err) {
      const cached = await profileCache.get(userId);
      if (cached) return rowToResponse(cached);
      throw err;
    }
  },
  staleTime: 60_000,
});
