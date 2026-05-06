import { useMutation, useQueryClient } from '@tanstack/react-query';

import { patchProfile, type ProfilePatch, type ProfileResponse } from '@/services/api/profile';
import { scheduleCycleForCurrentUser } from '@/services/sync/engine';

type Hooks = {
  onSuccess?: (data: ProfileResponse) => void;
  onError?: (err: unknown) => void;
};

export function usePatchProfile(hooks: Hooks = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: ProfilePatch) => patchProfile(patch),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ['profile'] });
      scheduleCycleForCurrentUser();
      hooks.onSuccess?.(data);
    },
    onError: hooks.onError,
  });
}
