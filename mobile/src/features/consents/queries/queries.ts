import { listConsents } from '@/services/api/consents';

import type { ConsentRecord } from '../types';
import { mapConsent } from './mappers';

// Consents are NOT mirrored to SQLite — every read hits the live backend
// so the AI gate and re-consent prompts cannot be stale.
export const consentsQuery = (userId: string | null) => ({
  queryKey: ['consents', userId] as const,
  enabled: !!userId,
  staleTime: 0,
  gcTime: 60_000,
  queryFn: async (): Promise<ConsentRecord[]> => {
    const wire = await listConsents();
    return wire.map(mapConsent);
  },
});
