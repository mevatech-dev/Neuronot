import { useMutation, useQueryClient } from '@tanstack/react-query';

import { changePassword, deleteAccount } from '@/services/api/account';
import { linkApple, linkGoogle, unlinkProvider } from '@/services/api/auth';

type ChangePasswordVars = {
  currentPassword: string;
  newPassword: string;
};

type MutationOpts = {
  onSuccess?: () => void;
  onError?: (e: unknown) => void;
};

export function useChangePassword(opts: MutationOpts = {}) {
  return useMutation({
    mutationFn: ({ currentPassword, newPassword }: ChangePasswordVars) =>
      changePassword(currentPassword, newPassword),
    onSuccess: opts.onSuccess,
    onError: opts.onError,
  });
}

export function useDeleteAccount(opts: MutationOpts = {}) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (confirmEmail: string) => deleteAccount(confirmEmail),
    onSuccess: () => {
      qc.clear();
      opts.onSuccess?.();
    },
    onError: opts.onError,
  });
}

// Linked-provider mutations. After every link/unlink we invalidate
// ['auth','links'] so the LinkedProvidersList re-fetches its summary
// instead of showing stale connect/disconnect state.
export function useLinkApple(opts: MutationOpts = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ identityToken, rawNonce }: { identityToken: string; rawNonce: string }) =>
      linkApple(identityToken, rawNonce),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['auth', 'links'] });
      opts.onSuccess?.();
    },
    onError: opts.onError,
  });
}

export function useLinkGoogle(opts: MutationOpts = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (idToken: string) => linkGoogle(idToken),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['auth', 'links'] });
      opts.onSuccess?.();
    },
    onError: opts.onError,
  });
}

export function useUnlinkProvider(opts: MutationOpts = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (provider: 'apple' | 'google') => unlinkProvider(provider),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['auth', 'links'] });
      opts.onSuccess?.();
    },
    onError: opts.onError,
  });
}
