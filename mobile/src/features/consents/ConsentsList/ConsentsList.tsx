import { useQuery } from '@tanstack/react-query';
import { View } from 'react-native';

import { ErrorState } from '@/components/feedback/ErrorState';
import { Skeleton } from '@/components/feedback/Skeleton';
import { useToast } from '@/components/feedback/Toast';
import { useAuthStore } from '@/store/auth';
import { useTheme } from '@/theme';

import { ConsentRow } from '../ConsentRow';
import { useRevokeConsent } from '../mutations';
import { consentsQuery } from '../queries';

export function ConsentsList() {
  const theme = useTheme();
  const toast = useToast();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const q = useQuery(consentsQuery(userId));
  const revoke = useRevokeConsent({
    onError: () => toast.show({ messageKey: 'errors.generic.network', tone: 'danger' }),
  });

  if (q.isLoading) {
    return (
      <View style={{ gap: theme.space[3] }}>
        <Skeleton height={88} />
        <Skeleton height={88} />
        <Skeleton height={88} />
      </View>
    );
  }
  if (q.isError) {
    return (
      <ErrorState messageKey="errors.generic.internal_error" onRetry={() => q.refetch()} />
    );
  }

  return (
    <View>
      {(q.data ?? []).map((c) => (
        <ConsentRow
          key={c.type}
          record={c}
          onRevoke={() => revoke.mutate(c.type)}
        />
      ))}
    </View>
  );
}
