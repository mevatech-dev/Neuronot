import { useMutation, useQueryClient } from '@tanstack/react-query';

import { generateInsight, type InsightResponse } from '@/services/api/insights';
import { scheduleCycleForCurrentUser } from '@/services/sync/engine';

type Hooks = {
  onSuccess?: (data: InsightResponse) => void;
  onError?: (err: unknown) => void;
};

/**
 * Insights are server-generated. The only client-side write is `generate`,
 * which produces a new insight row. Invalidate the list query and ping the
 * sync engine so the cached mirror picks the new row up.
 */
export function useGenerateInsight(language: string, hooks: Hooks = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => generateInsight(language),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ['insights'] });
      scheduleCycleForCurrentUser();
      hooks.onSuccess?.(data);
    },
    onError: hooks.onError,
  });
}
