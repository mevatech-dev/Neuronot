import { request } from '../client';

export type ExportPayloadWire = {
  generated_at: string;
  profile: Record<string, unknown> | null;
  daily_logs: Record<string, unknown>[];
  events: Record<string, unknown>[];
  insights: Record<string, unknown>[];
};

export function fetchExport(): Promise<ExportPayloadWire> {
  return request<ExportPayloadWire>({ method: 'GET', url: '/v1/me/export' });
}
