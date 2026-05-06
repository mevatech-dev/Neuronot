import type { DailyLogResponse } from '@/services/api/dailylog';
import type { DailyLogRow } from '@/services/cache/types';

export function rowToResponse(row: DailyLogRow): DailyLogResponse {
  return {
    id: row.id,
    focus: row.focus,
    energy: row.energy,
    forgetfulness: row.forgetfulness,
    stress: row.stress,
    sleep_quality: row.sleep_quality,
    logged_at: row.logged_at,
    updated_at: row.updated_at,
  };
}

export function responseToRow(userId: string, resp: DailyLogResponse): DailyLogRow {
  const now = new Date().toISOString();
  return {
    id: resp.id,
    user_id: userId,
    focus: resp.focus,
    energy: resp.energy,
    forgetfulness: resp.forgetfulness,
    stress: resp.stress,
    sleep_quality: resp.sleep_quality,
    logged_at: resp.logged_at,
    created_at: resp.updated_at,
    updated_at: resp.updated_at,
    deleted_at: null,
    dirty: 0,
    local_updated_at: now,
  };
}
