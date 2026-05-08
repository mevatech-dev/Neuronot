import { fetchLinks, type LinksResponse } from '@/services/api/auth';

// Linked-providers summary; consumed by Settings → Account to render the
// connect/disconnect rows. Always hits the live backend (no SQLite mirror)
// so the UI reflects server state immediately after a link/unlink.
export const linksQuery = (userId: string | null) => ({
  queryKey: ['auth', 'links', userId] as const,
  enabled: !!userId,
  staleTime: 0,
  gcTime: 60_000,
  queryFn: async (): Promise<LinksResponse> => fetchLinks(),
});
