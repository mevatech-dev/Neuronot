import { useAuthStore } from '@/store/auth';
import { useSyncStore } from '@/store/sync';

import { pullDelta } from '../pull';
import { pushDirty } from '../push';
import type { SyncCycleOptions, SyncCycleResult } from '../types';

let running = false;

/**
 * Runs one push → pull cycle for the given user. Mutex'd so concurrent
 * triggers (foreground + mutation flush + network online) collapse into one.
 */
export async function runCycle(userId: string, opts: SyncCycleOptions = {}): Promise<SyncCycleResult> {
  const startedAt = new Date().toISOString();
  if (running) {
    return { pushed: 0, pulled: 0, conflicts: 0, startedAt, finishedAt: startedAt };
  }
  running = true;
  useSyncStore.getState().setSyncing(true);

  let pushed = 0;
  let conflicts = 0;
  let pulled = 0;
  let errorMessage: string | undefined;

  try {
    if (opts.push !== false) {
      const out = await pushDirty(userId);
      pushed = out.pushed;
      conflicts = out.conflicts;
    }
    pulled = await pullDelta(userId);
    useSyncStore.getState().setLastSyncAt(new Date().toISOString());
    useSyncStore.getState().setLastError(null);
  } catch (e) {
    errorMessage = e instanceof Error ? e.message : 'unknown';
    useSyncStore.getState().setLastError(errorMessage);
  } finally {
    running = false;
    useSyncStore.getState().setSyncing(false);
  }

  return {
    pushed,
    pulled,
    conflicts,
    startedAt,
    finishedAt: new Date().toISOString(),
    error: errorMessage,
  };
}

/**
 * Fire-and-forget trigger — used by feature `queries.ts` after a SQLite read.
 * Drops the call if a cycle is already running.
 */
export function scheduleCycle(userId: string, opts?: SyncCycleOptions): void {
  void runCycle(userId, opts);
}

/**
 * Convenience for mutation handlers: pulls userId from the auth store and
 * schedules a cycle. No-op when logged out.
 */
export function scheduleCycleForCurrentUser(opts?: SyncCycleOptions): void {
  const id = useAuthStore.getState().user?.id;
  if (id) scheduleCycle(id, opts);
}
