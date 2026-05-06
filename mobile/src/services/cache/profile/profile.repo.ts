import { getDb } from '../db';
import type { ProfileRow, UpsertOptions } from '../types';

export const profileCache = {
  async get(userId: string): Promise<ProfileRow | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<ProfileRow>(
      `SELECT * FROM profile WHERE user_id = ?`,
      [userId],
    );
    return row ?? null;
  },

  async upsert(row: ProfileRow, opts: UpsertOptions): Promise<void> {
    const db = await getDb();
    const dirty = opts.fromServer ? 0 : 1;
    const localUpdatedAt = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO profile (
         user_id, focus_problem, intensity_level, avg_sleep_hours, caffeine_daily,
         onboarding_completed_at, timezone, reminder_hour, reminder_enabled,
         created_at, updated_at, dirty, local_updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id) DO UPDATE SET
         focus_problem = excluded.focus_problem,
         intensity_level = excluded.intensity_level,
         avg_sleep_hours = excluded.avg_sleep_hours,
         caffeine_daily = excluded.caffeine_daily,
         onboarding_completed_at = excluded.onboarding_completed_at,
         timezone = excluded.timezone,
         reminder_hour = excluded.reminder_hour,
         reminder_enabled = excluded.reminder_enabled,
         updated_at = excluded.updated_at,
         dirty = excluded.dirty,
         local_updated_at = excluded.local_updated_at`,
      [
        row.user_id, row.focus_problem, row.intensity_level,
        row.avg_sleep_hours, row.caffeine_daily,
        row.onboarding_completed_at, row.timezone,
        row.reminder_hour, row.reminder_enabled,
        row.created_at, row.updated_at,
        dirty, localUpdatedAt,
      ],
    );
  },

  async markSynced(userId: string, serverUpdatedAt: string): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `UPDATE profile SET dirty = 0, updated_at = ? WHERE user_id = ?`,
      [serverUpdatedAt, userId],
    );
  },

  async isDirty(userId: string): Promise<boolean> {
    const db = await getDb();
    const row = await db.getFirstAsync<{ dirty: number }>(
      `SELECT dirty FROM profile WHERE user_id = ?`,
      [userId],
    );
    return row?.dirty === 1;
  },
};
