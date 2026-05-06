import * as Network from 'expo-network';
import { useEffect, useState } from 'react';

type Status = {
  online: boolean;
  /** unix ms when state last changed */
  since: number;
};

/**
 * Subscribes to network state. Initial value is fetched async; until then
 * `online` defaults to `true` to avoid flashing offline UI on cold start.
 */
export function useNetworkStatus(): Status {
  const [status, setStatus] = useState<Status>(() => ({ online: true, since: Date.now() }));

  useEffect(() => {
    let mounted = true;

    void Network.getNetworkStateAsync().then((state) => {
      if (!mounted) return;
      const online = !!state.isConnected && state.isInternetReachable !== false;
      setStatus((prev) => (prev.online === online ? prev : { online, since: Date.now() }));
    });

    const sub = Network.addNetworkStateListener((state) => {
      const online = !!state.isConnected && state.isInternetReachable !== false;
      setStatus((prev) => (prev.online === online ? prev : { online, since: Date.now() }));
    });

    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return status;
}
