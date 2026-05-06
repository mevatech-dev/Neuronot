import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { darkSemanticColors, type SemanticColors } from './dark';
import { lightSemanticColors } from './light';
import { radius, space } from './tokens';
import { typography } from './typography';

type ThemeMode = 'system' | 'light' | 'dark';
type ResolvedScheme = 'light' | 'dark';

const STORAGE_KEY = 'neuronot.theme.mode';

export type Theme = {
  scheme: ResolvedScheme;
  colors: SemanticColors;
  space: typeof space;
  radius: typeof radius;
  typography: typeof typography;
};

type ThemeContextValue = {
  theme: Theme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

function buildTheme(scheme: ResolvedScheme): Theme {
  return {
    scheme,
    colors: scheme === 'dark' ? darkSemanticColors : lightSemanticColors,
    space,
    radius,
    typography,
  };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setModeState(stored);
        }
      })
      .finally(() => setHydrated(true));
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  const resolved: ResolvedScheme = mode === 'system' ? (systemScheme ?? 'dark') : mode;
  const theme = useMemo(() => buildTheme(resolved), [resolved]);

  const value = useMemo(() => ({ theme, mode, setMode }), [theme, mode, setMode]);

  if (!hydrated) return null;
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
