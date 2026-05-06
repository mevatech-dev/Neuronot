import { request } from '../client';

export type DayBucket = {
  date: string;
  focus: number | null;
  energy: number | null;
  sleep_quality: number | null;
};

export type WeeklySummaryResponse = {
  focus_avg: number;
  energy_avg: number;
  stress_avg: number;
  forgetfulness_avg: number;
  sleep_avg: number;
  log_count: number;
  day_buckets: DayBucket[];
  event_counts: Record<string, number>;
  window_start: string;
  window_end: string;
};

export function getWeeklySummary() {
  return request<WeeklySummaryResponse>({ method: 'GET', url: '/v1/summary/weekly' });
}
