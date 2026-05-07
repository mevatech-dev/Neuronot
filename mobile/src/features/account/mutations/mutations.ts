import { useMutation, useQueryClient } from '@tanstack/react-query';

import { changePassword, deleteAccount } from '@/services/api/account';

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
