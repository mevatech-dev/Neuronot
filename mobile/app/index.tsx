import { useQuery } from '@tanstack/react-query';
import { Redirect } from 'expo-router';

import { getProfile } from '@/services/api/profile';
import { useAuthStore } from '@/store/auth';

export default function Index() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const enabled = !!accessToken;

  const profile = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
    enabled,
    staleTime: 60_000,
  });

  if (!accessToken) return <Redirect href="/(auth)/login" />;
  if (profile.isLoading) return null;

  if (profile.data && !profile.data.onboarding_completed_at) {
    return <Redirect href="/onboarding" />;
  }
  return <Redirect href="/(tabs)/home" />;
}
