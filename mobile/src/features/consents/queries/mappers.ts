import type { ConsentRecordWire } from '@/services/api/consents';

import type { ConsentRecord } from '../types';

export function mapConsent(wire: ConsentRecordWire): ConsentRecord {
  return {
    type: wire.type,
    granted: wire.granted,
    version: wire.version,
    currentVersion: wire.current_version,
    source: wire.source ?? null,
    occurredAt: wire.occurred_at ? new Date(wire.occurred_at) : null,
    isStale: wire.granted && wire.version !== wire.current_version,
  };
}
