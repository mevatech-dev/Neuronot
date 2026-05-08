import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { OnboardingState } from '@/features/onboarding/types';

type OnboardingStoreState = {
  introSeen: boolean;
  answers: OnboardingState;
  completedLocally: boolean;
  syncedAt: number | null;

  markIntroSeen: () => void;
  setAnswers: (answers: OnboardingState) => void;
  markCompletedLocally: (answers: OnboardingState) => void;
  markSynced: () => void;
  reset: () => void;
};

const initial = {
  introSeen: false,
  answers: {},
  completedLocally: false,
  syncedAt: null,
} as const;

export const useOnboardingStore = create<OnboardingStoreState>()(
  persist(
    (set) => ({
      ...initial,
      markIntroSeen: () => set({ introSeen: true }),
      setAnswers: (answers) => set({ answers }),
      markCompletedLocally: (answers) => set({ answers, completedLocally: true }),
      markSynced: () => set({ syncedAt: Date.now() }),
      reset: () => set(initial),
    }),
    {
      name: 'neuronot.onboarding',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
