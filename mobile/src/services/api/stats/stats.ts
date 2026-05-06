import { request } from '../client';

export type TrendMetric =
  | 'focus'
  | 'energy'
  | 'stress'
  | 'forgetfulness'
  | 'sleep_quality';

export type TrendPoint = {
  date: string;
  value: number | null;
};

export type TrendResponse = {
  metric: TrendMetric;
  days: number;
  points: TrendPoint[];
};

export function getTrend(metric: TrendMetric, days = 30) {
  return request<TrendResponse>({
    method: 'GET',
    url: '/v1/stats/trend',
    params: { metric, days },
  });
}
