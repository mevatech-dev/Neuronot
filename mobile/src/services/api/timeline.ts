import { request } from './client';

import type { EventType } from './events';

export type TimelineItem =
  | {
      kind: 'daily_log';
      at: string;
      id: string;
      daily_log: {
        focus: number;
        energy: number;
        forgetfulness: number;
        stress: number;
        sleep_quality: number;
      };
    }
  | {
      kind: 'event';
      at: string;
      id: string;
      event: {
        type: EventType;
        intensity: number;
        note?: string | null;
      };
    };

export type TimelineResponse = {
  items: TimelineItem[];
  next_cursor?: string;
};

export function getTimeline(cursor?: string, limit = 20) {
  return request<TimelineResponse>({
    method: 'GET',
    url: '/v1/timeline',
    params: { cursor, limit },
  });
}
