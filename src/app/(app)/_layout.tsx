import { Stack } from 'expo-router';
import React from 'react';

import { useTheme } from '@/core/theme';

export default function AppLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="post/[id]" />
      <Stack.Screen
        name="post/new"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="match/request"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="match/[id]" />
      <Stack.Screen name="user/[id]" />
      <Stack.Screen name="chat/[id]" />
      <Stack.Screen name="location/[id]" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}
