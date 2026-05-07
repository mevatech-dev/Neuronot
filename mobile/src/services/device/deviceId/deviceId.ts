import * as SecureStore from 'expo-secure-store';

const KEY = 'neuronot.device.id';

let cached: string | null = null;
let pending: Promise<string> | null = null;

// uuid v4 - small inline impl to avoid an extra dep just for one call.
function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function getOrCreateDeviceId(): Promise<string> {
  if (cached) return cached;
  if (pending) return pending;

  pending = (async () => {
    const stored = await SecureStore.getItemAsync(KEY);
    if (stored) {
      cached = stored;
      return stored;
    }

    const fresh = uuid();
    await SecureStore.setItemAsync(KEY, fresh);
    cached = fresh;
    return fresh;
  })().finally(() => {
    pending = null;
  });

  return pending;
}

export function getCachedDeviceId(): string | null {
  return cached;
}
