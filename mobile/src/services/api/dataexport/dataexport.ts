import { request } from '../client';

export type ExportPayloadWire = {
  generated_at: string;
  profile: Record<string, unknown> | null;
  daily_logs: Record<string, unknown>[];
  events: Record<string, unknown>[];
  insights: Record<string, unknown>[];
};

// ExportResponseWire matches api/internal/dataexport/dto.go. When R2 is
// configured, download_url + expires_at are present and payload is null.
// In dev (no R2 creds), the API embeds the data inline as `payload`.
export type ExportResponseWire = {
  download_url?: string;
  expires_at?: string;
  size_bytes?: number;
  payload?: ExportPayloadWire;
};

export function fetchExport(): Promise<ExportResponseWire> {
  return request<ExportResponseWire>({ method: 'GET', url: '/v1/me/export' });
}
