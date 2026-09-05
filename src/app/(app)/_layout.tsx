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
      <Stack.Screen name="notifications" />
      <Stack.Screen name="bookings" />
      <Stack.Screen name="live/[id]" />
      <Stack.Screen
        name="live/start"
        options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="hazards/index" />
      <Stack.Screen name="hazards/[id]" />
      <Stack.Screen
        name="hazards/report"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="market/index" />
      <Stack.Screen name="market/[id]" />
      <Stack.Screen
        name="market/new"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="instructors/index" />
      <Stack.Screen name="instructors/[id]" />
      <Stack.Screen
        name="instructors/book"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
    </Stack>
  );
}
