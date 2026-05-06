import {
  getInsights,
  type InsightListResponse,
} from '@/services/api/insights';
import { getTrend, type TrendMetric } from '@/services/api/stats';
import { insightsCache } from '@/services/cache/insights';

import { responseToRow, rowToResponse } from './mappers';

/**
 * Read-with-fallback for the insights list: hit the network, write each
 * row through to SQLite, return the wire response. On network failure,
 * surface the cached set so the screen renders even offline.
 */
export const insightsListQuery = (userId: string | null) => ({
  queryKey: ['insights', userId] as const,
  enabled: !!userId,
  queryFn: async (): Promise<InsightListResponse> => {
    if (!userId) return { items: [] };
    try {
      const resp = await getInsights(20);
      for (const item of resp.items) {
        const row = responseToRow(userId, item);
        if (row) await insightsCache.upsertFromServer(row);
      }
      return resp;
    } catch (err) {
      const cached = await insightsCache.listRecent(userId, 20);
      if (cached.length > 0) {
        return { items: cached.map(rowToResponse) };
      }
      throw err;
    }
  },
});

/**
 * Stats trend is server-derived (aggregates over daily_logs). No client
 * cache mirror — on offline we surface the network error and let the
 * chart fall back to its empty state.
 */
export const trendQuery = (metric: TrendMetric, days: number) => ({
  queryKey: ['stats', 'trend', metric, days] as const,
  queryFn: () => getTrend(metric, days),
  staleTime: 5 * 60_000,
});
