export type SyncCycleResult = {
  pushed: number;
  pulled: number;
  conflicts: number;
  startedAt: string;
  finishedAt: string;
  error?: string;
};

export type SyncCycleOptions = {
  /** When false, the cycle only pulls (e.g. background refresh on tab focus). */
  push?: boolean;
};
