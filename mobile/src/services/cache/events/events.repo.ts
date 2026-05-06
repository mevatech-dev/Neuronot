import { getDb } from '../db';
import type { EventRow, UpsertOptions } from '../types';

export const eventsCache = {
  async listRecent(userId: string, limit = 50): Promise<EventRow[]> {
    const db = await getDb();
    return db.getAllAsync<EventRow>(
      `SELECT * FROM events
       WHERE user_id = ? AND deleted_at IS NULL
       ORDER BY occurred_at DESC LIMIT ?`,
      [userId, limit],
    );
  },

  async findById(userId: string, id: string): Promise<EventRow | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<EventRow>(
      `SELECT * FROM events
       WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
      [id, userId],
    );
    return row ?? null;
  },

  async upsert(row: EventRow, opts: UpsertOptions): Promise<void> {
    const db = await getDb();
    const dirty = opts.fromServer ? 0 : 1;
    const localUpdatedAt = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO events (
         id, user_id, type, intensity, note,
         occurred_at, created_at, updated_at, deleted_at,
         dirty, local_updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         type = excluded.type,
         intensity = excluded.intensity,
         note = excluded.note,
         occurred_at = excluded.occurred_at,
         updated_at = excluded.updated_at,
         deleted_at = excluded.deleted_at,
         dirty = excluded.dirty,
         local_updated_at = excluded.local_updated_at`,
      [
        row.id, row.user_id, row.type, row.intensity, row.note,
        row.occurred_at, row.created_at, row.updated_at, row.deleted_at,
        dirty, localUpdatedAt,
      ],
    );
  },

  async markSynced(id: string, serverUpdatedAt: string): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `UPDATE events SET dirty = 0, updated_at = ? WHERE id = ?`,
      [serverUpdatedAt, id],
    );
  },

  async softDelete(userId: string, id: string): Promise<void> {
    const db = await getDb();
    const now = new Date().toISOString();
    await db.runAsync(
      `UPDATE events SET deleted_at = ?, dirty = 1, local_updated_at = ?
       WHERE id = ? AND user_id = ?`,
      [now, now, id, userId],
    );
  },

  async enumerateDirty(userId: string, limit = 100): Promise<EventRow[]> {
    const db = await getDb();
    return db.getAllAsync<EventRow>(
      `SELECT * FROM events WHERE user_id = ? AND dirty = 1
       ORDER BY local_updated_at ASC LIMIT ?`,
      [userId, limit],
    );
  },
};
