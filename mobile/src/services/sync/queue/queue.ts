import { dailyLogCache } from '@/services/cache/dailyLog';
import { eventsCache } from '@/services/cache/events';
import { profileCache } from '@/services/cache/profile';
import type { PushOperation } from '@/services/api/sync';

const PER_TABLE_LIMIT = 50;

/**
 * Reads dirty rows from each cache repo and shapes them as the wire push
 * operations the server expects. Insights are server-only — never queued.
 */
export async function collectDirtyOps(userId: string): Promise<PushOperation[]> {
  const ops: PushOperation[] = [];

  const dailyLogs = await dailyLogCache.enumerateDirty(userId, PER_TABLE_LIMIT);
  for (const r of dailyLogs) {
    if (r.deleted_at) {
      ops.push({
        table: 'daily_logs',
        op: 'delete',
        id: r.id,
        updated_at: r.local_updated_at,
      });
      continue;
    }
    ops.push({
      table: 'daily_logs',
      op: 'upsert',
      id: r.id,
      updated_at: r.local_updated_at,
      row: {
        focus: r.focus,
        energy: r.energy,
        forgetfulness: r.forgetfulness,
        stress: r.stress,
        sleep_quality: r.sleep_quality,
      },
    });
  }

  const events = await eventsCache.enumerateDirty(userId, PER_TABLE_LIMIT);
  for (const r of events) {
    if (r.deleted_at) {
      ops.push({
        table: 'events',
        op: 'delete',
        id: r.id,
        updated_at: r.local_updated_at,
      });
      continue;
    }
    ops.push({
      table: 'events',
      op: 'upsert',
      id: r.id,
      updated_at: r.local_updated_at,
      row: {
        type: r.type,
        intensity: r.intensity,
        note: r.note,
        occurred_at: r.occurred_at,
      },
    });
  }

  if (await profileCache.isDirty(userId)) {
    const p = await profileCache.get(userId);
    if (p) {
      ops.push({
        table: 'profile',
        op: 'upsert',
        id: p.user_id,
        updated_at: p.local_updated_at,
        row: {
          focus_problem: p.focus_problem,
          intensity_level: p.intensity_level,
          avg_sleep_hours: p.avg_sleep_hours,
          caffeine_daily: p.caffeine_daily == null ? null : p.caffeine_daily === 1,
          timezone: p.timezone,
          reminder_hour: p.reminder_hour,
          reminder_enabled: p.reminder_enabled === 1,
        },
      });
    }
  }

  return ops;
}
