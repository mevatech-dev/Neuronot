import { create } from 'zustand';

type SyncState = {
  isSyncing: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  setSyncing: (v: boolean) => void;
  setLastSyncAt: (v: string | null) => void;
  setLastError: (v: string | null) => void;
};

export const useSyncStore = create<SyncState>((set) => ({
  isSyncing: false,
  lastSyncAt: null,
  lastError: null,
  setSyncing: (v) => set({ isSyncing: v }),
  setLastSyncAt: (v) => set({ lastSyncAt: v }),
  setLastError: (v) => set({ lastError: v }),
}));
