import { Stack } from 'expo-router';
import React from 'react';

import { useTheme } from '@/core/theme';

export default function AuthLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
      {/* Telefonla kayıt akışı: numara → kod → profil */}
      <Stack.Screen name="phone" />
      <Stack.Screen name="verify" />
      <Stack.Screen name="complete-profile" options={{ gestureEnabled: false }} />
      {/* E-posta/şifre: sunucusuz geliştirme ve demo için ikincil yol */}
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />
    </Stack>
  );
}
