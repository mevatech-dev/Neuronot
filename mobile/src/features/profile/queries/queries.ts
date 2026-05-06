import { getProfile } from '@/services/api/profile';

export const profileQuery = {
  queryKey: ['profile'] as const,
  queryFn: getProfile,
  staleTime: 60_000,
};
