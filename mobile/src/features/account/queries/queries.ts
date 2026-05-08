import { fetchLinks, type LinksResponse } from '@/services/api/auth';

// linksQuery is a live read of the calling user's identity-method
// summary (no SQLite mirror — the connect/disconnect UI must reflect
// server state immediately after every mutation, never a cached row).
export const linksQuery = (userId: string | null) => ({
  queryKey: ['auth', 'links', userId] as const,
  enabled: !!userId,
  staleTime: 0,
  gcTime: 60_000,
  queryFn: async (): Promise<LinksResponse> => fetchLinks(),
});
