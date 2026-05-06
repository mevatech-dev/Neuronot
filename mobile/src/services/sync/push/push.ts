import { dailyLogCache } from '@/services/cache/dailyLog';
import { eventsCache } from '@/services/cache/events';
import { profileCache } from '@/services/cache/profile';
import { pushSync } from '@/services/api/sync';

import { collectDirtyOps } from '../queue';

export type PushOutcome = {
  pushed: number;
  conflicts: number;
};

/**
 * Reads dirty rows, sends them to the server, and reconciles each accepted
 * row by clearing its dirty flag. Conflicts surface back to the engine so
 * the caller can decide UX (Toast, log, retry).
 */
export async function pushDirty(userId: string): Promise<PushOutcome> {
  const ops = await collectDirtyOps(userId);
  if (ops.length === 0) return { pushed: 0, conflicts: 0 };

  const resp = await pushSync(ops);

  for (const a of resp.accepted) {
    switch (a.table) {
      case 'daily_logs':
        await dailyLogCache.markSynced(a.id, a.server_updated_at);
        break;
      case 'events':
        await eventsCache.markSynced(a.id, a.server_updated_at);
        break;
      case 'profile':
        await profileCache.markSynced(a.id, a.server_updated_at);
        break;
    }
  }

  return { pushed: resp.accepted.length, conflicts: resp.conflicts.length };
}
