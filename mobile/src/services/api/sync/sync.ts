import { request } from '../client';
import type { DailyLogResponse } from '../dailylog';
import type { EventResponse } from '../events';
import type { InsightResponse } from '../insights';
import type { ProfileResponse } from '../profile';

export type SyncTable = 'daily_logs' | 'events' | 'profile' | 'insights';
export type SyncOp = 'upsert' | 'delete';

export type PullResponse = {
  server_time: string;
  daily_logs: DailyLogResponse[];
  events: EventResponse[];
  insights: InsightResponse[];
  profile: ProfileResponse | null;
  deletes: Record<string, string[]>;
};

export type PushOperation = {
  table: SyncTable;
  op: SyncOp;
  id: string;
  row?: unknown;
  updated_at: string;
};

export type AcceptedOp = {
  table: SyncTable;
  id: string;
  server_updated_at: string;
};

export type ConflictOp = {
  table: SyncTable;
  id: string;
  reason: string;
  server_row?: unknown;
};

export type PushResponse = {
  accepted: AcceptedOp[];
  conflicts: ConflictOp[];
};

export function pullSync(since?: string) {
  return request<PullResponse>({
    method: 'GET',
    url: '/v1/sync/pull',
    params: since ? { since } : undefined,
  });
}

export function pushSync(operations: PushOperation[]) {
  return request<PushResponse>({
    method: 'POST',
    url: '/v1/sync/push',
    data: { operations },
  });
}
