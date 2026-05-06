import { getInsights } from '@/services/api/insights';
import { getTrend, type TrendMetric } from '@/services/api/stats';

export const insightsListQuery = {
  queryKey: ['insights'] as const,
  queryFn: () => getInsights(20),
};

export const trendQuery = (metric: TrendMetric, days: number) => ({
  queryKey: ['stats', 'trend', metric, days] as const,
  queryFn: () => getTrend(metric, days),
  staleTime: 5 * 60_000,
});
