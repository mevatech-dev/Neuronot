import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect } from 'expo-router';
import { useEffect } from 'react';

import { getProfile, patchProfile } from '@/services/api/profile';
import { useAuthStore } from '@/store/auth';
import { useOnboardingStore } from '@/store/onboarding';

export default function Index() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const completedLocally = useOnboardingStore((s) => s.completedLocally);
  const syncedAt = useOnboardingStore((s) => s.syncedAt);
  const answers = useOnboardingStore((s) => s.answers);
  const markSynced = useOnboardingStore((s) => s.markSynced);

  const enabled = !!accessToken;
  const profile = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
    enabled,
    staleTime: 60_000,
  });

  const qc = useQueryClient();
  const sync = useMutation({
    mutationFn: () =>
      patchProfile({
        // Backend stores a single focus_problem; ship the first picked
        // concern until the API contract widens to an array.
        focus_problem: answers.concerns?.[0],
        intensity_level: answers.intensityLevel,
        avg_sleep_hours: answers.avgSleepHours,
        caffeine_daily: answers.caffeineDaily,
        reminder_enabled: answers.reminderEnabled,
        reminder_hour: answers.reminderHour,
        timezone: answers.timezone ?? 'UTC',
        complete_onboarding: true,
      }),
    onSuccess: () => {
      markSynced();
      qc.invalidateQueries({ queryKey: ['profile'] });
    },
  });

  // Drain locally-collected onboarding answers exactly once after the user
  // logs in (or registers). The mutation guard prevents repeat fires while a
  // request is in flight or has already succeeded.
  const shouldSync =
    enabled &&
    profile.data !== undefined &&
    !profile.data?.onboarding_completed_at &&
    completedLocally &&
    !syncedAt &&
    !sync.isPending &&
    !sync.isSuccess;

  useEffect(() => {
    if (shouldSync) sync.mutate();
  }, [shouldSync, sync]);

  // No token yet — drive the pre-auth intro funnel.
  if (!accessToken) {
    if (!completedLocally) return <Redirect href="/(intro)/onboarding" />;
    return <Redirect href="/(auth)/welcome" />;
  }

  // Authenticated — wait until profile is known.
  if (profile.isLoading) return null;

  if (profile.data?.onboarding_completed_at) {
    return <Redirect href="/(tabs)/home" />;
  }

  // Local answers exist but haven't been pushed yet — wait for sync.
  if (completedLocally) {
    if (sync.isSuccess) return <Redirect href="/(tabs)/home" />;
    return null;
  }

  // Edge case: signed in without going through the new pre-auth flow
  // (e.g. legacy account, cleared local storage). Fall back to the
  // post-auth onboarding screen which talks to the API directly.
  return <Redirect href="/onboarding" />;
}
