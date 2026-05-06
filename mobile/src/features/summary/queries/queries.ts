import { getWeeklySummary } from '@/services/api/summary';

/**
 * TanStack Query options for the weekly summary card. The query key is
 * stable so any push/pull cycle that updates daily logs can invalidate
 * `['summary', 'weekly']` and trigger a re-fetch.
 */
export const weeklySummaryQuery = {
  queryKey: ['summary', 'weekly'] as const,
  queryFn: getWeeklySummary,
  staleTime: 5 * 60_000,
};
