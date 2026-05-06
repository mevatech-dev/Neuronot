import { dailyLogCache } from '@/services/cache/dailyLog';
import { readSyncState, writeSyncState } from '@/services/cache/db';
import { eventsCache } from '@/services/cache/events';
import { insightsCache } from '@/services/cache/insights';
import { profileCache } from '@/services/cache/profile';
import { pullSync } from '@/services/api/sync';

const SYNC_STATE_KEY = 'lastSyncAt';

/**
 * Pulls server-side updates since the locally-stored `lastSyncAt` timestamp,
 * applies them to the cache, and advances the cursor to the server's
 * authoritative `server_time`.
 *
 * Returns the number of rows applied so the engine can decide whether
 * downstream queries should invalidate.
 */
export async function pullDelta(userId: string): Promise<number> {
  const since = (await readSyncState(SYNC_STATE_KEY)) ?? undefined;
  const resp = await pullSync(since);

  // 1) daily logs
  for (const r of resp.daily_logs) {
    await dailyLogCache.upsert(
      {
        id: r.id,
        user_id: userId,
        focus: r.focus,
        energy: r.energy,
        forgetfulness: r.forgetfulness,
        stress: r.stress,
        sleep_quality: r.sleep_quality,
        logged_at: r.logged_at as unknown as string,
        created_at: r.updated_at as unknown as string,
        updated_at: r.updated_at as unknown as string,
        deleted_at: null,
        dirty: 0,
        local_updated_at: new Date().toISOString(),
      },
      { fromServer: true },
    );
  }

  // 2) events
  for (const r of resp.events) {
    await eventsCache.upsert(
      {
        id: r.id,
        user_id: userId,
        type: r.type,
        intensity: r.intensity,
        note: r.note ?? null,
        occurred_at: r.occurred_at as unknown as string,
        created_at: r.updated_at as unknown as string,
        updated_at: r.updated_at as unknown as string,
        deleted_at: null,
        dirty: 0,
        local_updated_at: new Date().toISOString(),
      },
      { fromServer: true },
    );
  }

  // 3) insights
  for (const r of resp.insights) {
    if (!r.id || !r.generated_at) continue;
    await insightsCache.upsertFromServer({
      id: r.id,
      user_id: userId,
      title: r.title,
      content: r.content,
      language: r.language,
      crisis: r.crisis ? 1 : 0,
      source_event_ids: '[]',
      generated_at: r.generated_at as unknown as string,
      viewed_at: (r.viewed_at as unknown as string) ?? null,
      created_at: r.generated_at as unknown as string,
      updated_at: r.generated_at as unknown as string,
    });
  }

  // 4) profile (single row)
  if (resp.profile) {
    const p = resp.profile;
    await profileCache.upsert(
      {
        user_id: p.user_id,
        focus_problem: p.focus_problem ?? null,
        intensity_level: p.intensity_level ?? null,
        avg_sleep_hours: p.avg_sleep_hours ?? null,
        caffeine_daily: p.caffeine_daily == null ? null : p.caffeine_daily ? 1 : 0,
        onboarding_completed_at: (p.onboarding_completed_at as unknown as string) ?? null,
        timezone: p.timezone,
        reminder_hour: p.reminder_hour ?? null,
        reminder_enabled: p.reminder_enabled ? 1 : 0,
        created_at: p.updated_at as unknown as string,
        updated_at: p.updated_at as unknown as string,
        dirty: 0,
        local_updated_at: new Date().toISOString(),
      },
      { fromServer: true },
    );
  }

  // 5) Soft-delete mirror
  for (const id of resp.deletes['daily_logs'] ?? []) {
    await dailyLogCache.softDelete(userId, id);
    await dailyLogCache.markSynced(id, resp.server_time);
  }
  for (const id of resp.deletes['events'] ?? []) {
    await eventsCache.softDelete(userId, id);
    await eventsCache.markSynced(id, resp.server_time);
  }

  await writeSyncState(SYNC_STATE_KEY, resp.server_time);

  return (
    resp.daily_logs.length +
    resp.events.length +
    resp.insights.length +
    (resp.profile ? 1 : 0)
  );
}
