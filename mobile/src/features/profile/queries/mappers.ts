import type { ProfileResponse } from '@/services/api/profile';
import type { ProfileRow } from '@/services/cache/types';

export function rowToResponse(row: ProfileRow): ProfileResponse {
  return {
    user_id: row.user_id,
    focus_problem: row.focus_problem,
    intensity_level: row.intensity_level,
    avg_sleep_hours: row.avg_sleep_hours,
    caffeine_daily: row.caffeine_daily == null ? null : row.caffeine_daily === 1,
    onboarding_completed_at: row.onboarding_completed_at,
    timezone: row.timezone,
    reminder_hour: row.reminder_hour,
    reminder_enabled: row.reminder_enabled === 1,
    updated_at: row.updated_at,
  };
}

export function responseToRow(resp: ProfileResponse): ProfileRow {
  const now = new Date().toISOString();
  return {
    user_id: resp.user_id,
    focus_problem: resp.focus_problem,
    intensity_level: resp.intensity_level,
    avg_sleep_hours: resp.avg_sleep_hours,
    caffeine_daily: resp.caffeine_daily == null ? null : resp.caffeine_daily ? 1 : 0,
    onboarding_completed_at: resp.onboarding_completed_at,
    timezone: resp.timezone,
    reminder_hour: resp.reminder_hour,
    reminder_enabled: resp.reminder_enabled ? 1 : 0,
    created_at: resp.updated_at,
    updated_at: resp.updated_at,
    dirty: 0,
    local_updated_at: now,
  };
}
