import { useMutation, useQueryClient } from '@tanstack/react-query';

import { grantConsent, revokeConsent } from '@/services/api/consents';
import type { ConsentType } from '../types';

type Options = { onSuccess?: () => void; onError?: (e: unknown) => void };

export function useGrantConsent(opts: Options = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (type: ConsentType) => grantConsent(type),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['consents'] });
      opts.onSuccess?.();
    },
    onError: opts.onError,
  });
}

export function useRevokeConsent(opts: Options = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (type: ConsentType) => revokeConsent(type),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['consents'] });
      opts.onSuccess?.();
    },
    onError: opts.onError,
  });
}
