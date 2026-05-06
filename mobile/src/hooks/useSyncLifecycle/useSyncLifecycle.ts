import { useEffect } from 'react';
import { AppState } from 'react-native';

import { getDb } from '@/services/cache/db';
import { scheduleCycle } from '@/services/sync/engine';

import { useNetworkStatus } from '../useNetworkStatus';

const PERIODIC_MS = 5 * 60_000;

/**
 * Wires the sync engine into the app lifecycle:
 *  - opens the SQLite cache on first run (idempotent),
 *  - schedules a cycle when `userId` becomes available (login / hydration),
 *  - schedules a cycle when the app returns to foreground,
 *  - schedules a cycle when network status flips back to online,
 *  - keeps a 5-minute periodic sweep while in foreground.
 *
 * Mount it once at the root layout. Without this hook the sync engine
 * exists but never runs.
 */
export function useSyncLifecycle(userId: string | null): void {
  const { online } = useNetworkStatus();

  // Open DB eagerly so the first cache read doesn't block on schema setup.
  useEffect(() => {
    void getDb();
  }, []);

  // Initial cycle when userId becomes available.
  useEffect(() => {
    if (!userId) return;
    scheduleCycle(userId);
  }, [userId]);

  // Foreground / network triggers.
  useEffect(() => {
    if (!userId) return;
    if (!online) return;
    scheduleCycle(userId);

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') scheduleCycle(userId);
    });

    const interval = setInterval(() => {
      if (AppState.currentState === 'active') scheduleCycle(userId);
    }, PERIODIC_MS);

    return () => {
      sub.remove();
      clearInterval(interval);
    };
  }, [userId, online]);
}
