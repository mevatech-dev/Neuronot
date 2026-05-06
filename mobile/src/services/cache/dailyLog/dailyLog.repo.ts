import { getDb } from '../db';
import type { DailyLogRow, UpsertOptions } from '../types';

export const dailyLogCache = {
  async findToday(userId: string): Promise<DailyLogRow | null> {
    const db = await getDb();
    // SQLite has no DATE in TZ helper — we compare YYYY-MM-DD strings derived
    // from the ISO timestamp. logged_at is always stored UTC ISO 8601.
    const today = new Date().toISOString().slice(0, 10);
    const row = await db.getFirstAsync<DailyLogRow>(
      `SELECT * FROM daily_logs
       WHERE user_id = ? AND deleted_at IS NULL
         AND substr(logged_at, 1, 10) = ?
       ORDER BY logged_at DESC LIMIT 1`,
      [userId, today],
    );
    return row ?? null;
  },

  async findById(userId: string, id: string): Promise<DailyLogRow | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<DailyLogRow>(
      `SELECT * FROM daily_logs
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      [id, userId],
    );
    return row ?? null;
  },

  async listRecent(userId: string, limit = 30): Promise<DailyLogRow[]> {
    const db = await getDb();
    return db.getAllAsync<DailyLogRow>(
      `SELECT * FROM daily_logs
       WHERE user_id = ? AND deleted_at IS NULL
       ORDER BY logged_at DESC
       LIMIT ?`,
      [userId, limit],
    );
  },

  async upsert(row: DailyLogRow, opts: UpsertOptions): Promise<void> {
    const db = await getDb();
    const dirty = opts.fromServer ? 0 : 1;
    const localUpdatedAt = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO daily_logs (
         id, user_id, focus, energy, forgetfulness, stress, sleep_quality,
         logged_at, created_at, updated_at, deleted_at,
         dirty, local_updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         focus = excluded.focus,
         energy = excluded.energy,
         forgetfulness = excluded.forgetfulness,
         stress = excluded.stress,
         sleep_quality = excluded.sleep_quality,
         logged_at = excluded.logged_at,
         updated_at = excluded.updated_at,
         deleted_at = excluded.deleted_at,
         dirty = excluded.dirty,
         local_updated_at = excluded.local_updated_at`,
      [
        row.id, row.user_id, row.focus, row.energy, row.forgetfulness,
        row.stress, row.sleep_quality, row.logged_at, row.created_at,
        row.updated_at, row.deleted_at,
        dirty, localUpdatedAt,
      ],
    );
  },

  async markSynced(id: string, serverUpdatedAt: string): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `UPDATE daily_logs SET dirty = 0, updated_at = ? WHERE id = ?`,
      [serverUpdatedAt, id],
    );
  },

  async softDelete(userId: string, id: string): Promise<void> {
    const db = await getDb();
    const now = new Date().toISOString();
    await db.runAsync(
      `UPDATE daily_logs SET deleted_at = ?, dirty = 1, local_updated_at = ?
       WHERE id = ? AND user_id = ?`,
      [now, now, id, userId],
    );
  },

  async enumerateDirty(userId: string, limit = 100): Promise<DailyLogRow[]> {
    const db = await getDb();
    return db.getAllAsync<DailyLogRow>(
      `SELECT * FROM daily_logs WHERE user_id = ? AND dirty = 1
       ORDER BY local_updated_at ASC LIMIT ?`,
      [userId, limit],
    );
  },
};
