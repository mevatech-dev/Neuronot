import { getTodayLog, type DailyLogResponse } from '@/services/api/dailylog';
import { dailyLogCache } from '@/services/cache/dailyLog';

import { responseToRow, rowToResponse } from './mappers';

/**
 * Read-with-fallback pattern: try the network first, write the response
 * through to SQLite, return it. If the network fails (offline, timeout),
 * surface the most recent cached row so the UI keeps working.
 *
 * The query key includes userId so a logout/login pair invalidates the slot.
 */
export const todayLogQuery = (userId: string | null) => ({
  queryKey: ['daily-log', 'today', userId] as const,
  enabled: !!userId,
  queryFn: async (): Promise<DailyLogResponse | null> => {
    if (!userId) return null;
    try {
      const resp = await getTodayLog();
      if (resp) {
        await dailyLogCache.upsert(responseToRow(userId, resp), { fromServer: true });
      }
      return resp;
    } catch (err) {
      const cached = await dailyLogCache.findToday(userId);
      if (cached) return rowToResponse(cached);
      throw err;
    }
  },
});
