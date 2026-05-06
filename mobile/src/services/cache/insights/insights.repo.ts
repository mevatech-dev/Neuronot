import { getDb } from '../db';
import type { InsightRow } from '../types';

export const insightsCache = {
  async listRecent(userId: string, limit = 20): Promise<InsightRow[]> {
    const db = await getDb();
    return db.getAllAsync<InsightRow>(
      `SELECT * FROM insights
       WHERE user_id = ?
       ORDER BY generated_at DESC LIMIT ?`,
      [userId, limit],
    );
  },

  async upsertFromServer(row: InsightRow): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `INSERT INTO insights (
         id, user_id, title, content, language, crisis,
         source_event_ids, generated_at, viewed_at, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         title = excluded.title,
         content = excluded.content,
         language = excluded.language,
         crisis = excluded.crisis,
         source_event_ids = excluded.source_event_ids,
         viewed_at = excluded.viewed_at,
         updated_at = excluded.updated_at`,
      [
        row.id, row.user_id, row.title, row.content, row.language, row.crisis,
        row.source_event_ids, row.generated_at, row.viewed_at,
        row.created_at, row.updated_at,
      ],
    );
  },
};
