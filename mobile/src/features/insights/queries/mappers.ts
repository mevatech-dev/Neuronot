import type { InsightResponse } from '@/services/api/insights';
import type { InsightRow } from '@/services/cache/types';

export function rowToResponse(row: InsightRow): InsightResponse {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    language: row.language,
    crisis: row.crisis === 1,
    generated_at: row.generated_at,
    viewed_at: row.viewed_at,
  };
}

export function responseToRow(userId: string, resp: InsightResponse): InsightRow | null {
  if (!resp.id || !resp.generated_at) return null;
  return {
    id: resp.id,
    user_id: userId,
    title: resp.title,
    content: resp.content,
    language: resp.language,
    crisis: resp.crisis ? 1 : 0,
    source_event_ids: '[]',
    generated_at: resp.generated_at,
    viewed_at: resp.viewed_at ?? null,
    created_at: resp.generated_at,
    updated_at: resp.generated_at,
  };
}
