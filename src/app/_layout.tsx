import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/manrope';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastHost } from '@/components/ui';
import { useLocaleStore } from '@/core/i18n';
import { createQueryClient } from '@/core/query/client';
import { ThemeProvider, useTheme } from '@/core/theme';
import { useSessionStore } from '@/features/auth/session.store';

SplashScreen.preventAutoHideAsync().catch(() => undefined);
SplashScreen.setOptions({ duration: 400, fade: true });

export const unstable_settings = {
  // Derin bağlantı ile açılan ekranlarda geri tuşu ana sekmelere döner.
  initialRouteName: '(app)',
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
  const sessionStatus = useSessionStore((s) => s.status);
  const hydrateSession = useSessionStore((s) => s.hydrate);
  const localeHydrated = useLocaleStore((s) => s.hydrated);
  const hydrateLocale = useLocaleStore((s) => s.hydrate);
  const queryClient = useMemo(() => createQueryClient(), []);

  useEffect(() => {
    hydrateSession();
    hydrateLocale();
  }, [hydrateSession, hydrateLocale]);

  const ready =
    (fontsLoaded || Boolean(fontError)) && sessionStatus !== 'loading' && localeHydrated;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <RootNavigator signedIn={sessionStatus === 'signedIn'} />
            <ToastHost />
          </QueryClientProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator({ signedIn }: { signedIn: boolean }) {
  const { colors, isDark } = useTheme();

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
        </Stack.Protected>
        <Stack.Screen name="+not-found" />
      </Stack>
    </>
  );
}
