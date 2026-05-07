import {
  NunitoSans_400Regular,
  NunitoSans_500Medium,
  NunitoSans_600SemiBold,
  NunitoSans_700Bold,
  useFonts,
} from '@expo-google-fonts/nunito-sans';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import '@/i18n';
import { ToastProvider } from '@/components/feedback/Toast';
import { useSyncLifecycle } from '@/hooks/useSyncLifecycle';
import { getOrCreateDeviceId } from '@/services/device/deviceId';
import { useAuthStore } from '@/store/auth';
import { ThemeProvider } from '@/theme';

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

export default function RootLayout() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const hydrate = useAuthStore((s) => s.hydrate);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const [deviceReady, setDeviceReady] = useState(false);

  const [fontsLoaded] = useFonts({
    NunitoSans_400Regular,
    NunitoSans_500Medium,
    NunitoSans_600SemiBold,
    NunitoSans_700Bold,
  });

  useEffect(() => {
    let mounted = true;
    void (async () => {
      await getOrCreateDeviceId();
      if (mounted) {
        setDeviceReady(true);
      }
      await hydrate();
    })();
    return () => {
      mounted = false;
    };
  }, [hydrate]);

  useSyncLifecycle(deviceReady ? userId : null);

  useEffect(() => {
    if (hydrated && fontsLoaded && deviceReady) {
      void SplashScreen.hideAsync();
    }
  }, [deviceReady, hydrated, fontsLoaded]);

  if (!hydrated || !fontsLoaded || !deviceReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <StatusBar style="auto" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
            </Stack>
          </ToastProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
