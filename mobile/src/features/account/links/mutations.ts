import { useMutation, useQueryClient } from '@tanstack/react-query';

import { linkApple, linkGoogle, unlinkProvider } from '@/services/api/auth';

type Options = {
  onSuccess?: () => void;
  onError?: (e: unknown) => void;
};

export function useLinkApple(opts: Options = {}) {
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

export function useLinkGoogle(opts: Options = {}) {
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

export function useUnlinkProvider(opts: Options = {}) {
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
