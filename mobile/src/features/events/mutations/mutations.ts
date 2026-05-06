import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  createEvent,
  deleteEvent,
  type EventCreate,
  type EventResponse,
  type EventUpdate,
  updateEvent,
} from '@/services/api/events';
import { scheduleCycleForCurrentUser } from '@/services/sync/engine';

type Hooks<T = void> = {
  onSuccess?: (data: T) => void;
  onError?: (err: unknown) => void;
};

function invalidateEventReads(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['events'] });
  void qc.invalidateQueries({ queryKey: ['timeline'] });
  void qc.invalidateQueries({ queryKey: ['summary', 'weekly'] });
}

export function useCreateEvent(hooks: Hooks<EventResponse> = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: EventCreate) => createEvent(data),
    onSuccess: (data) => {
      invalidateEventReads(qc);
      scheduleCycleForCurrentUser();
      hooks.onSuccess?.(data);
    },
    onError: hooks.onError,
  });
}

export function useUpdateEvent(hooks: Hooks<EventResponse> = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { id: string; patch: EventUpdate }) =>
      updateEvent(params.id, params.patch),
    onSuccess: (data) => {
      invalidateEventReads(qc);
      scheduleCycleForCurrentUser();
      hooks.onSuccess?.(data);
    },
    onError: hooks.onError,
  });
}

export function useDeleteEvent(hooks: Hooks = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteEvent(id),
    onSuccess: () => {
      invalidateEventReads(qc);
      scheduleCycleForCurrentUser();
      hooks.onSuccess?.();
    },
    onError: hooks.onError,
  });
}
