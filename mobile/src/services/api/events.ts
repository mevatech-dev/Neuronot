import { request } from './client';

export const EVENT_TYPES = [
  'headache',
  'brain_fog',
  'forgetfulness',
  'distraction',
  'mental_fatigue',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export type EventResponse = {
  id: string;
  type: EventType;
  intensity: number;
  note: string | null;
  occurred_at: string;
};

export type EventCreate = {
  type: EventType;
  intensity: number;
  note?: string;
  occurred_at?: string;
};

export type EventList = {
  items: EventResponse[];
  next_cursor?: string;
};

export function createEvent(data: EventCreate) {
  return request<EventResponse>({ method: 'POST', url: '/v1/events', data });
}

export function listEvents(cursor?: string, limit = 20) {
  return request<EventList>({ method: 'GET', url: '/v1/events', params: { cursor, limit } });
}

export function deleteEvent(id: string) {
  return request<{ status: string }>({ method: 'DELETE', url: `/v1/events/${id}` });
}
