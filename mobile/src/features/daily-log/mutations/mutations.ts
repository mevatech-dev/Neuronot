import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  createDailyLog,
  type DailyLogResponse,
  type DailyLogCreate,
  type DailyLogUpdate,
  updateDailyLog,
} from '@/services/api/dailylog';
import { scheduleCycleForCurrentUser } from '@/services/sync/engine';

type Hooks = {
  onSuccess?: (data: DailyLogResponse) => void;
  onError?: (err: unknown) => void;
};

/**
 * Centralized cache invalidation + sync trigger for daily-log writes. Every
 * mutation that touches a daily_log invalidates the same downstream slots
 * (today, timeline, weekly summary) and pings the sync engine. Components
 * keep only UI feedback (toast, sheet close, haptic).
 */
function invalidateDailyLogReads(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['daily-log', 'today'] });
  void qc.invalidateQueries({ queryKey: ['daily-log', 'list'] });
  void qc.invalidateQueries({ queryKey: ['timeline'] });
  void qc.invalidateQueries({ queryKey: ['summary', 'weekly'] });
}

export function useCreateDailyLog(hooks: Hooks = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: DailyLogCreate) => createDailyLog(data),
    onSuccess: (data) => {
      invalidateDailyLogReads(qc);
      scheduleCycleForCurrentUser();
      hooks.onSuccess?.(data);
    },
    onError: hooks.onError,
  });
}

export function useUpdateDailyLog(hooks: Hooks = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { id: string; patch: DailyLogUpdate }) =>
      updateDailyLog(params.id, params.patch),
    onSuccess: (data) => {
      invalidateDailyLogReads(qc);
      scheduleCycleForCurrentUser();
      hooks.onSuccess?.(data);
    },
    onError: hooks.onError,
  });
}
