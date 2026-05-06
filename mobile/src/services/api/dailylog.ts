import { request } from './client';

export type DailyLogResponse = {
  id: string;
  focus: number;
  energy: number;
  forgetfulness: number;
  stress: number;
  sleep_quality: number;
  logged_at: string;
};

export type DailyLogCreate = {
  focus: number;
  energy: number;
  forgetfulness: number;
  stress: number;
  sleep_quality: number;
  logged_at?: string;
};

export type DailyLogList = {
  items: DailyLogResponse[];
  next_cursor?: string;
};

export function createDailyLog(data: DailyLogCreate) {
  return request<DailyLogResponse>({ method: 'POST', url: '/v1/daily-logs', data });
}

export function getTodayLog() {
  return request<DailyLogResponse | null>({ method: 'GET', url: '/v1/daily-logs/today' });
}

export function listDailyLogs(cursor?: string, limit = 20) {
  return request<DailyLogList>({
    method: 'GET',
    url: '/v1/daily-logs',
    params: { cursor, limit },
  });
}
