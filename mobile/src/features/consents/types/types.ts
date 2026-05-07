export type ConsentType = 'ai_usage' | 'terms_of_service' | 'privacy_policy';
export type ConsentSource = 'register' | 'settings' | 'reconsent';

export type ConsentRecord = {
  type: ConsentType;
  granted: boolean;
  version: string;
  currentVersion: string;
  source: ConsentSource | null;
  occurredAt: Date | null;
  isStale: boolean;
};
