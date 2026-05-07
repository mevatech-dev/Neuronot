import { request } from '../client';

export type ConsentTypeWire = 'ai_usage' | 'terms_of_service' | 'privacy_policy';
export type ConsentSourceWire = 'register' | 'settings' | 'reconsent';

export type ConsentRecordWire = {
  type: ConsentTypeWire;
  granted: boolean;
  version: string;
  current_version: string;
  source?: ConsentSourceWire;
  occurred_at: string | null;
};

export function listConsents(): Promise<ConsentRecordWire[]> {
  return request<ConsentRecordWire[]>({ method: 'GET', url: '/v1/me/consents' });
}

export function grantConsent(type: ConsentTypeWire): Promise<null> {
  return request<null>({
    method: 'POST',
    url: '/v1/me/consents',
    data: { type, granted: true },
  });
}

export function revokeConsent(type: ConsentTypeWire): Promise<null> {
  return request<null>({
    method: 'DELETE',
    url: `/v1/me/consents/${type}`,
  });
}
